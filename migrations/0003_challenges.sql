PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  challenger TEXT NOT NULL,
  opponent TEXT NOT NULL,
  game TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  game_state TEXT NOT NULL DEFAULT '{}',
  message_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (challenger) REFERENCES users(id),
  FOREIGN KEY (opponent) REFERENCES users(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS word_reflections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  reflection TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, date_key),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
