const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const MP_ACCESS_TOKEN = "APP_USR-46eb8024-b517-4584-9c38-31e2ea0a6d11";

app.post('/create-preference', async (req, res) => {
  try {
    const { amount, donorName, message } = req.body;
    
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        items: [{
          title: donorName ? 'Donacion de ' + donorName : 'Donacion a TacticoMarket',
          quantity: 1,
          currency_id: "ARS",
          unit_price: amount,
          description: message || "Apoyo voluntario"
        }],
        back_urls: {
          success: "https://tacticomarket.netlify.app/?donation=success",
          failure: "https://tacticomarket.netlify.app/?donation=failure"
        },
        auto_return: "approved"
      })
    });
    
    const data = await response.json();
    res.json({ init_point: data.init_point });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server on port ' + PORT));
