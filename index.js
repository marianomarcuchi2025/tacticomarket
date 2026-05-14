const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

const MP_ACCESS_TOKEN = "APP_USR-46eb8024-b517-4584-9c38-31e2ea0a6d11";

app.post('/create-preference', (req, res) => {
  const { amount, donorName, message } = req.body;
  
  console.log('Recibida solicitud de donación:', amount);
  
  const data = JSON.stringify({
    items: [{
      title: donorName ? 'Donacion de ' + donorName : 'Donacion a TacticoMarket',
      quantity: 1,
      currency_id: "ARS",
      unit_price: amount,
      description: message || "Apoyo voluntario para mantener la plataforma"
    }],
    back_urls: {
      success: "https://tacticomarket.netlify.app/?donation=success",
      failure: "https://tacticomarket.netlify.app/?donation=failure"
    },
    auto_return: "approved"
  });

  const options = {
    hostname: 'api.mercadopago.com',
    path: '/checkout/preferences',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + MP_ACCESS_TOKEN,
      'Content-Length': data.length
    }
  };

  const request = https.request(options, (response) => {
    let body = '';
    response.on('data', chunk => body += chunk);
    response.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.init_point) {
          res.json({ init_point: parsed.init_point });
        } else {
          console.error('Error MP:', parsed);
          res.status(500).json({ error: 'Error de Mercado Pago' });
        }
      } catch (e) {
        res.status(500).json({ error: 'Error al procesar respuesta' });
      }
    });
  });

  request.on('error', (error) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno' });
  });

  request.write(data);
  request.end();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor corriendo en puerto ' + PORT);
});
