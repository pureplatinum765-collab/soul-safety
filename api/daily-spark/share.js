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
    if (!actingUserId || !body?.spark_id) {
      return json(res, 400, { error: "Invalid payload" });
    }

    await upsertUser(actingUserId);

    const id = uuid();
    const ts = nowTs();
    const db = getSupabase();

    const { error } = await db.from("spark_shares").insert({
      id,
      spark_id: body.spark_id,
      user_id: actingUserId,
      message_id: body.message_id || null,
      created_at: ts
    });
    if (error) throw error;

    return json(res, 201, {
      id,
      spark_id: body.spark_id,
      user_id: actingUserId,
      message_id: body.message_id || null,
      created_at: ts
    });
  } catch (err) {
    console.error("POST /daily-spark/share error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
