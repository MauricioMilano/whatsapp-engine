/**
 * Signature verification for webhook security
 * Validates that requests come from Meta
 */

const crypto = require('crypto');

/**
 * Verify X-Hub-Signature-256 header from Meta
 * 
 * @param {string} payload - Raw request body as string
 * @param {string} signature - Value of X-Hub-Signature-256 header
 * @param {string} appSecret - Your app secret from Meta Developer Console
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(payload, signature, appSecret) {
  if (!signature || !appSecret) {
    return false;
  }

  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(payload, 'utf8')
    .digest('hex');

  const signature64 = `sha256=${expectedSig}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature64, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (e) {
    return false;
  }
}

module.exports = { verifySignature };