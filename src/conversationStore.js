/**
 * Conversation Store
 *
 * Persists debug conversation history in PostgreSQL.
 * Separate from contextStore which holds user context variables.
 */

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000
  });
  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
  return pool;
}

/**
 * Initialize conversation tables.
 */
async function initConversationStore() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at      TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        direction       TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
        content         JSONB NOT NULL,
        intent          TEXT,
        intent_score    FLOAT,
        all_intents     JSONB,
        context_vars    JSONB,
        buttons         JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv_id
        ON conversation_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at
        ON conversation_messages(created_at);
    `);
    console.log('✅ conversation tables ready');
  } finally {
    client.release();
  }
}

/**
 * Create a new conversation.
 */
async function createConversation(userId) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `INSERT INTO conversations (user_id)
       VALUES ($1)
       RETURNING id, user_id as "userId", created_at as "createdAt", ended_at as "endedAt"`,
      [userId]
    );
    return res.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Get a conversation by ID.
 */
async function getConversation(conversationId) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `SELECT c.id, c.user_id as "userId", c.created_at as "createdAt", c.ended_at as "endedAt",
              COUNT(m.id)::int as "messageCount"
       FROM conversations c
       LEFT JOIN conversation_messages m ON m.conversation_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [conversationId]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * End a conversation.
 */
async function endConversation(conversationId) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `UPDATE conversations
       SET ended_at = NOW()
       WHERE id = $1
       RETURNING id, user_id as "userId", created_at as "createdAt", ended_at as "endedAt"`,
      [conversationId]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Delete a conversation and all its messages.
 */
async function deleteConversation(conversationId) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `DELETE FROM conversations WHERE id = $1 RETURNING id`,
      [conversationId]
    );
    return res.rowCount > 0;
  } finally {
    client.release();
  }
}

/**
 * Add a message to a conversation.
 */
async function addMessage(conversationId, message) {
  const client = await getPool().connect();
  try {
    const {
      direction,
      content,
      intent = null,
      intentScore = null,
      allIntents = null,
      contextVars = null
    } = message;

    const res = await client.query(
      `INSERT INTO conversation_messages
         (conversation_id, direction, content, intent, intent_score, all_intents, context_vars, buttons)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
       RETURNING id, conversation_id as "conversationId", direction, content,
                 intent, intent_score as "intentScore", all_intents as "allIntents",
                 context_vars as "contextVars", buttons, created_at as "createdAt"`,
      [
        conversationId,
        direction,
        JSON.stringify(content),
        intent,
        intentScore,
        allIntents ? JSON.stringify(allIntents) : null,
        contextVars ? JSON.stringify(contextVars) : null,
        message.buttons ? JSON.stringify(message.buttons) : null
      ]
    );
    return res.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Get all messages in a conversation.
 */
async function getMessages(conversationId) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `SELECT id, conversation_id as "conversationId", direction, content,
              intent, intent_score as "intentScore", all_intents as "allIntents",
              context_vars as "contextVars", buttons, created_at as "createdAt"
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

/**
 * Get recent conversations for a user (for listing).
 */
async function getRecentConversations(limit = 20) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      `SELECT c.id, c.user_id as "userId", c.created_at as "createdAt",
              c.ended_at as "endedAt",
              COUNT(m.id)::int as "messageCount",
              MAX(m.created_at) as "lastMessageAt"
       FROM conversations c
       LEFT JOIN conversation_messages m ON m.conversation_id = c.id
       GROUP BY c.id
       ORDER BY MAX(m.created_at) DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } finally {
    client.release();
  }
}

module.exports = {
  initConversationStore,
  createConversation,
  getConversation,
  endConversation,
  deleteConversation,
  addMessage,
  getMessages,
  getRecentConversations,
  closePool: () => pool ? pool.end() : Promise.resolve()
};