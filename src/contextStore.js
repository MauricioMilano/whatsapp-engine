/**
 * ContextStore - PostgreSQL-based user context persistence
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
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
  return pool;
}

/**
 * Create the user_contexts table if it doesn't exist
 */
async function initDatabase() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_contexts (
        user_id     TEXT PRIMARY KEY,
        state       TEXT,
        variables   JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_contexts_updated_at
        ON user_contexts(updated_at);
    `);
    console.log('✅ user_contexts table ready');
  } finally {
    client.release();
  }
}

/**
 * Get user context. If none exists or session expired, returns a fresh context
 * with default variables.
 */
async function getContext(userId, defaultVariables = {}) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      'SELECT state, variables, updated_at FROM user_contexts WHERE user_id = $1',
      [userId]
    );

    if (res.rows.length === 0) {
      return {
        state: null,
        variables: { ...defaultVariables },
        isNew: true
      };
    }

    const row = res.rows[0];
    return {
      state: row.state,
      variables: row.variables || { ...defaultVariables },
      isNew: false
    };
  } catch (err) {
    console.error('Error getting context:', err.message);
    return {
      state: null,
      variables: { ...defaultVariables },
      isNew: true
    };
  } finally {
    client.release();
  }
}

/**
 * Insert or update user context
 */
async function updateContext(userId, state, variables) {
  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO user_contexts (user_id, state, variables, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         state = EXCLUDED.state,
         variables = EXCLUDED.variables,
         updated_at = NOW()`,
      [userId, state, JSON.stringify(variables || {})]
    );
  } catch (err) {
    console.error('Error updating context:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Delete a user context
 */
async function deleteContext(userId) {
  const client = await getPool().connect();
  try {
    await client.query('DELETE FROM user_contexts WHERE user_id = $1', [userId]);
  } catch (err) {
    console.error('Error deleting context:', err.message);
  } finally {
    client.release();
  }
}

/**
 * Delete contexts whose last update is older than timeoutMs milliseconds.
 * Returns the number of rows deleted.
 */
async function cleanupExpiredSessions(timeoutMs) {
  const client = await getPool().connect();
  try {
    const res = await client.query(
      'DELETE FROM user_contexts WHERE updated_at < NOW() - ($1::int * INTERVAL \'1 millisecond\')',
      [timeoutMs]
    );
    if (res.rowCount > 0) {
      console.log(`🧹 Cleaned up ${res.rowCount} expired session(s)`);
    }
    return res.rowCount;
  } catch (err) {
    console.error('Error cleaning up sessions:', err.message);
    return 0;
  } finally {
    client.release();
  }
}

/**
 * Close the connection pool (used in tests and graceful shutdown)
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initDatabase,
  getContext,
  updateContext,
  deleteContext,
  cleanupExpiredSessions,
  closePool
};
