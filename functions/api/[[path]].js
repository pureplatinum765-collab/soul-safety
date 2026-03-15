const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Content-Type": "application/json"
};

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders }
  });
}

function textResponse(status, body, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders }
  });
}

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseAuthToken(request) {
  const raw = request.headers.get("Authorization") || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    raw
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const idx = chunk.indexOf("=");
        if (idx <= 0) return ["", ""];
        return [decodeURIComponent(chunk.slice(0, idx)), decodeURIComponent(chunk.slice(idx + 1))];
      })
      .filter(([k]) => k)
  );
}

function hashPassword(password) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)).then((buf) => {
    const bytes = new Uint8Array(buf);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

function buildSessionCookie(token, maxAgeSeconds) {
  return `soul_safety_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

const tableColumnsCache = new Map();

async function getTableColumns(env, tableName) {
  const cacheKey = tableName;
  if (tableColumnsCache.has(cacheKey)) return tableColumnsCache.get(cacheKey);
  const columns = await queryAll(env, `PRAGMA table_info(${tableName})`);
  const names = new Set(columns.map((c) => c.name));
  tableColumnsCache.set(cacheKey, names);
  return names;
}

async function resolveSessionUser(request, env) {
  const sessionColumns = await getTableColumns(env, "sessions");
  if (sessionColumns.size === 0) return null;

  const token = parseAuthToken(request) || parseCookies(request).soul_safety_session || "";
  if (!token) return null;

  const tokenField = sessionColumns.has("token") ? "token" : sessionColumns.has("id") ? "id" : null;
  const userField = sessionColumns.has("user_id") ? "user_id" : sessionColumns.has("userId") ? "userId" : null;
  if (!tokenField || !userField) return null;

  const expField = sessionColumns.has("expires_at") ? "expires_at" : sessionColumns.has("expiresAt") ? "expiresAt" : null;
  const selectFields = [userField, expField].filter(Boolean).join(", ");
  const session = await queryFirst(env, `SELECT ${selectFields} FROM sessions WHERE ${tokenField} = ?`, token);
  if (!session) return null;

  if (expField && session[expField] && Number(session[expField]) < nowTs()) {
    await execute(env, `DELETE FROM sessions WHERE ${tokenField} = ?`, token);
    return null;
  }

  return { userId: session[userField], token };
}

async function isAuthorized(request, env) {
  const configured = (env.API_BEARER_TOKEN || "").split(",").map((v) => v.trim()).filter(Boolean);
  const provided = parseAuthToken(request);
  if (configured.length > 0 && provided && configured.includes(provided)) return { userId: null, token: provided };
  return resolveSessionUser(request, env);
}

async function safeJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function safeFormData(req) {
  try {
    return await req.formData();
  } catch {
    return null;
  }
}

async function queryAll(env, sql, ...args) {
  const stmt = env.DB.prepare(sql);
  const res = args.length ? await stmt.bind(...args).all() : await stmt.all();
  return res.results || [];
}

async function queryFirst(env, sql, ...args) {
  const stmt = env.DB.prepare(sql);
  return args.length ? await stmt.bind(...args).first() : await stmt.first();
}

async function execute(env, sql, ...args) {
  const stmt = env.DB.prepare(sql);
  return args.length ? await stmt.bind(...args).run() : await stmt.run();
}

async function upsertUser(env, userId) {
  if (!userId) return;
  const displayName = userId === "raphael" ? "Raphael" : userId === "taylor" ? "Taylor" : userId;
  await execute(
    env,
    `INSERT INTO users (id, display_name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name`,
    userId,
    displayName
  );
}

async function findUserByIdentifier(env, identifier) {
  const cols = await getTableColumns(env, "users");
  const conditions = [];
  if (cols.has("email")) conditions.push(["email", identifier.toLowerCase()]);
  if (cols.has("username")) conditions.push(["username", identifier]);
  if (cols.has("id")) conditions.push(["id", identifier]);
  if (conditions.length === 0) return null;

  for (const [field, value] of conditions) {
    const user = await queryFirst(env, `SELECT * FROM users WHERE ${field} = ?`, value);
    if (user) return user;
  }

  return null;
}

async function createSession(env, userId) {
  const sessionColumns = await getTableColumns(env, "sessions");
  if (sessionColumns.size === 0) return null;

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = nowTs() + 60 * 60 * 24 * 30;
  const values = [];
  const params = [];

  if (sessionColumns.has("id")) {
    values.push("id");
    params.push(uuid());
  }
  if (sessionColumns.has("token")) {
    values.push("token");
    params.push(token);
  }
  if (sessionColumns.has("user_id")) {
    values.push("user_id");
    params.push(userId);
  }
  if (sessionColumns.has("expires_at")) {
    values.push("expires_at");
    params.push(expiresAt);
  }
  if (sessionColumns.has("created_at")) {
    values.push("created_at");
    params.push(nowTs());
  }

  const placeholders = values.map(() => "?").join(", ");
  await execute(env, `INSERT INTO sessions (${values.join(", ")}) VALUES (${placeholders})`, ...params);
  return { token, expiresAt };
}

function decodeBase64ToBytes(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function encodeBytesToBase64(uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < uint8Array.length; i += chunk) {
    const sub = uint8Array.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

async function handlePoll(env, since) {
  const [messages, reactions, typing, reads, moods] = await Promise.all([
    queryAll(
      env,
      `SELECT id, user_id, type, content, media_data, media_type, duration, created_at AS timestamp
       FROM messages
       WHERE created_at > ?
       ORDER BY created_at ASC`,
      since
    ),
    queryAll(
      env,
      `SELECT id, message_id, user_id, emoji, created_at AS timestamp
       FROM reactions
       WHERE created_at > ?
       ORDER BY created_at ASC`,
      since
    ),
    queryAll(env, `SELECT user_id, is_typing, updated_at FROM typing_status`),
    queryAll(env, `SELECT user_id, last_read_message_id FROM read_receipts`),
    queryAll(env, `SELECT user_id, emoji, text FROM moods`)
  ]);

  const current = nowTs();
  const typingUsers = typing
    .filter((t) => Number(t.is_typing) === 1 && current - Number(t.updated_at) < 5)
    .map((t) => t.user_id);

  const readMap = Object.fromEntries(reads.map((r) => [r.user_id, r.last_read_message_id]));
  const moodMap = Object.fromEntries(moods.map((m) => [m.user_id, { emoji: m.emoji, text: m.text }]));

  return {
    messages: messages.map((m) => ({ ...m, media_data: undefined })),
    reactions,
    typing: typingUsers,
    read_receipts: readMap,
    moods: moodMap,
    server_time: current
  };
}


function resolveActingUserId(authUserId, payloadUserId) {
  if (authUserId) {
    if (payloadUserId && payloadUserId !== authUserId) return null;
    return authUserId;
  }
  return payloadUserId || null;
}

async function ensureGamePlayer(env, userId) {
  if (!userId) return;
  await upsertUser(env, userId);
  await execute(
    env,
    `INSERT INTO game_players (user_id, position, points, updated_at)
     VALUES (?, 0, 0, ?)
     ON CONFLICT(user_id) DO NOTHING`,
    userId,
    nowTs()
  );
}


async function ensureMinigameTables(env) {
  await execute(
    env,
    `CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      challenger TEXT NOT NULL,
      opponent TEXT NOT NULL,
      game TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      game_state TEXT NOT NULL DEFAULT '{}',
      message_id TEXT,
      created_at INTEGER NOT NULL
    )`
  );

  await execute(
    env,
    `CREATE TABLE IF NOT EXISTS word_reflections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      reflection TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, date_key)
    )`
  );
}

async function handleRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!env.DB) {
    return json(500, { error: "D1 binding DB is not configured" });
  }

  try {
    if (request.method === "POST" && path === "/auth/signup") {
      const body = await safeJson(request);
      const identifier = (body?.email || body?.username || body?.user_id || "").trim();
      const password = typeof body?.password === "string" ? body.password : "";
      if (!identifier || !password) return json(400, { error: "Email/username and password are required" });

      const existing = await findUserByIdentifier(env, identifier);
      if (existing) return json(409, { error: "User already exists" });

      const usersColumns = await getTableColumns(env, "users");
      const userId = body?.user_id || (crypto.randomUUID ? crypto.randomUUID() : uuid());
      const values = [];
      const params = [];
      if (usersColumns.has("id")) { values.push("id"); params.push(userId); }
      if (usersColumns.has("display_name")) { values.push("display_name"); params.push(body?.display_name || identifier); }
      if (usersColumns.has("email")) { values.push("email"); params.push((body?.email || "").toLowerCase()); }
      if (usersColumns.has("username")) { values.push("username"); params.push(body?.username || identifier); }
      if (usersColumns.has("password_hash")) { values.push("password_hash"); params.push(await hashPassword(password)); }
      if (usersColumns.has("created_at")) { values.push("created_at"); params.push(nowTs()); }
      if (values.length === 0) return json(500, { error: "Users table is not writable" });

      await execute(env, `INSERT INTO users (${values.join(", ")}) VALUES (${values.map(() => "?").join(", ")})`, ...params);
      await ensureGamePlayer(env, userId);
      const session = await createSession(env, userId);
      const headers = session ? { "Set-Cookie": buildSessionCookie(session.token, Math.max(1, session.expiresAt - nowTs())) } : {};
      return json(201, { user_id: userId, token: session?.token || null }, headers);
    }

    if (request.method === "POST" && path === "/auth/login") {
      const body = await safeJson(request);
      const identifier = (body?.email || body?.username || body?.user_id || "").trim();
      const password = typeof body?.password === "string" ? body.password : "";
      if (!identifier || !password) return json(400, { error: "Email/username and password are required" });

      const user = await findUserByIdentifier(env, identifier);
      if (!user) return json(401, { error: "Invalid credentials" });

      if (Object.hasOwn(user, "password_hash")) {
        const passwordHash = await hashPassword(password);
        if (user.password_hash !== passwordHash) return json(401, { error: "Invalid credentials" });
      }

      const userId = user.user_id || user.id || identifier;
      await ensureGamePlayer(env, userId);
      const session = await createSession(env, userId);
      if (!session) return json(500, { error: "Sessions table is not configured" });
      return json(200, { user_id: userId, token: session.token }, { "Set-Cookie": buildSessionCookie(session.token, Math.max(1, session.expiresAt - nowTs())) });
    }

    if (request.method === "GET" && path === "/auth/me") {
      const auth = await isAuthorized(request, env);
      if (!auth) return json(401, { error: "Unauthorized" });
      if (!auth.userId) return json(200, { user_id: null, mode: "bearer" });
      await ensureGamePlayer(env, auth.userId);
      return json(200, { user_id: auth.userId, mode: "session" });
    }

    if (request.method === "POST" && path === "/auth/logout") {
      const token = parseAuthToken(request) || parseCookies(request).soul_safety_session || "";
      if (token) {
        const cols = await getTableColumns(env, "sessions");
        const tokenField = cols.has("token") ? "token" : cols.has("id") ? "id" : null;
        if (tokenField) await execute(env, `DELETE FROM sessions WHERE ${tokenField} = ?`, token);
      }
      return json(200, { ok: true }, { "Set-Cookie": buildSessionCookie("", 0) });
    }

    const auth = await isAuthorized(request, env);
    if (!auth) {
      return json(401, { error: "Unauthorized" });
    }
    if (request.method === "GET" && path === "/messages") {
      const since = Number.parseFloat(url.searchParams.get("since") || "0") || 0;
      const rows = await queryAll(
        env,
        `SELECT id, user_id, type, content, media_data, media_type, duration, created_at AS timestamp
         FROM messages WHERE created_at > ? ORDER BY created_at ASC`,
        since
      );
      return json(200, rows.map((m) => ({ ...m, media_data: undefined })));
    }

    if (request.method === "POST" && path === "/messages/text") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || typeof body?.content !== "string" || body.content.trim() === "") {
        return json(400, { error: "Invalid payload" });
      }
      const id = uuid();
      const timestamp = nowTs();
      await upsertUser(env, actingUserId);
      await execute(
        env,
        `INSERT INTO messages (id, user_id, type, content, created_at)
         VALUES (?, ?, 'text', ?, ?)`,
        id,
        actingUserId,
        body.content,
        timestamp
      );
      return json(201, { id, user_id: actingUserId, type: "text", content: body.content, timestamp });
    }

    if (request.method === "POST" && path === "/messages/media") {
      const formData = await safeFormData(request);
      if (!formData) return json(400, { error: "Invalid form data" });

      const userId = resolveActingUserId(auth.userId, formData.get("user_id"));
      const mediaTypeName = formData.get("media_type_name");
      const duration = formData.get("duration") || null;
      const file = formData.get("file");

      if (!userId || !mediaTypeName || !file || typeof file.arrayBuffer !== "function") {
        return json(400, { error: "Missing required form fields" });
      }

      const allowed = new Set(["voice", "photo", "video"]);
      if (!allowed.has(String(mediaTypeName))) {
        return json(400, { error: "Unsupported media type" });
      }

      const buffer = await file.arrayBuffer();
      const mediaData = encodeBytesToBase64(new Uint8Array(buffer));
      const mediaContentType = file.type || "application/octet-stream";
      const id = uuid();
      const timestamp = nowTs();

      await upsertUser(env, userId);
      await execute(
        env,
        `INSERT INTO messages (id, user_id, type, media_data, media_type, duration, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id,
        userId,
        mediaTypeName,
        mediaData,
        mediaContentType,
        duration,
        timestamp
      );

      return json(201, {
        id,
        user_id: userId,
        type: mediaTypeName,
        media_type: mediaContentType,
        duration,
        timestamp
      });
    }

    const mediaMatch = path.match(/^\/messages\/([^/]+)\/media$/);
    if (request.method === "GET" && mediaMatch) {
      const msg = await queryFirst(env, `SELECT media_data, media_type FROM messages WHERE id = ?`, mediaMatch[1]);
      if (!msg?.media_data) {
        return json(404, { error: "Media not found" });
      }
      const bytes = decodeBase64ToBytes(msg.media_data);
      return textResponse(200, bytes, { "Content-Type": msg.media_type || "application/octet-stream" });
    }

    const reactMatch = path.match(/^\/reactions\/([^/]+)$/);
    if (request.method === "POST" && reactMatch) {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.emoji) return json(400, { error: "Invalid payload" });
      const messageId = reactMatch[1];

      const existing = await queryFirst(
        env,
        `SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
        messageId,
        actingUserId,
        body.emoji
      );

      if (existing?.id) {
        await execute(env, `DELETE FROM reactions WHERE id = ?`, existing.id);
        return json(200, { toggled: "off" });
      }

      const id = uuid();
      const timestamp = nowTs();
      await upsertUser(env, actingUserId);
      await execute(
        env,
        `INSERT INTO reactions (id, message_id, user_id, emoji, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        messageId,
        actingUserId,
        body.emoji,
        timestamp
      );
      return json(201, { toggled: "on" });
    }

    if (request.method === "POST" && path === "/typing") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || typeof body?.is_typing !== "boolean") return json(400, { error: "Invalid payload" });
      await upsertUser(env, actingUserId);
      await execute(
        env,
        `INSERT INTO typing_status (user_id, is_typing, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET is_typing = excluded.is_typing, updated_at = excluded.updated_at`,
        actingUserId,
        body.is_typing ? 1 : 0,
        nowTs()
      );
      return json(200, { ok: true });
    }

    if (request.method === "POST" && path === "/read") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.last_read_message_id) return json(400, { error: "Invalid payload" });
      await upsertUser(env, actingUserId);
      await execute(
        env,
        `INSERT INTO read_receipts (user_id, last_read_message_id, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET last_read_message_id = excluded.last_read_message_id, updated_at = excluded.updated_at`,
        actingUserId,
        body.last_read_message_id,
        nowTs()
      );
      return json(200, { ok: true });
    }

    if (request.method === "POST" && path === "/mood") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.emoji || !body?.text) return json(400, { error: "Invalid payload" });
      await upsertUser(env, actingUserId);
      await execute(
        env,
        `INSERT INTO moods (user_id, emoji, text, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET emoji = excluded.emoji, text = excluded.text, updated_at = excluded.updated_at`,
        actingUserId,
        body.emoji,
        body.text,
        nowTs()
      );
      return json(200, { ok: true });
    }

    if (request.method === "GET" && path === "/poll") {
      const since = Number.parseFloat(url.searchParams.get("since") || "0") || 0;
      return json(200, await handlePoll(env, since));
    }

    const deleteMatch = path.match(/^\/messages\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMatch) {
      const messageId = deleteMatch[1];
      await execute(env, `UPDATE read_receipts SET last_read_message_id = NULL WHERE last_read_message_id = ?`, messageId);
      await execute(env, `UPDATE spark_shares SET message_id = NULL WHERE message_id = ?`, messageId);
      await execute(env, `DELETE FROM messages WHERE id = ?`, messageId);
      return json(200, { deleted: messageId });
    }

    // ===== Game Endpoints =====
    if (request.method === "GET" && (path === "/game/state" || path === "/game")) {
      if (auth.userId) {
        await ensureGamePlayer(env, auth.userId);
      }
      const players = await queryAll(
        env,
        `SELECT user_id, position, points, updated_at FROM game_players ORDER BY user_id ASC`
      );
      const feed = await queryAll(
        env,
        `SELECT id, user_id, event_type, delta_position, delta_points, task_id, note, created_at AS timestamp
         FROM game_events ORDER BY created_at DESC LIMIT 100`
      );
      if (auth.userId) {
        const me = players.find((player) => player.user_id === auth.userId) || null;
        return json(200, { me, players, feed });
      }
      return json(200, { players, feed });
    }

    if (request.method === "POST" && path === "/game/move") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !Number.isInteger(body?.delta_position)) return json(400, { error: "Invalid payload" });
      await ensureGamePlayer(env, actingUserId);
      const player = await queryFirst(env, `SELECT position, points FROM game_players WHERE user_id = ?`, actingUserId);
      if (!player) return json(404, { error: "Player not found" });

      const newPos = Number(player.position) + Number(body.delta_position);
      const ts = nowTs();
      await execute(env, `UPDATE game_players SET position = ?, updated_at = ? WHERE user_id = ?`, newPos, ts, actingUserId);
      await execute(
        env,
        `INSERT INTO game_events (id, user_id, event_type, delta_position, delta_points, note, created_at)
         VALUES (?, ?, 'moved', ?, 0, ?, ?)`,
        uuid(), actingUserId, body.delta_position, body.note || null, ts
      );

      return json(200, { user_id: actingUserId, position: newPos, points: Number(player.points) });
    }

    if (request.method === "POST" && path === "/game/task-complete") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.task_id) return json(400, { error: "Invalid payload" });
      await ensureGamePlayer(env, actingUserId);
      const [player, task] = await Promise.all([
        queryFirst(env, `SELECT position, points FROM game_players WHERE user_id = ?`, actingUserId),
        queryFirst(env, `SELECT id, points_awarded FROM game_tasks WHERE id = ?`, body.task_id)
      ]);
      if (!player) return json(404, { error: "Player not found" });
      if (!task) return json(404, { error: "Task not found" });

      const deltaPoints = Number(task.points_awarded) || 0;
      const newPoints = Number(player.points) + deltaPoints;
      const ts = nowTs();
      await execute(env, `UPDATE game_players SET points = ?, updated_at = ? WHERE user_id = ?`, newPoints, ts, actingUserId);
      await execute(
        env,
        `INSERT INTO game_events (id, user_id, event_type, delta_position, delta_points, task_id, note, created_at)
         VALUES (?, ?, 'task_completed', 0, ?, ?, ?, ?)`,
        uuid(), actingUserId, deltaPoints, body.task_id, body.note || null, ts
      );

      return json(200, { user_id: actingUserId, position: Number(player.position), points: newPoints });
    }

    if (request.method === "GET" && path === "/game/tasks") {
      const tasks = await queryAll(
        env,
        `SELECT id, task_type, title, description, points_awarded, created_at
         FROM game_tasks ORDER BY created_at DESC`
      );
      return json(200, tasks);
    }

    // ===== Daily Spark Endpoints =====
    if (request.method === "GET" && path === "/daily-spark/today") {
      const requestedDate = url.searchParams.get("date");
      const date = requestedDate || new Date().toISOString().slice(0, 10);
      const spark = await queryFirst(
        env,
        `SELECT id, spark_date, spark_type, content, source, created_at
         FROM daily_sparks WHERE spark_date = ?`,
        date
      );
      if (!spark) return json(404, { error: "No spark found", date });

      const [shares, reflections] = await Promise.all([
        queryAll(env, `SELECT id, spark_id, user_id, message_id, created_at FROM spark_shares WHERE spark_id = ? ORDER BY created_at ASC`, spark.id),
        queryAll(env, `SELECT id, spark_id, user_id, reflection_text, created_at FROM spark_reflections WHERE spark_id = ? ORDER BY created_at ASC`, spark.id)
      ]);
      return json(200, { spark, shares, reflections });
    }

    if (request.method === "POST" && path === "/daily-spark/share") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.spark_id) return json(400, { error: "Invalid payload" });
      await upsertUser(env, actingUserId);
      const id = uuid();
      const ts = nowTs();
      await execute(
        env,
        `INSERT INTO spark_shares (id, spark_id, user_id, message_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        body.spark_id,
        actingUserId,
        body.message_id || null,
        ts
      );
      return json(201, { id, spark_id: body.spark_id, user_id: actingUserId, message_id: body.message_id || null, created_at: ts });
    }

    if (request.method === "POST" && path === "/daily-spark/reflect") {
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.spark_id || !body?.reflection_text) return json(400, { error: "Invalid payload" });
      await upsertUser(env, actingUserId);
      const id = uuid();
      const ts = nowTs();
      await execute(
        env,
        `INSERT INTO spark_reflections (id, spark_id, user_id, reflection_text, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        body.spark_id,
        actingUserId,
        body.reflection_text,
        ts
      );
      return json(201, { id, spark_id: body.spark_id, user_id: actingUserId, reflection_text: body.reflection_text, created_at: ts });
    }


    // ===== Minigame Challenge Endpoints =====
    if (request.method === "POST" && path === "/challenge") {
      await ensureMinigameTables(env);
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.challenger);
      const opponent = (body?.opponent || (actingUserId === "raphael" ? "taylor" : "raphael") || "").trim();
      const game = (body?.game || "").trim();
      if (!actingUserId || !opponent || !game) return json(400, { error: "Invalid payload" });
      if (!["pong", "rps", "rock-paper-scissors", "lucky-word"].includes(game)) {
        return json(400, { error: "Unsupported game" });
      }

      await upsertUser(env, actingUserId);
      await upsertUser(env, opponent);

      const challengeId = uuid();
      const ts = nowTs();
      const challengePayload = {
        challenge_id: challengeId,
        challenger: actingUserId,
        opponent,
        game,
        status: "pending",
        game_state: {},
        created_at: ts
      };

      const messageId = uuid();
      let persistedMessageId = null;
      try {
        await execute(
          env,
          `INSERT INTO messages (id, user_id, type, content, created_at) VALUES (?, ?, 'challenge', ?, ?)`,
          messageId,
          actingUserId,
          JSON.stringify(challengePayload),
          ts
        );
        persistedMessageId = messageId;
      } catch {
        // Compatibility fallback when legacy messages type CHECK disallows 'challenge'.
        await execute(
          env,
          `INSERT INTO messages (id, user_id, type, content, created_at) VALUES (?, ?, 'text', ?, ?)`,
          messageId,
          actingUserId,
          JSON.stringify({ ...challengePayload, message_type: 'challenge' }),
          ts
        );
        persistedMessageId = messageId;
      }

      await execute(
        env,
        `INSERT INTO challenges (id, challenger, opponent, game, status, game_state, message_id, created_at)
         VALUES (?, ?, ?, ?, 'pending', '{}', ?, ?)`,
        challengeId,
        actingUserId,
        opponent,
        game,
        persistedMessageId,
        ts
      );

      return json(201, {
        id: challengeId,
        challenger: actingUserId,
        opponent,
        game,
        status: "pending",
        game_state: {},
        message_id: persistedMessageId,
        created_at: ts
      });
    }

    const challengeRespondMatch = path.match(/^\/challenge\/([^/]+)\/respond$/);
    if (request.method === "POST" && challengeRespondMatch) {
      await ensureMinigameTables(env);
      const body = await safeJson(request);
      const response = body?.response;
      if (response !== "accept" && response !== "decline") return json(400, { error: "Invalid response" });

      const challenge = await queryFirst(env, `SELECT * FROM challenges WHERE id = ?`, challengeRespondMatch[1]);
      if (!challenge) return json(404, { error: "Challenge not found" });

      const actingUserId = auth.userId || body?.user_id || null;
      if (!actingUserId || actingUserId !== challenge.opponent) {
        return json(403, { error: "Only the challenged player can respond" });
      }

      const nextStatus = response === "accept" ? "accepted" : "declined";
      await execute(env, `UPDATE challenges SET status = ? WHERE id = ?`, nextStatus, challenge.id);

      if (challenge.message_id) {
        const content = JSON.stringify({
          challenge_id: challenge.id,
          challenger: challenge.challenger,
          opponent: challenge.opponent,
          game: challenge.game,
          status: nextStatus
        });
        await execute(env, `UPDATE messages SET content = ? WHERE id = ?`, content, challenge.message_id);
      }

      return json(200, { id: challenge.id, status: nextStatus });
    }

    const challengeMoveMatch = path.match(/^\/challenge\/([^/]+)\/move$/);
    if (request.method === "POST" && challengeMoveMatch) {
      await ensureMinigameTables(env);
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || body?.move_data === undefined) return json(400, { error: "Invalid payload" });

      const challenge = await queryFirst(env, `SELECT * FROM challenges WHERE id = ?`, challengeMoveMatch[1]);
      if (!challenge) return json(404, { error: "Challenge not found" });
      if (actingUserId !== challenge.challenger && actingUserId !== challenge.opponent) {
        return json(403, { error: "Forbidden" });
      }
      if (challenge.status === 'declined') {
        return json(409, { error: "Challenge was declined" });
      }

      let gameState = {};
      try {
        gameState = challenge.game_state ? JSON.parse(challenge.game_state) : {};
      } catch {
        gameState = {};
      }

      if (!Array.isArray(gameState.moves)) gameState.moves = [];
      gameState.moves.push({ user_id: actingUserId, move_data: body.move_data, timestamp: nowTs() });

      await execute(env, `UPDATE challenges SET game_state = ?, status = CASE WHEN status = 'pending' THEN 'active' ELSE status END WHERE id = ?`, JSON.stringify(gameState), challenge.id);

      if (challenge.message_id) {
        const msgContent = JSON.stringify({
          challenge_id: challenge.id,
          challenger: challenge.challenger,
          opponent: challenge.opponent,
          game: challenge.game,
          status: challenge.status === 'pending' ? 'active' : challenge.status,
          game_state: gameState
        });
        await execute(env, `UPDATE messages SET content = ? WHERE id = ?`, msgContent, challenge.message_id);
      }

      return json(200, { id: challenge.id, status: challenge.status === 'pending' ? 'active' : challenge.status, game_state: gameState });
    }

    // ===== Word Reflection Endpoints =====
    if (request.method === "GET" && path === "/word-reflection") {
      await ensureMinigameTables(env);
      const date = (url.searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: "Invalid date format. Use YYYY-MM-DD" });
      const rows = await queryAll(
        env,
        `SELECT user_id, reflection FROM word_reflections WHERE date_key = ? ORDER BY created_at ASC`,
        date
      );
      const byUser = Object.fromEntries(rows.map((row) => [row.user_id, row.reflection]));
      return json(200, byUser);
    }

    if (request.method === "POST" && path === "/word-reflection") {
      await ensureMinigameTables(env);
      const body = await safeJson(request);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      const reflection = typeof body?.reflection === "string" ? body.reflection.trim() : "";
      const date = (body?.date || new Date().toISOString().slice(0, 10)).trim();
      if (!actingUserId || !reflection || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(400, { error: "Invalid payload" });
      await upsertUser(env, actingUserId);

      const id = uuid();
      const ts = nowTs();
      await execute(
        env,
        `INSERT INTO word_reflections (id, user_id, date_key, reflection, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, date_key) DO UPDATE SET reflection = excluded.reflection, created_at = excluded.created_at`,
        id,
        actingUserId,
        date,
        reflection,
        ts
      );

      return json(201, { user_id: actingUserId, date, reflection, created_at: ts });
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    console.error("API error:", err);
    return json(500, { error: "Internal server error" });
  }
}

export const onRequest = handleRequest;
