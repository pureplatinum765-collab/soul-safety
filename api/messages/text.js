import { cors } from "../../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const body = await safeJson(req);
    const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
    if (!actingUserId || typeof body?.content !== "string" || body.content.trim() === "") {
      return json(res, 400, { error: "Invalid payload" });
    }

    const id = uuid();
    const timestamp = nowTs();
    await upsertUser(actingUserId);

    const db = getSupabase();
    const { error } = await db.from("messages").insert({
      id,
      user_id: actingUserId,
      type: "text",
      content: body.content,
      created_at: timestamp
    });
    if (error) throw error;

    return json(res, 201, { id, user_id: actingUserId, type: "text", content: body.content, timestamp });
  } catch (err) {
    console.error("POST /messages/text error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
