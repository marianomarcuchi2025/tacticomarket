const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `http://localhost:${PORT}`;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY;
const DONATION_SUCCESS_URL = process.env.DONATION_SUCCESS_URL || `${FRONTEND_ORIGIN}/?donation=success`;
const DONATION_FAILURE_URL = process.env.DONATION_FAILURE_URL || `${FRONTEND_ORIGIN}/?donation=failure`;

if (!MP_ACCESS_TOKEN || !MP_PUBLIC_KEY) {
  console.warn('⚠️  MP_ACCESS_TOKEN / MP_PUBLIC_KEY no están configuradas (ver .env.example). Las donaciones no van a funcionar hasta que las cargues.');
}

// Necesario para que express-rate-limit identifique IPs reales detrás de un
// proxy/hosting (Render, Vercel, Railway, etc.) en vez de la IP del proxy.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://sdk.mercadopago.com', 'https://unpkg.com'],
      styleSrc: ["'self'", 'https://unpkg.com'],
      imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://unpkg.com'],
      connectSrc: ["'self'", 'https://api.mercadopago.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));
app.use(compression());
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend'), { maxAge: '1h' }));

// Única credencial segura de exponer al frontend. El access token nunca sale de acá.
app.get('/api/public-config', (req, res) => {
  res.json({ publicKey: MP_PUBLIC_KEY || null });
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
  const { amount, donorName, message } = req.body || {};

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 100 || parsedAmount > 10_000_000) {
    return res.status(400).json({ error: 'Monto inválido. Debe estar entre $100 y $10.000.000 ARS.' });
  }

  if (!MP_ACCESS_TOKEN) {
    return res.status(503).json({ error: 'El servidor no tiene configurado MP_ACCESS_TOKEN.' });
  }

  const safeName = sanitizeText(donorName, 80);
  const safeMessage = sanitizeText(message, 200);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        items: [{
          title: safeName ? `Donación de ${safeName}` : 'Donación a TácticoMarket',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: parsedAmount,
          description: safeMessage || 'Apoyo voluntario para mantener la plataforma'
        }],
        back_urls: {
          success: DONATION_SUCCESS_URL,
          failure: DONATION_FAILURE_URL
        },
        auto_return: 'approved'
      }),
      signal: controller.signal
    });

    const data = await mpResponse.json();

    if (data.init_point) {
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
