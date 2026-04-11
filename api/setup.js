import { supabase } from '../lib/db.js';
import { CORS_HEADERS } from '../lib/cors.js';

// One-time setup endpoint - creates all tables via Supabase RPC
// Call POST /api/setup with the bearer token to initialize the database
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).set(CORS_HEADERS).end();
  }

  // Require bearer token for security
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const configured = (process.env.API_BEARER_TOKEN || '').split(',').map(v => v.trim()).filter(Boolean);
  if (!configured.includes(token)) {
    return res.status(401).set(CORS_HEADERS).json({ error: 'Unauthorized' });
  }

  try {
    // Use Supabase's SQL execution via the REST API
    // We'll create tables one by one using supabase-js rpc or direct SQL
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        display_name TEXT,
        avatar TEXT,
        email TEXT,
        username TEXT,
        password_hash TEXT,
        created_at BIGINT DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at BIGINT DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        content TEXT,
        media_type TEXT,
        media_data TEXT,
        duration REAL,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
        UNIQUE(message_id, user_id, emoji)
      )`,
      `CREATE TABLE IF NOT EXISTS read_receipts (
        user_id TEXT PRIMARY KEY,
        last_read_message_id TEXT,
        updated_at BIGINT DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS typing_status (
        user_id TEXT PRIMARY KEY,
        is_typing BOOLEAN DEFAULT false,
        updated_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS moods (
        user_id TEXT PRIMARY KEY,
        emoji TEXT,
        text TEXT,
        updated_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS game_players (
        user_id TEXT PRIMARY KEY,
        position INTEGER DEFAULT 0,
        points INTEGER DEFAULT 0,
        updated_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS game_tasks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        task_type TEXT,
        title TEXT NOT NULL,
        description TEXT,
        points_awarded INTEGER DEFAULT 1,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS game_events (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        delta_position INTEGER DEFAULT 0,
        delta_points INTEGER DEFAULT 0,
        task_id TEXT,
        note TEXT,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        challenger TEXT NOT NULL,
        opponent TEXT NOT NULL,
        game TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        game_state JSONB DEFAULT '{}',
        message_id TEXT,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS word_reflections (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL,
        date_key TEXT NOT NULL,
        reflection TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
        UNIQUE(user_id, date_key)
      )`,
      `CREATE TABLE IF NOT EXISTS daily_sparks (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        spark_date TEXT UNIQUE NOT NULL,
        spark_type TEXT,
        content TEXT NOT NULL,
        source TEXT,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS spark_shares (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        spark_id TEXT,
        user_id TEXT NOT NULL,
        message_id TEXT,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`,
      `CREATE TABLE IF NOT EXISTS spark_reflections (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        spark_id TEXT,
        user_id TEXT NOT NULL,
        reflection_text TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
        UNIQUE(spark_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS factoids (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL,
        about TEXT,
        text TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
      )`
    ];

    const results = [];
    for (const sql of tables) {
      const { error } = await supabase.rpc('exec_sql', { query: sql });
      if (error) {
        results.push({ sql: sql.slice(0, 60) + '...', error: error.message });
      } else {
        results.push({ sql: sql.slice(0, 60) + '...', status: 'ok' });
      }
    }

    // Seed users
    const { error: seedError } = await supabase.from('users').upsert([
      { id: 'raphael', display_name: 'Raphael', avatar: '🌻' },
      { id: 'taylor', display_name: 'Taylor', avatar: '🌿' }
    ], { onConflict: 'id' });

    results.push({ action: 'seed_users', status: seedError ? seedError.message : 'ok' });

    res.status(200).set(CORS_HEADERS).json({ results });
  } catch (err) {
    res.status(500).set(CORS_HEADERS).json({ error: err.message });
  }
}
