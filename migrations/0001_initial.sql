PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','voice','photo','video')),
  content TEXT,
  media_data TEXT,
  media_key TEXT,
  media_type TEXT,
  duration TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (message_id, user_id, emoji),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_reactions_created_at ON reactions(created_at);

CREATE TABLE IF NOT EXISTS read_receipts (
  user_id TEXT PRIMARY KEY,
  last_read_message_id TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (last_read_message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS typing_status (
  user_id TEXT PRIMARY KEY,
  is_typing INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS moods (
  user_id TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS game_players (
  user_id TEXT PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS game_tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS game_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  delta_position INTEGER DEFAULT 0,
  delta_points INTEGER DEFAULT 0,
  task_id TEXT,
  note TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES game_tasks(id)
);
CREATE INDEX IF NOT EXISTS idx_game_events_created_at ON game_events(created_at);

CREATE TABLE IF NOT EXISTS daily_sparks (
  id TEXT PRIMARY KEY,
  spark_date TEXT NOT NULL UNIQUE,
  spark_type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spark_shares (
  id TEXT PRIMARY KEY,
  spark_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (spark_id) REFERENCES daily_sparks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS spark_reflections (
  id TEXT PRIMARY KEY,
  spark_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reflection_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (spark_id) REFERENCES daily_sparks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
