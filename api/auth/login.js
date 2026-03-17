import { cors } from "../../lib/cors.js";
import { getSupabase } from "../../lib/db.js";
import { json, uuid, nowTs, hashPassword, buildSessionCookie, safeJson, ensureGamePlayer } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = await safeJson(req);
    const identifier = (body?.email || body?.username || body?.user_id || "").trim();
    const password = typeof body?.password === "string" ? body.password : "";
    if (!identifier || !password) return json(res, 400, { error: "Email/username and password are required" });

    const db = getSupabase();

    // Find user by email, username, or id
    let user = null;
    for (const field of ["email", "username", "id"]) {
      const value = field === "email" ? identifier.toLowerCase() : identifier;
      const { data } = await db.from("users").select("*").eq(field, value).maybeSingle();
      if (data) { user = data; break; }
    }
    if (!user) return json(res, 401, { error: "Invalid credentials" });

    if (user.password_hash) {
      const passwordHash = await hashPassword(password);
      if (user.password_hash !== passwordHash) return json(res, 401, { error: "Invalid credentials" });
    }

    const userId = user.user_id || user.id || identifier;
    await ensureGamePlayer(userId);

    // Create session
    const token = uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
    const expiresAt = nowTs() + 60 * 60 * 24 * 30;
    await db.from("sessions").insert({
      id: uuid(),
      token,
      user_id: userId,
      expires_at: expiresAt,
      created_at: nowTs()
    });

    res.setHeader("Set-Cookie", buildSessionCookie(token, Math.max(1, expiresAt - nowTs())));
    return json(res, 200, { user_id: userId, token });
  } catch (err) {
    console.error("POST /auth/login error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
