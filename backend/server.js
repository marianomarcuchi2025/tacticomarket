const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `http://localhost:${PORT}`;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY;
const DONATION_SUCCESS_URL = process.env.DONATION_SUCCESS_URL || `${FRONTEND_ORIGIN}/?donation=success`;
const DONATION_FAILURE_URL = process.env.DONATION_FAILURE_URL || `${FRONTEND_ORIGIN}/?donation=failure`;

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Única credencial segura de exponer al frontend. El access token nunca sale de acá.
app.get('/api/public-config', (req, res) => {
  res.json({ publicKey: MP_PUBLIC_KEY || null });
});

app.post('/api/create-preference', async (req, res) => {
  const { amount, donorName, message } = req.body || {};

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 100) {
    return res.status(400).json({ error: 'Monto inválido. Mínimo $100 ARS.' });
  }

  if (!MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'El servidor no tiene configurado MP_ACCESS_TOKEN.' });
  }

  try {
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        items: [{
          title: donorName ? `Donación de ${donorName}` : 'Donación a TácticoMarket',
          quantity: 1,
          currency_id: 'ARS',
          unit_price: parsedAmount,
          description: message || 'Apoyo voluntario para mantener la plataforma'
        }],
        back_urls: {
          success: DONATION_SUCCESS_URL,
          failure: DONATION_FAILURE_URL
        },
        auto_return: 'approved'
      })
    });

    const data = await mpResponse.json();

    if (data.init_point) {
      res.json({ init_point: data.init_point });
    } else {
      console.error('Error Mercado Pago:', data);
      res.status(502).json({ error: 'Mercado Pago rechazó la solicitud.' });
    }
  } catch (error) {
    console.error('Error al crear preferencia:', error);
    res.status(500).json({ error: 'Error interno al conectar con Mercado Pago.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
