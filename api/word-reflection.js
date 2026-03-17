import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const db = getSupabase();

    // GET /api/word-reflection?date=YYYY-MM-DD
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

    // POST /api/word-reflection
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
