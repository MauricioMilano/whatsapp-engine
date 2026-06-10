require('dotenv').config();
const express = require('express');
const path = require('path');
const { handleWebhook, verifyWebhook } = require('./webhook');
const { sendMessage } = require('./whatsappService');
const { verifySignature } = require('./utils/signature');
const simulator = require('./simulator');
const {
  initConversationStore,
  createConversation,
  getConversation,
  endConversation,
  deleteConversation,
  addMessage,
  getMessages,
  getRecentConversations
} = require('./conversationStore');

const app = express();
const PORT = process.env.PORT || 3000;
const ENABLE_NLP_DIALOGUE = process.env.ENABLE_NLP_DIALOGUE === 'true';
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10);
const SESSION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Middleware
app.use(express.json());

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

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

// ============================================================
// Debug UI / Simulator Routes
// ============================================================

// GET /sim/api/info - Dialogue metadata for UI
app.get('/sim/api/info', (req, res) => {
  if (!nlpEngine || !nlpEngine.initialized) {
    return res.status(503).json({ error: 'NLP engine not initialized' });
  }
  res.json({
    name: nlpEngine.dialogue.meta.name,
    version: nlpEngine.dialogue.meta.version,
    language: nlpEngine.dialogue.meta.language,
    intents: nlpEngine.dialogue.intents.map(i => ({
      name: i.name,
      utterances: i.utterances
    })),
    entities: nlpEngine.dialogue.entities,
    actions: Object.keys(nlpEngine.dialogue.actions),
    fallback: nlpEngine.dialogue.fallback
  });
});

// POST /sim/conversations - Create new conversation
app.post('/sim/conversations', async (req, res) => {
  try {
    const { userId } = req.body;
    const conv = await createConversation(userId || `debug-${Date.now()}`);
    res.status(201).json(conv);
  } catch (err) {
    console.error('Error creating conversation:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /sim/conversations - List recent conversations
app.get('/sim/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const convs = await getRecentConversations(limit);
    res.json({ conversations: convs });
  } catch (err) {
    console.error('Error listing conversations:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /sim/conversations/:conversationId - Get conversation metadata
app.get('/sim/conversations/:conversationId', async (req, res) => {
  try {
    const conv = await getConversation(req.params.conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conv);
  } catch (err) {
    console.error('Error getting conversation:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /sim/conversations/:conversationId/messages - Get all messages
app.get('/sim/conversations/:conversationId/messages', async (req, res) => {
  try {
    const conv = await getConversation(req.params.conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const messages = await getMessages(req.params.conversationId);
    res.json({ conversationId: req.params.conversationId, messages });
  } catch (err) {
    console.error('Error getting messages:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /sim/conversations/:conversationId/messages - Send message
app.post('/sim/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const conv = await getConversation(conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Process message through simulator
    const message = { text: { body: text } };
    const result = await simulator.processMessage(conv.userId, message, 'text');

    // Save incoming message
    const incomingMsg = await addMessage(conversationId, {
      direction: 'incoming',
      content: result.content,
      intent: result.intent,
      intentScore: result.intentScore,
      allIntents: result.allIntents,
      contextVars: result.contextVars,
      buttons: null
    });

    // Save bot response
    const botMsg = await addMessage(conversationId, {
      direction: 'outgoing',
      content: result.botResponse.content,
      intent: result.botResponse.intent,
      intentScore: result.botResponse.intentScore,
      allIntents: result.botResponse.allIntents,
      contextVars: result.botResponse.contextVars,
      buttons: result.botResponse.buttons || null
    });

    res.status(201).json(incomingMsg);
  } catch (err) {
    console.error('Error sending message:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /sim/conversations/:conversationId/button - Click button
app.post('/sim/conversations/:conversationId/button', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { buttonId } = req.body;

    if (!buttonId || typeof buttonId !== 'string') {
      return res.status(400).json({ error: 'buttonId is required' });
    }

    const conv = await getConversation(conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Process button through simulator
    const result = await simulator.processButton(conv.userId, buttonId);

    // Save incoming (button click)
    const incomingMsg = await addMessage(conversationId, {
      direction: 'incoming',
      content: result.content,
      intent: result.intent,
      intentScore: result.intentScore,
      allIntents: result.allIntents,
      contextVars: result.contextVars,
      buttons: null
    });

    // Save bot response
    const botMsg = await addMessage(conversationId, {
      direction: 'outgoing',
      content: result.botResponse.content,
      intent: result.botResponse.intent,
      intentScore: result.botResponse.intentScore,
      allIntents: result.botResponse.allIntents,
      contextVars: result.botResponse.contextVars,
      buttons: result.botResponse.buttons || null
    });

    res.status(201).json(incomingMsg);
  } catch (err) {
    console.error('Error processing button:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /sim/sessions/:userId/reset - Reset NLP context for a user
app.post('/sim/sessions/:userId/reset', async (req, res) => {
  try {
    if (!nlpEngine || !nlpEngine.initialized) {
      return res.status(503).json({ error: 'NLP engine not initialized' });
    }
    const result = await simulator.resetSession(req.params.userId);
    res.json(result);
  } catch (err) {
    console.error('Error resetting session:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /sim/conversations/:conversationId - End conversation
app.delete('/sim/conversations/:conversationId', async (req, res) => {
  try {
    const conv = await endConversation(req.params.conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conv);
  } catch (err) {
    console.error('Error ending conversation:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SPA catch-all (serve index.html for non-API routes in production)
if (process.env.NODE_ENV === 'production') {
  app.get(/^(?!\/sim\/|\/webhook\/|\/health).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

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

      // Initialize simulator with same dialogue
      await simulator.initialize(process.env.DIALOGUE_PATH);

      // Initialize conversation store
      await initConversationStore();

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
  console.log(` Debug UI: http://localhost:${PORT}/sim/api/info`);
  console.log(`🧠 NLP Dialogue: ${ENABLE_NLP_DIALOGUE ? 'enabled' : 'disabled'}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (cleanupTimer) clearInterval(cleanupTimer);
  const { closePool } = require('./contextStore');
  const { closePool: closeConvPool } = require('./conversationStore');
  Promise.all([
    closePool ? closePool() : Promise.resolve(),
    closeConvPool ? closeConvPool() : Promise.resolve()
  ]).finally(() => process.exit(0));
});
