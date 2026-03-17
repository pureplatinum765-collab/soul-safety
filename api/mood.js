import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, nowTs, upsertUser, safeJson } from "../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
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
    console.error("POST /mood error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
