import { cors } from "../../lib/cors.js";
import { isAuthorized } from "../../lib/auth.js";
import { json, ensureGamePlayer } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    if (!auth.userId) return json(res, 200, { user_id: null, mode: "bearer" });

    await ensureGamePlayer(auth.userId);
    return json(res, 200, { user_id: auth.userId, mode: "session" });
  } catch (err) {
    console.error("GET /auth/me error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
