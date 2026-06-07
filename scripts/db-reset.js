#!/usr/bin/env node
/**
 * db-reset.js — clear the whatsapp_bot database.
 *
 * Modes (first CLI arg):
 *   truncate  — DELETE rows from user_contexts, keep schema. Fast, idempotent.
 *   schema    — DROP SCHEMA public CASCADE + CREATE SCHEMA public.
 *               The NlpDialogueEngine auto-recreates the user_contexts table
 *               on next startup via initDatabase().
 *   full      — schema reset + docker compose down -v (wipes the volume too).
 *               Use this when you also want a fresh Postgres container state.
 *
 * Reads DATABASE_URL from the process environment (or .env via dotenv).
 *
 * Usage:
 *   node scripts/db-reset.js truncate
 *   node scripts/db-reset.js schema
 *   node scripts/db-reset.js full          # also stops & wipes the compose stack
 */

require('dotenv').config();
const { Client } = require('pg');
const { execSync } = require('child_process');

const mode = (process.argv[2] || 'truncate').toLowerCase();
const validModes = ['truncate', 'schema', 'full'];

if (!validModes.includes(mode)) {
  console.error(`❌ Unknown mode "${mode}". Use one of: ${validModes.join(', ')}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Configure it in .env or your shell.');
  process.exit(1);
}

async function truncate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query('TRUNCATE TABLE user_contexts');
    console.log(`✅ Truncated user_contexts (rows removed: ${res.rowCount ?? 0}).`);
  } finally {
    await client.end();
  }
}

async function resetSchema() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    // Re-grant default privileges so the app user can create tables again.
    await client.query('GRANT ALL ON SCHEMA public TO PUBLIC');
    console.log('✅ Dropped & recreated the public schema. The app will recreate tables on next start.');
  } finally {
    await client.end();
  }
}

function dockerReset() {
  console.log('🛑 Stopping the stack and wiping the postgres_data volume...');
  execSync('docker compose down -v', { stdio: 'inherit' });
  console.log('✅ Stack stopped and volume removed.');
}

(async () => {
  console.log(`🔌 Connecting to ${redact(process.env.DATABASE_URL)} ...`);
  try {
    if (mode === 'full') {
      dockerReset();
    } else if (mode === 'schema') {
      await resetSchema();
    } else {
      await truncate();
    }
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
  }
})();

/** Hide the password in DATABASE_URL so it doesn't leak into logs. */
function redact(url) {
  return url.replace(/:[^:@/]+@/, ':****@');
}
