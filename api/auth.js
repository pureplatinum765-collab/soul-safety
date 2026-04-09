import { cors } from "../lib/cors.js";
import { getSupabase } from "../lib/db.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { json, uuid, nowTs, hashPassword, buildSessionCookie, safeJson, ensureGamePlayer } from "../lib/helpers.js";

// Consolidated auth router: handles /api/auth/login, /api/auth/logout, /api/auth/me, /api/auth/signup
export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Extract sub-path: req.url might be /api/auth/login or just /api/auth
  const url = req.url || "";
  const subpath = url.replace(/^\/api\/auth\/?/, "").split("?")[0]; // login, logout, me, signup

  // --- GET /api/auth/me ---
  if (subpath === "me" || subpath === "") {
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

  // --- POST /api/auth/login ---
  if (subpath === "login") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    try {
      const body = await safeJson(req);
      const identifier = (body?.email || body?.username || body?.user_id || "").trim();
      const password = typeof body?.password === "string" ? body.password : "";
      if (!identifier || !password) return json(res, 400, { error: "Email/username and password are required" });

      const db = getSupabase();
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

      const token = uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
      const expiresAt = nowTs() + 60 * 60 * 24 * 30;
      await db.from("sessions").insert({ id: uuid(), token, user_id: userId, expires_at: expiresAt, created_at: nowTs() });

      res.setHeader("Set-Cookie", buildSessionCookie(token, Math.max(1, expiresAt - nowTs())));
      return json(res, 200, { user_id: userId, token });
    } catch (err) {
      console.error("POST /auth/login error:", err);
      return json(res, 500, { error: "Internal server error" });
    }
  }

  // --- POST /api/auth/logout ---
  if (subpath === "logout") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    try {
      const { parseAuthToken, parseCookies } = await import("../lib/auth.js");
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

  // --- POST /api/auth/signup ---
  if (subpath === "signup") {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
    try {
      const body = await safeJson(req);
      const identifier = (body?.email || body?.username || body?.user_id || "").trim();
      const password = typeof body?.password === "string" ? body.password : "";
      if (!identifier || !password) return json(res, 400, { error: "Email/username and password are required" });

      const db = getSupabase();
      for (const field of ["email", "username", "id"]) {
        const value = field === "email" ? identifier.toLowerCase() : identifier;
        const { data } = await db.from("users").select("id").eq(field, value).maybeSingle();
        if (data) return json(res, 409, { error: "User already exists" });
      }

      const userId = body?.user_id || uuid();
      const passwordHash = await hashPassword(password);
      await db.from("users").insert({
        id: userId,
        display_name: body?.display_name || identifier,
        email: (body?.email || "").toLowerCase() || null,
        username: body?.username || identifier,
        password_hash: passwordHash,
        created_at: nowTs()
      });

      await ensureGamePlayer(userId);

      const token = uuid().replace(/-/g, "") + uuid().replace(/-/g, "");
      const expiresAt = nowTs() + 60 * 60 * 24 * 30;
      await db.from("sessions").insert({ id: uuid(), token, user_id: userId, expires_at: expiresAt, created_at: nowTs() });

      res.setHeader("Set-Cookie", buildSessionCookie(token, Math.max(1, expiresAt - nowTs())));
      return json(res, 201, { user_id: userId, token });
    } catch (err) {
      console.error("POST /auth/signup error:", err);
      return json(res, 500, { error: "Internal server error" });
    }
  }

  return json(res, 404, { error: "Not found" });
}
