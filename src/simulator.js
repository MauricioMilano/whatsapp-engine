/**
 * Simulator Module
 *
 * Debug interface for the WhatsApp bot. Uses the same NlpDialogueEngine
 * and contextStore as the real webhook, but doesn't send messages to WhatsApp.
 *
 * Provides:
 * - processMessage(userId, message, type) — process a user message
 * - processButton(userId, buttonId) — process a button click
 * - getSessionState(userId) — get current context variables for user
 * - resetSession(userId) — clear context for user
 */

const { getContext, updateContext } = require('./contextStore');

let nlpEngine = null;
let dialogue = null;

/**
 * Initialize the simulator with the dialogue path.
 * Must be called before any other methods.
 */
async function initialize(dialoguePath) {
  if (nlpEngine && nlpEngine.initialized) {
    return; // Already initialized
  }

  const NlpDialogueEngine = require('./nlpDialogueEngine');
  nlpEngine = NlpDialogueEngine.getInstance();
  await nlpEngine.initialize(dialoguePath);
  dialogue = nlpEngine.dialogue;
}

/**
 * Process a user message (text, image, etc.)
 * Returns the full response including all classified intents.
 */
async function processMessage(userId, message, type = 'text') {
  if (!nlpEngine || !nlpEngine.initialized) {
    throw new Error('Simulator not initialized. Call initialize() first.');
  }

  const utterance = message.text?.body || message.caption || '';
  const result = await nlpEngine.processInput(userId, utterance);

  // Get all classifications from the manager
  const lang = dialogue.meta.language;
  const processResult = await nlpEngine.manager.process(lang, utterance);
  const allIntents = (processResult.classifications || []).map(c => ({
    intent: c.intent,
    score: c.score
  }));

  // Get updated context
  const ctx = await getContext(userId, dialogue.context.variables);

  // Build response content
  const content = buildContent(type, message, result);

  // Build response (same shape as conversationMessage)
  const response = {
    content,
    intent: result.intent || null,
    intentScore: result.score || null,
    allIntents: allIntents.length > 0 ? allIntents : null,
    contextVars: ctx.variables,
    // The bot response (outgoing) will be added separately by the caller
    botResponse: {
      content: { type: 'text', body: result.text },
      header: result.header,
      footer: result.footer,
      buttons: result.buttons,
      intent: null,
      intentScore: null,
      allIntents: null,
      contextVars: ctx.variables
    }
  };

  return response;
}

/**
 * Process a button click.
 */
async function processButton(userId, buttonId) {
  if (!nlpEngine || !nlpEngine.initialized) {
    throw new Error('Simulator not initialized. Call initialize() first.');
  }

  const result = await nlpEngine.processButton(userId, buttonId);
  const ctx = await getContext(userId, dialogue.context.variables);

  return {
    content: { type: 'button', buttonId },
    intent: null,
    intentScore: null,
    allIntents: null,
    contextVars: ctx.variables,
    botResponse: {
      content: { type: 'text', body: result.text },
      header: result.header,
      footer: result.footer,
      buttons: result.buttons,
      intent: null,
      intentScore: null,
      allIntents: null,
      contextVars: ctx.variables
    }
  };
}

/**
 * Get current session state (context variables) for a user.
 */
async function getSessionState(userId) {
  if (!nlpEngine || !nlpEngine.initialized) {
    throw new Error('Simulator not initialized. Call initialize() first.');
  }

  const ctx = await getContext(userId, dialogue.context.variables);
  return {
    userId,
    variables: ctx.variables,
    isNew: ctx.isNew
  };
}

/**
 * Reset session (clear context variables) for a user.
 */
async function resetSession(userId) {
  if (!nlpEngine || !nlpEngine.initialized) {
    throw new Error('Simulator not initialized. Call initialize() first.');
  }

  const defaultVars = { ...dialogue.context.variables };
  await updateContext(userId, null, defaultVars);

  return {
    userId,
    variables: defaultVars,
    reset: true
  };
}

/**
 * Build content object based on message type.
 */
function buildContent(type, message, result) {
  switch (type) {
    case 'text':
      return { type: 'text', body: message.text?.body || '' };
    case 'image':
      return {
        type: 'image',
        mimeType: message.mimeType || 'image/jpeg',
        filename: message.filename || 'image.jpg',
        caption: message.caption || ''
      };
    case 'audio':
      return {
        type: 'audio',
        mimeType: message.mimeType || 'audio/ogg',
        filename: message.filename || 'audio.ogg'
      };
    case 'document':
      return {
        type: 'document',
        mimeType: message.mimeType || 'application/pdf',
        filename: message.filename || 'document.pdf',
        caption: message.caption || ''
      };
    case 'video':
      return {
        type: 'video',
        mimeType: message.mimeType || 'video/mp4',
        filename: message.filename || 'video.mp4',
        caption: message.caption || ''
      };
    case 'location':
      return {
        type: 'location',
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name || null
      };
    case 'contacts':
      return {
        type: 'contacts',
        contacts: message.contacts || []
      };
    case 'button':
      return { type: 'button', buttonId: message.button?.id || message.buttonId || '' };
    default:
      return { type: 'unknown', body: JSON.stringify(message) };
  }
}

module.exports = {
  initialize,
  processMessage,
  processButton,
  getSessionState,
  resetSession
};