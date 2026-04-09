import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../lib/helpers.js";

// POST /api/reactions/:messageId → toggle reaction

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const url = req.url || "";
  const messageId = url.replace(/^\/api\/reactions\/?/, "").split("?")[0];

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
    console.error("POST /reactions error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
