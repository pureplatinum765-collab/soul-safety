-- Soul Safety Database Schema for Supabase
-- Run this in the Supabase SQL Editor to create all tables

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  avatar TEXT,
  email TEXT,
  username TEXT,
  password_hash TEXT,
  created_at BIGINT DEFAULT extract(epoch from now())::bigint
);

INSERT INTO users (id, display_name, avatar) VALUES 
  ('raphael', 'Raphael', '🌻'),
  ('taylor', 'Taylor', '🌿')
ON CONFLICT (id) DO NOTHING;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at BIGINT NOT NULL,
  created_at BIGINT DEFAULT extract(epoch from now())::bigint
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_type TEXT,
  media_data TEXT,
  duration REAL,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
  UNIQUE(message_id, user_id, emoji)
);

-- Read receipts
CREATE TABLE IF NOT EXISTS read_receipts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  last_read_message_id TEXT,
  updated_at BIGINT DEFAULT extract(epoch from now())::bigint
);

-- Typing status
CREATE TABLE IF NOT EXISTS typing_status (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  is_typing BOOLEAN DEFAULT false,
  updated_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Moods
CREATE TABLE IF NOT EXISTS moods (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  emoji TEXT,
  text TEXT,
  updated_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Game players
CREATE TABLE IF NOT EXISTS game_players (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  position INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Game tasks
CREATE TABLE IF NOT EXISTS game_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  points_awarded INTEGER DEFAULT 1,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Game events
CREATE TABLE IF NOT EXISTS game_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  delta_position INTEGER DEFAULT 0,
  delta_points INTEGER DEFAULT 0,
  task_id TEXT,
  note TEXT,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  challenger TEXT NOT NULL REFERENCES users(id),
  opponent TEXT NOT NULL REFERENCES users(id),
  game TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  game_state JSONB DEFAULT '{}',
  message_id TEXT,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Word reflections
CREATE TABLE IF NOT EXISTS word_reflections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  date_key TEXT NOT NULL,
  reflection TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
  UNIQUE(user_id, date_key)
);

-- Daily sparks
CREATE TABLE IF NOT EXISTS daily_sparks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spark_date TEXT UNIQUE NOT NULL,
  spark_type TEXT,
  content TEXT NOT NULL,
  source TEXT,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Spark shares
CREATE TABLE IF NOT EXISTS spark_shares (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spark_id TEXT REFERENCES daily_sparks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  message_id TEXT,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
);

-- Spark reflections
CREATE TABLE IF NOT EXISTS spark_reflections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spark_id TEXT REFERENCES daily_sparks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  reflection_text TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
  UNIQUE(spark_id, user_id)
);

-- Disable RLS on all tables for simplicity (auth is handled at the API layer)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON messages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON reactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE read_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON read_receipts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON typing_status FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON moods FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON game_players FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON game_tasks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON game_events FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON challenges FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE word_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON word_reflections FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE daily_sparks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON daily_sparks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE spark_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON spark_shares FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE spark_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON spark_reflections FOR ALL USING (true) WITH CHECK (true);
