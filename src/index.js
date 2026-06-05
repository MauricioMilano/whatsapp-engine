require('dotenv').config();
const express = require('express');
const { handleWebhook, verifyWebhook } = require('./webhook');
const { sendMessage } = require('./whatsappService');
const { verifySignature } = require('./utils/signature');

const app = express();
const PORT = process.env.PORT || 3000;
const ENABLE_NLP_DIALOGUE = process.env.ENABLE_NLP_DIALOGUE === 'true';
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10);
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    nlpDialogue: ENABLE_NLP_DIALOGUE
  });
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

// Optional: initialize NLP dialogue engine at startup
let nlpEngine = null;
let cleanupTimer = null;

async function bootstrap() {
  if (ENABLE_NLP_DIALOGUE) {
    try {
      const NlpDialogueEngine = require('./nlpDialogueEngine');
      nlpEngine = NlpDialogueEngine.getInstance();
      await nlpEngine.initialize(process.env.DIALOGUE_PATH);

      // Periodically clean up expired sessions
      cleanupTimer = setInterval(() => {
        nlpEngine.cleanup().catch(err =>
          console.error('Session cleanup error:', err.message)
        );
      }, SESSION_CLEANUP_INTERVAL_MS);
    } catch (err) {
      console.error('❌ Failed to initialize NLP dialogue engine:', err.message);
    }
  }
}

app.listen(PORT, async () => {
  await bootstrap();
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🧠 NLP Dialogue: ${ENABLE_NLP_DIALOGUE ? 'enabled' : 'disabled'}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (cleanupTimer) clearInterval(cleanupTimer);
  const { closePool } = require('./contextStore');
  closePool().finally(() => process.exit(0));
});