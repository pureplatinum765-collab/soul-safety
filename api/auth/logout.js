import { cors } from "../../lib/cors.js";
import { getSupabase } from "../../lib/db.js";
import { parseAuthToken, parseCookies } from "../../lib/auth.js";
import { json, buildSessionCookie } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const token = parseAuthToken(req) || parseCookies(req).soul_safety_session || "";
    if (token) {
      const db = getSupabase();
      await db.from("sessions").delete().eq("token", token);
    }
    res.setHeader("Set-Cookie", buildSessionCookie("", 0));
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("POST /auth/logout error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
