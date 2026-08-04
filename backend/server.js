const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `http://localhost:${PORT}`;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY;
const DONATION_SUCCESS_URL = process.env.DONATION_SUCCESS_URL || `${FRONTEND_ORIGIN}/?donation=success`;
const DONATION_FAILURE_URL = process.env.DONATION_FAILURE_URL || `${FRONTEND_ORIGIN}/?donation=failure`;
const DONATION_PENDING_URL = process.env.DONATION_PENDING_URL || `${FRONTEND_ORIGIN}/?donation=pending`;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MP_ACCESS_TOKEN || !MP_PUBLIC_KEY) {
  console.warn('⚠️  MP_ACCESS_TOKEN / MP_PUBLIC_KEY no están configuradas (ver .env.example). Las donaciones no van a funcionar hasta que las cargues.');
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Variables de Supabase no configuradas (ver .env.example). Login, publicaciones y chat no van a funcionar.');
}

// Cliente con service role: solo se usa server-side (nunca se expone al
// frontend), bypassea RLS para escribir en `donations` desde el backend.
const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// Necesario para que express-rate-limit identifique IPs reales detrás de un
// proxy/hosting (Render, Vercel, Railway, etc.) en vez de la IP del proxy.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://unpkg.com'],
      styleSrc: ["'self'", 'https://unpkg.com', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://unpkg.com', 'https://*.supabase.co'],
      connectSrc: ["'self'", 'https://*.supabase.co'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));
app.use(compression());
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '10kb' }));
// "no-cache" no significa "no cachear": el navegador guarda el archivo
// pero siempre revalida con el servidor antes de usarlo (ETag -> 304 si
// no cambió). Evita servir JS/CSS viejo después de un deploy sin tener
// que versionar cada nombre de archivo.
app.use(express.static(path.join(__dirname, '..', 'frontend'), { cacheControl: true, etag: true, maxAge: 0, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

// Única config segura de exponer al frontend: claves públicas, nunca secretos.
app.get('/api/public-config', (req, res) => {
  res.json({
    publicKey: MP_PUBLIC_KEY || null,
    supabaseUrl: SUPABASE_URL || null,
    supabaseAnonKey: SUPABASE_ANON_KEY || null
  });
});

const donationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Probá de nuevo en unos minutos.' }
});

function sanitizeText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

app.post('/api/create-preference', donationLimiter, async (req, res) => {
  const { amount, donorName, message, listingId } = req.body || {};

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 100 || parsedAmount > 10_000_000) {
    return res.status(400).json({ error: 'Monto inválido. Debe estar entre $100 y $10.000.000 ARS.' });
  }

  if (!MP_ACCESS_TOKEN) {
    return res.status(503).json({ error: 'El servidor no tiene configurado MP_ACCESS_TOKEN.' });
  }

  // listingId es opcional: si viene, la donación queda asociada a una
  // publicación puntual (ej. "ayúdenme con la mudanza") en vez de ser una
  // donación general a la plataforma.
  const safeListingId = typeof listingId === 'string' && /^[0-9a-f-]{36}$/i.test(listingId) ? listingId : null;

  const safeName = sanitizeText(donorName, 80);
  const safeMessage = sanitizeText(message, 200);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  // Mercado Pago rechaza auto_return (y no puede llamar a un webhook) si
  // las URLs apuntan a localhost -no son alcanzables desde sus servidores-.
  // En producción, con un dominio real, esto queda activo automáticamente.
  const esLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(DONATION_SUCCESS_URL);

  const preferencePayload = {
    items: [{
      title: safeName ? `Donación de ${safeName}` : 'Donación a TácticoMarket',
      quantity: 1,
      currency_id: 'ARS',
      unit_price: parsedAmount,
      description: safeMessage || 'Apoyo voluntario para mantener la plataforma'
    }],
    back_urls: {
      success: DONATION_SUCCESS_URL,
      failure: DONATION_FAILURE_URL,
      pending: DONATION_PENDING_URL
    }
  };
  if (!esLocal) {
    preferencePayload.auto_return = 'approved';
    preferencePayload.notification_url = `${FRONTEND_ORIGIN}/api/mp-webhook`;
  }

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify(preferencePayload),
      signal: controller.signal
    });

    const data = await mpResponse.json();

    if (data.init_point) {
      if (supabaseAdmin) {
        const { error: insertError } = await supabaseAdmin.from('donations').insert({
          mp_preference_id: data.id || null,
          amount: parsedAmount,
          donor_name: safeName || null,
          message: safeMessage || null,
          status: 'pendiente',
          listing_id: safeListingId
        });
        if (insertError) {
          console.error('No se pudo registrar la donación pendiente:', insertError);
        }
      }
      res.json({ init_point: data.init_point });
    } else {
      console.error('Error Mercado Pago:', data);
      res.status(502).json({ error: 'Mercado Pago rechazó la solicitud.' });
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Timeout al conectar con Mercado Pago');
      res.status(504).json({ error: 'Mercado Pago tardó demasiado en responder.' });
    } else {
      console.error('Error al crear preferencia:', error);
      res.status(500).json({ error: 'Error interno al conectar con Mercado Pago.' });
    }
  } finally {
    clearTimeout(timeout);
  }
});

// Mercado Pago llama acá cuando cambia el estado de un pago. Reconsultamos
// el pago por su ID (nunca confiamos en el body de la notificación para
// decidir el estado) y marcamos la donación como aprobada/rechazada.
app.post('/api/mp-webhook', express.json(), async (req, res) => {
  res.sendStatus(200); // confirmar recepción rápido, MP reintenta si tarda

  if (!supabaseAdmin || !MP_ACCESS_TOKEN) return;

  const paymentId = req.query['data.id'] || req.body?.data?.id;
  if (!paymentId) return;

  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
    });
    const payment = await paymentResponse.json();
    const preferenceId = payment.order?.id || payment.preference_id;
    if (!preferenceId) return;

    const status = payment.status === 'approved' ? 'aprobada'
      : payment.status === 'rejected' ? 'rechazada'
      : null;
    if (!status) return;

    const { data: updatedDonations, error } = await supabaseAdmin
      .from('donations')
      .update({ status })
      .eq('mp_preference_id', preferenceId)
      .select('listing_id, amount, status');
    if (error) {
      console.error('Error actualizando donación desde webhook:', error);
      return;
    }

    const donation = updatedDonations?.[0];
    if (donation?.status === 'aprobada' && donation.listing_id) {
      const { error: rpcError } = await supabaseAdmin.rpc('add_crowdfunding_donation', {
        listing_id: donation.listing_id,
        donation: donation.amount
      });
      if (rpcError) console.error('Error acreditando donación a la publicación:', rpcError);
    }
  } catch (error) {
    console.error('Error procesando webhook de Mercado Pago:', error);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'No encontrado' });
  }
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, '..', 'frontend', '404.html'));
  }
  res.status(404).json({ error: 'No encontrado' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
