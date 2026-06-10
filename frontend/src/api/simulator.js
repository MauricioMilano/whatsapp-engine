const BASE = '/sim';

/**
 * Get dialogue info (intents, entities, actions).
 */
export async function getInfo() {
  const res = await fetch(`${BASE}/api/info`);
  if (!res.ok) throw new Error('Failed to fetch info');
  return res.json();
}

/**
 * Create a new conversation.
 * @param {string} userId
 * @returns {Promise<{id, userId, createdAt}>}
 */
export async function createConversation(userId) {
  const res = await fetch(`${BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

/**
 * List recent conversations.
 */
export async function listConversations(limit = 20) {
  const res = await fetch(`${BASE}/conversations?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to list conversations');
  return res.json();
}

/**
 * Get a conversation by ID.
 */
export async function getConversation(conversationId) {
  const res = await fetch(`${BASE}/conversations/${conversationId}`);
  if (!res.ok) throw new Error('Conversation not found');
  return res.json();
}

/**
 * Get all messages in a conversation.
 */
export async function getMessages(conversationId) {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

/**
 * Send a message in a conversation.
 */
export async function sendMessage(conversationId, text) {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

/**
 * Click a button in a conversation.
 */
export async function clickButton(conversationId, buttonId) {
  const res = await fetch(`${BASE}/conversations/${conversationId}/button`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buttonId })
  });
  if (!res.ok) throw new Error('Failed to click button');
  return res.json();
}

/**
 * Reset the NLP context (variables) for a user, keeping the
 * conversation history intact.
 */
export async function resetSession(userId) {
  const res = await fetch(`${BASE}/sessions/${encodeURIComponent(userId)}/reset`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset session');
  return res.json();
}

/**
 * End a conversation.
 */
export async function endConversation(conversationId) {
  const res = await fetch(`${BASE}/conversations/${conversationId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to end conversation');
  return res.json();
}
