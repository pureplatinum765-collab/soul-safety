import { cors } from "../../lib/cors.js";
import { isAuthorized } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const since = parseFloat(req.query?.since || "0") || 0;
    const db = getSupabase();

    const { data: rows, error } = await db
      .from("messages")
      .select("id, user_id, type, content, media_type, duration, created_at")
      .gt("created_at", since)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const messages = (rows || []).map((m) => ({
      ...m,
      timestamp: m.created_at,
      media_data: undefined
    }));

    return json(res, 200, messages);
  } catch (err) {
    console.error("GET /messages error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
