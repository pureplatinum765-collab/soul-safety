PRAGMA foreign_keys = ON;

INSERT INTO users (id, display_name) VALUES
  ('hippiehugs', 'Raphael'),
  ('taylor', 'Taylor')
ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name;

INSERT INTO game_players (user_id, position, points, updated_at) VALUES
  ('hippiehugs', 6, 1, unixepoch()),
  ('taylor', 0, 0, unixepoch())
ON CONFLICT(user_id) DO UPDATE SET
  position = excluded.position,
  points = excluded.points,
  updated_at = excluded.updated_at;

INSERT INTO game_tasks (id, task_type, title, description, points_awarded, created_at) VALUES
  ('task-quote-001', 'quote', 'Quote Task', 'Completed quote task', 1, unixepoch())
ON CONFLICT(id) DO NOTHING;

INSERT INTO game_events (id, user_id, event_type, delta_position, delta_points, task_id, note, created_at)
VALUES (
  'seed-event-raphael-quote',
  'hippiehugs',
  'task_completed',
  6,
  1,
  'task-quote-001',
  'Seeded initial game progress',
  unixepoch()
)
ON CONFLICT(id) DO NOTHING;
