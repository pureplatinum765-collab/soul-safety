# Soul Safety

Soul Safety is now configured for **Cloudflare Pages Functions + D1**.

## Stack

- Static frontend: `index.html`, `app.js`, `style.css`
- API runtime: Cloudflare Pages Functions (`functions/api/[[path]].js`)
- Database: Cloudflare D1 (`DB` binding)

## Auth

All `/api/*` routes require bearer auth.

- Server env var: `API_BEARER_TOKEN` (single token or comma-separated list)
- Client: `window.SOUL_SAFETY_BEARER_TOKEN` or `localStorage['soulSafetyBearerToken']`

## Database

Migrations are in `migrations/`.

- `0001_initial.sql`: full schema
- `0002_seed.sql`: seed users + game state
  - Raphael (`raphael`) → position `6`, points `1`
  - Taylor (`taylor`) → position `0`, points `0`

### Apply migrations

```bash
npm install
npm run db:migrate:local
# or remote
npm run db:migrate
```

## API surface

### Chat / shared feed
- `GET /api/poll?since=<unixSeconds>`
- `GET /api/messages?since=<unixSeconds>`
- `POST /api/messages/text`
- `POST /api/messages/media`
- `GET /api/messages/:id/media`
- `DELETE /api/messages/:id`

### Reactions, typing, read receipts, mood
- `POST /api/reactions/:messageId`
- `POST /api/typing`
- `POST /api/read`
- `POST /api/mood`

### Game
- `GET /api/game/state`
- `GET /api/game/tasks`
- `POST /api/game/move`
- `POST /api/game/task-complete`

### Daily Spark
- `GET /api/daily-spark/today?date=YYYY-MM-DD`
- `POST /api/daily-spark/share`
- `POST /api/daily-spark/reflect`
