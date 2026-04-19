import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../lib/helpers.js";

// Consolidated social router:
// POST /api/social/mood            → update user mood
// POST /api/social/reactions/:id   → toggle reaction on a message
// GET  /api/social/word-reflection → fetch word reflections for a date
// POST /api/social/word-reflection → submit a word reflection

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Extract subpath: e.g. "mood", "reactions/abc123", "word-reflection"
  const url = req.url || "";
  const subpath = url.replace(/^\/api\/social\/?/, "").split("?")[0];

  // --- POST /api/social/mood ---
  if (subpath === "mood") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    try {
      const auth = await isAuthorized(req);
      if (!auth) return json(res, 401, { error: "Unauthorized" });

      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.emoji || !body?.text) {
        return json(res, 400, { error: "Invalid payload" });
      }

      await upsertUser(actingUserId);
      const db = getSupabase();

      await db.from("moods").upsert(
        {
          user_id: actingUserId,
          emoji: body.emoji,
          text: body.text,
          updated_at: nowTs()
        },
        { onConflict: "user_id" }
      );

      return json(res, 200, { ok: true });
    } catch (err) {
      console.error("POST /social/mood error:", err);
      return json(res, 500, { error: "Internal server error" });
    }
  }

  // --- POST /api/social/reactions/:messageId ---
  if (subpath.startsWith("reactions/")) {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const messageId = subpath.replace(/^reactions\//, "");
    try {
      const auth = await isAuthorized(req);
      if (!auth) return json(res, 401, { error: "Unauthorized" });

      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.emoji || !messageId) return json(res, 400, { error: "Invalid payload" });

      const db = getSupabase();
      const { data: existing } = await db
        .from("reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", actingUserId)
        .eq("emoji", body.emoji)
        .maybeSingle();

      if (existing?.id) {
        await db.from("reactions").delete().eq("id", existing.id);
        return json(res, 200, { toggled: "off" });
      }

      const id = uuid();
      const timestamp = nowTs();
      await upsertUser(actingUserId);

      const { error } = await db.from("reactions").insert({
        id, message_id: messageId, user_id: actingUserId, emoji: body.emoji, created_at: timestamp
      });
      if (error) throw error;

      return json(res, 201, { toggled: "on" });
    } catch (err) {
      console.error("POST /social/reactions error:", err);
      return json(res, 500, { error: "Internal server error" });
    }
  }

  // --- GET/POST /api/social/word-reflection ---
  if (subpath === "word-reflection") {
    try {
      const auth = await isAuthorized(req);
      if (!auth) return json(res, 401, { error: "Unauthorized" });

      const db = getSupabase();

      // GET /api/social/word-reflection?date=YYYY-MM-DD
      if (req.method === "GET") {
        const date = (req.query?.date || new Date().toISOString().slice(0, 10)).trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return json(res, 400, { error: "Invalid date format. Use YYYY-MM-DD" });
        }

        const { data: rows } = await db
          .from("word_reflections")
          .select("user_id, reflection")
          .eq("date_key", date)
          .order("created_at", { ascending: true });

        const byUser = Object.fromEntries((rows || []).map((r) => [r.user_id, r.reflection]));
        return json(res, 200, byUser);
      }

      // POST /api/social/word-reflection
      if (req.method === "POST") {
        const body = await safeJson(req);
        const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
        const reflection = typeof body?.reflection === "string" ? body.reflection.trim() : "";
        const date = (body?.date || new Date().toISOString().slice(0, 10)).trim();

        if (!actingUserId || !reflection || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return json(res, 400, { error: "Invalid payload" });
        }

        await upsertUser(actingUserId);

        const id = uuid();
        const ts = nowTs();
        await db.from("word_reflections").upsert(
          {
            id,
            user_id: actingUserId,
            date_key: date,
            reflection,
            created_at: ts
          },
          { onConflict: "user_id,date_key" }
        );

        return json(res, 201, { user_id: actingUserId, date, reflection, created_at: ts });
      }

      return json(res, 405, { error: "Method not allowed" });
    } catch (err) {
      console.error("word-reflection error:", err);
      return json(res, 500, { error: "Internal server error" });
    }
  }

  return json(res, 404, { error: "Not found" });
}
