require('dotenv').config();
const express = require('express');
const { handleWebhook, verifyWebhook } = require('./webhook');
const { sendMessage } = require('./whatsappService');
const { verifySignature } = require('./utils/signature');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Middleware para validar assinatura (opcional mas recomendado)
app.use((req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  
  if (signature && process.env.APP_SECRET) {
    const rawBody = JSON.stringify(req.body);
    if (!verifySignature(rawBody, signature, process.env.APP_SECRET)) {
      console.log('Assinatura inválida');
      return res.status(403).send('Invalid signature');
    }
  }
  
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook verification (GET) and message receive (POST)
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleWebhook);

// Send message endpoint
app.post('/messages', sendMessage);

// Error handling
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
});