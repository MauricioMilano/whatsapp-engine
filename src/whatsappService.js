/**
 * WhatsApp Cloud API - Send Messages
 */

const axios = require('axios');

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const API_VERSION = 'v25.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Send a message to WhatsApp
 *
 * @param {string|object} recipient - Phone number string or object with 'id' for responses
 * @param {object} messageData - Message content based on type
 * @param {string} messageType - Message type: text, image, document, audio, video, template, interactive, etc.
 * @param {object} [extraFields] - Optional extra top-level fields merged into the payload
 *                                 (e.g. { recipient_type: 'individual' } for interactive messages)
 * @returns {Promise<object>} - API response
 */
async function sendWhatsAppMessage(recipient, messageData, messageType = 'text', extraFields = {}) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error('ACCESS_TOKEN and PHONE_NUMBER_ID must be configured');
  }

  const url = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;

  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: messageType,
    [messageType]: messageData,
    ...extraFields
  };

  try {
    console.log('📤 Sending message:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(url, payload, { headers });
    
    console.log('✅ Message sent successfully:', response.data);
    return response.data;

  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.error('❌ Failed to send message:', errorMsg);
    throw errorMsg;
  }
}

/**
 * Send text message
 *
 * @param {string} to - recipient phone number
 * @param {string} text - message body
 * @param {boolean} [previewUrl=false] - enable link previews; only included in payload when true
 */
async function sendText(to, text, previewUrl = false) {
  const textData = { body: text };
  if (previewUrl) {
    textData.preview_url = true;
  }
  return sendWhatsAppMessage(to, textData, 'text');
}

/**
 * Send image by ID or URL
 */
async function sendImage(to, imageIdOrUrl, caption = null) {
  const imageData = imageIdOrUrl.startsWith('http') 
    ? { link: imageIdOrUrl, caption }
    : { id: imageIdOrUrl, caption };
  
  return sendWhatsAppMessage(to, imageData, 'image');
}

/**
 * Send document by ID or URL
 */
async function sendDocument(to, documentIdOrUrl, filename = null, caption = null) {
  const docData = documentIdOrUrl.startsWith('http')
    ? { link: documentIdOrUrl, filename, caption }
    : { id: documentIdOrUrl, filename, caption };
  
  return sendWhatsAppMessage(to, docData, 'document');
}

/**
 * Send template message
 */
async function sendTemplate(to, templateName, languageCode = 'pt_BR', components = []) {
  return sendWhatsAppMessage(to, {
    name: templateName,
    language: { code: languageCode },
    components
  }, 'template');
}

/**
 * Send an interactive message with Quick Reply buttons.
 *
 * @param {string} to - recipient phone number
 * @param {string} bodyText - main body text
 * @param {Array<{id: string, title: string}>} buttons - up to 13 reply buttons
 * @param {object} [options] - optional sections
 * @param {string} [options.header] - header text (rendered as a text header)
 * @param {string} [options.footer] - footer text rendered below the body
 * @returns {Promise<object>}
 */
async function sendInteractiveButtons(to, bodyText, buttons = [], options = {}) {
  if (!Array.isArray(buttons) || buttons.length === 0) {
    throw new Error('sendInteractiveButtons requires at least one button');
  }
  if (buttons.length > 3) {
    throw new Error(`sendInteractiveButtons: max 3 buttons (got ${buttons.length})`);
  }
  for (const b of buttons) {
    if (!b.id || !b.title) {
      throw new Error('Each button must have id and title');
    }
    if (b.title.length > 25) {
      console.warn(`Button "${b.id}" title exceeds 25 chars - truncating`);
    }
  }

  const interactive = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.map(b => ({
        type: 'reply',
        reply: {
          id: b.id,
          title: b.title.slice(0, 25)
        }
      }))
    }
  };

  if (options.header) {
    interactive.header = {
      type: 'text',
      text: options.header
    };
  }

  if (options.footer) {
    interactive.footer = {
      text: options.footer
    };
  }

  return sendWhatsAppMessage(to, interactive, 'interactive', { recipient_type: 'individual' });
}

/**
 * Upload media file
 */
async function uploadMedia(filePath, mimeType) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error('ACCESS_TOKEN and PHONE_NUMBER_ID must be configured');
  }

  const url = `${BASE_URL}/${PHONE_NUMBER_ID}/media`;

  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('file_length', fileSize);
  formData.append('mime_type', mimeType);
  formData.append('type', mimeType.split('/')[0]); // image, video, audio, document

  // Note: For actual file upload, use FormData with the file buffer
  // This is a simplified example

  try {
    const response = await axios.post(url, formData, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    console.log('📤 Media uploaded:', response.data);
    return response.data; // { id: "MEDIA_ID" }

  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message;
    console.error('❌ Media upload failed:', errorMsg);
    throw errorMsg;
  }
}

/**
 * Express route handler - POST /messages
 */
async function sendMessage(req, res) {
  try {
    const { to, type, text, image, document, template, interactive, ...rest } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Missing required field: to' });
    }

    let result;

    switch (type) {
      case 'text':
        result = await sendText(to, text);
        break;

      case 'image':
        result = await sendImage(to, image.id || image.link, image.caption);
        break;

      case 'document':
        result = await sendDocument(to, document.id || document.link, document.filename, document.caption);
        break;

      case 'template':
        result = await sendTemplate(to, template.name, template.language, template.components);
        break;

      case 'interactive':
        result = await sendInteractiveButtons(
          to,
          interactive.body?.text,
          interactive.action?.buttons || [],
          {
            header: interactive.header?.text,
            footer: interactive.footer?.text
          }
        );
        break;

      default:
        return res.status(400).json({ error: `Unknown message type: ${type}` });
    }

    res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: error.message || error });
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendText,
  sendImage,
  sendDocument,
  sendTemplate,
  sendInteractiveButtons,
  sendMessage
};