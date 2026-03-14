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

function isAuthorized(request, env) {
  const configured = (env.API_BEARER_TOKEN || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (configured.length === 0) return false;
  const provided = parseAuthToken(request);
  return configured.includes(provided);
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
  const displayName = userId === "hippiehugs" ? "Raphael" : userId === "taylor" ? "Taylor" : userId;
  await execute(
    env,
    `INSERT INTO users (id, display_name) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name`,
    userId,
    displayName
  );
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

async function handleRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, "");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!isAuthorized(request, env)) {
    return json(401, { error: "Unauthorized" });
  }

  if (!env.DB) {
    return json(500, { error: "D1 binding DB is not configured" });
  }

  try {
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
      if (!body?.user_id || typeof body.content !== "string" || body.content.trim() === "") {
        return json(400, { error: "Invalid payload" });
      }
      const id = uuid();
      const timestamp = nowTs();
      await upsertUser(env, body.user_id);
      await execute(
        env,
        `INSERT INTO messages (id, user_id, type, content, created_at)
         VALUES (?, ?, 'text', ?, ?)`,
        id,
        body.user_id,
        body.content,
        timestamp
      );
      return json(201, { id, user_id: body.user_id, type: "text", content: body.content, timestamp });
    }

    if (request.method === "POST" && path === "/messages/media") {
      const formData = await safeFormData(request);
      if (!formData) return json(400, { error: "Invalid form data" });

      const userId = formData.get("user_id");
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
      if (!body?.user_id || !body?.emoji) return json(400, { error: "Invalid payload" });
      const messageId = reactMatch[1];

      const existing = await queryFirst(
        env,
        `SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
        messageId,
        body.user_id,
        body.emoji
      );

      if (existing?.id) {
        await execute(env, `DELETE FROM reactions WHERE id = ?`, existing.id);
        return json(200, { toggled: "off" });
      }

      const id = uuid();
      const timestamp = nowTs();
      await upsertUser(env, body.user_id);
      await execute(
        env,
        `INSERT INTO reactions (id, message_id, user_id, emoji, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        messageId,
        body.user_id,
        body.emoji,
        timestamp
      );
      return json(201, { toggled: "on" });
    }

    if (request.method === "POST" && path === "/typing") {
      const body = await safeJson(request);
      if (!body?.user_id || typeof body.is_typing !== "boolean") return json(400, { error: "Invalid payload" });
      await upsertUser(env, body.user_id);
      await execute(
        env,
        `INSERT INTO typing_status (user_id, is_typing, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET is_typing = excluded.is_typing, updated_at = excluded.updated_at`,
        body.user_id,
        body.is_typing ? 1 : 0,
        nowTs()
      );
      return json(200, { ok: true });
    }

    if (request.method === "POST" && path === "/read") {
      const body = await safeJson(request);
      if (!body?.user_id || !body?.last_read_message_id) return json(400, { error: "Invalid payload" });
      await upsertUser(env, body.user_id);
      await execute(
        env,
        `INSERT INTO read_receipts (user_id, last_read_message_id, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET last_read_message_id = excluded.last_read_message_id, updated_at = excluded.updated_at`,
        body.user_id,
        body.last_read_message_id,
        nowTs()
      );
      return json(200, { ok: true });
    }

    if (request.method === "POST" && path === "/mood") {
      const body = await safeJson(request);
      if (!body?.user_id || !body?.emoji || !body?.text) return json(400, { error: "Invalid payload" });
      await upsertUser(env, body.user_id);
      await execute(
        env,
        `INSERT INTO moods (user_id, emoji, text, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET emoji = excluded.emoji, text = excluded.text, updated_at = excluded.updated_at`,
        body.user_id,
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
      await execute(env, `DELETE FROM messages WHERE id = ?`, deleteMatch[1]);
      return json(200, { deleted: deleteMatch[1] });
    }

    // ===== Game Endpoints =====
    if (request.method === "GET" && path === "/game/state") {
      const players = await queryAll(
        env,
        `SELECT user_id, position, points, updated_at FROM game_players ORDER BY user_id ASC`
      );
      const feed = await queryAll(
        env,
        `SELECT id, user_id, event_type, delta_position, delta_points, task_id, note, created_at AS timestamp
         FROM game_events ORDER BY created_at DESC LIMIT 100`
      );
      return json(200, { players, feed });
    }

    if (request.method === "POST" && path === "/game/move") {
      const body = await safeJson(request);
      if (!body?.user_id || !Number.isInteger(body.delta_position)) return json(400, { error: "Invalid payload" });
      const player = await queryFirst(env, `SELECT position, points FROM game_players WHERE user_id = ?`, body.user_id);
      if (!player) return json(404, { error: "Player not found" });

      const newPos = Number(player.position) + Number(body.delta_position);
      const ts = nowTs();
      await execute(env, `UPDATE game_players SET position = ?, updated_at = ? WHERE user_id = ?`, newPos, ts, body.user_id);
      await execute(
        env,
        `INSERT INTO game_events (id, user_id, event_type, delta_position, delta_points, note, created_at)
         VALUES (?, ?, 'moved', ?, 0, ?, ?)`,
        uuid(), body.user_id, body.delta_position, body.note || null, ts
      );

      return json(200, { user_id: body.user_id, position: newPos, points: Number(player.points) });
    }

    if (request.method === "POST" && path === "/game/task-complete") {
      const body = await safeJson(request);
      if (!body?.user_id || !body?.task_id) return json(400, { error: "Invalid payload" });
      const [player, task] = await Promise.all([
        queryFirst(env, `SELECT position, points FROM game_players WHERE user_id = ?`, body.user_id),
        queryFirst(env, `SELECT id, points_awarded FROM game_tasks WHERE id = ?`, body.task_id)
      ]);
      if (!player) return json(404, { error: "Player not found" });
      if (!task) return json(404, { error: "Task not found" });

      const deltaPoints = Number(task.points_awarded) || 0;
      const newPoints = Number(player.points) + deltaPoints;
      const ts = nowTs();
      await execute(env, `UPDATE game_players SET points = ?, updated_at = ? WHERE user_id = ?`, newPoints, ts, body.user_id);
      await execute(
        env,
        `INSERT INTO game_events (id, user_id, event_type, delta_position, delta_points, task_id, note, created_at)
         VALUES (?, ?, 'task_completed', 0, ?, ?, ?, ?)`,
        uuid(), body.user_id, deltaPoints, body.task_id, body.note || null, ts
      );

      return json(200, { user_id: body.user_id, position: Number(player.position), points: newPoints });
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
      if (!body?.user_id || !body?.spark_id) return json(400, { error: "Invalid payload" });
      await upsertUser(env, body.user_id);
      const id = uuid();
      const ts = nowTs();
      await execute(
        env,
        `INSERT INTO spark_shares (id, spark_id, user_id, message_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        body.spark_id,
        body.user_id,
        body.message_id || null,
        ts
      );
      return json(201, { id, spark_id: body.spark_id, user_id: body.user_id, message_id: body.message_id || null, created_at: ts });
    }

    if (request.method === "POST" && path === "/daily-spark/reflect") {
      const body = await safeJson(request);
      if (!body?.user_id || !body?.spark_id || !body?.reflection_text) return json(400, { error: "Invalid payload" });
      await upsertUser(env, body.user_id);
      const id = uuid();
      const ts = nowTs();
      await execute(
        env,
        `INSERT INTO spark_reflections (id, spark_id, user_id, reflection_text, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        body.spark_id,
        body.user_id,
        body.reflection_text,
        ts
      );
      return json(201, { id, spark_id: body.spark_id, user_id: body.user_id, reflection_text: body.reflection_text, created_at: ts });
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    console.error("API error:", err);
    return json(500, { error: "Internal server error" });
  }
}

export const onRequest = handleRequest;
