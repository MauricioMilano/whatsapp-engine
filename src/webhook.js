/**
 * Webhook Handler - Receive WhatsApp messages
 */

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ENABLE_NLP_DIALOGUE = process.env.ENABLE_NLP_DIALOGUE === 'true';

let nlpEngine = null;
let sendInteractiveButtons = null;

if (ENABLE_NLP_DIALOGUE) {
  // Lazy-loaded so missing optional deps don't crash the webhook
  try {
    const NlpDialogueEngine = require('./nlpDialogueEngine');
    nlpEngine = NlpDialogueEngine.getInstance();
    ({ sendInteractiveButtons } = require('./whatsappService'));
  } catch (err) {
    console.warn('⚠️ NLP dialogue engine not available:', err.message);
  }
}

/**
 * Verify webhook - GET /webhook
 * Meta sends this to verify the webhook URL during setup
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Webhook verification attempt:', { mode, token });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.status(403).send('Forbidden - Verify token mismatch');
  }
}

/**
 * Handle incoming messages - POST /webhook
 * Meta sends messages here when users send WhatsApp messages
 */
function handleWebhook(req, res) {
  const body = req.body;

  // Validate it's a WhatsApp Business Account event
  if (body.object !== 'whatsapp_business_account') {
    console.log('Ignoring non-WhatsApp event');
    return res.status(404).send('Not a WhatsApp event');
  }

  console.log('📩 Incoming webhook event');

  // Process each entry (usually just one)
  body.entry.forEach(entry => {
    // Process each change (field can be "messages" or "policy_updates")
    entry.changes.forEach(change => {
      const value = change.value;
      const field = change.field;

      console.log(`Processing ${field} change`);

      // Handle incoming messages
      if (value.messages) {
        processMessages(value.messages);
      }

      // Handle status updates (delivery receipts, reads, etc)
      if (value.statuses) {
        processStatusUpdates(value.statuses);
      }

      // Handle policy updates (rare)
      if (value.policy_enforcement) {
        console.log('Policy enforcement:', value.policy_enforcement);
      }
    });
  });

  // Always acknowledge receipt quickly (within 5 seconds)
  res.status(200).send('EVENT_RECEIVED');
}

/**
 * Process incoming text messages
 */
function processMessages(messages) {
  messages.forEach(message => {
    const { from, id, timestamp, type, text, image, audio, video, document, location, contacts, interactive } = message;

    console.log(`📱 Message from ${from}:`, { id, timestamp, type });

    switch (type) {
      case 'text':
        console.log(`📥 In: "${text.body}"`);
        if (ENABLE_NLP_DIALOGUE && nlpEngine && nlpEngine.initialized) {
          respondWithNlpDialogue(from, text.body).catch(err =>
            console.error('NLP dialogue error:', err)
          );
        }
        break;

      case 'interactive':
        // Quick Reply button click
        if (interactive?.button_reply?.id && ENABLE_NLP_DIALOGUE && nlpEngine && nlpEngine.initialized) {
          console.log(`📬 Button: ${interactive.button_reply.id} | From: ${from}`);
          respondWithNlpButton(from, interactive.button_reply.id).catch(err =>
            console.error('NLP dialogue error:', err)
          );
        }
        break;

      case 'image':
        console.log(`   Image ID: ${image.id}`, image.caption ? `Caption: ${image.caption}` : '');
        break;

      case 'audio':
        console.log(`   Audio ID: ${audio.id}`);
        break;

      case 'video':
        console.log(`   Video ID: ${video.id}`, video.caption ? `Caption: ${video.caption}` : '');
        break;

      case 'document':
        console.log(`   Document: ${document.filename || document.id}`);
        break;

      case 'location':
        console.log(`   Location: ${location.latitude}, ${location.longitude} - ${location.name || ''}`);
        break;

      case 'contacts':
        console.log(`   Contacts: ${contacts.length} contact(s)`);
        break;

      case 'sticker':
        console.log(`   Sticker ID: ${sticker.id}`);
        break;

      default:
        console.log(`   Unknown message type: ${type}`);
    }
  });
}

/**
 * Run the user utterance through the NLP dialogue engine and send the response.
 */
async function respondWithNlpDialogue(userId, utterance) {
  if (!nlpEngine || !sendInteractiveButtons) return;
  const response = await nlpEngine.processInput(userId, utterance);
  await dispatchResponse(userId, response);
}

/**
 * Run a button click through the NLP dialogue engine and send the response.
 */
async function respondWithNlpButton(userId, buttonId) {
  if (!nlpEngine || !sendInteractiveButtons) return;
  const response = await nlpEngine.processButton(userId, buttonId);
  await dispatchResponse(userId, response);
}

/**
 * Send the engine response back to WhatsApp. Falls back to plain text
 * if there are no buttons.
 */
async function dispatchResponse(userId, response) {
  if (!response) return;
  if (response.buttons && response.buttons.length > 0) {
    await sendInteractiveButtons(userId, response.text, response.buttons, {
      header: response.header,
      footer: response.footer
    });
  } else {
    const { sendText } = require('./whatsappService');
    await sendText(userId, response.text);
  }
}

/**
 * Process status updates (delivered, read, failed)
 */
function processStatusUpdates(statuses) {
  statuses.forEach(status => {
    const { id, status: statusType, timestamp, recipient_id, conversation, pricing } = status;

    const statusEmoji = {
      sent: '📤',
      delivered: '📬',
      read: '📖',
      failed: '❌',
      pending: '⏳'
    };
    if (process.env.STATUS_LOGGING === 'verbose') {
      console.log(`${statusEmoji[statusType] || '❓'} Status for ${recipient_id}: ${statusType}`);
      console.log(`   Message ID: ${id}`);
      console.log(`   Time: ${new Date(timestamp * 1000).toISOString()}`);
    }
    if (conversation) {
      console.log(`   Conversation: ${conversation.id} (${conversation.origin.type})`);
    }

    if (pricing) {
      console.log(`   Pricing: billable=${pricing.billable}, category=${pricing.category}`);
    }

    if (statusType === 'failed' && status.error) {
      console.log(`   ❗ Error: ${status.error.message} (code: ${status.error.code})`);
    }
  });
}

module.exports = { verifyWebhook, handleWebhook };