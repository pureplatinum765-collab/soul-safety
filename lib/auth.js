import { getSupabase } from "./db.js";

function parseAuthToken(req) {
  const raw = req.headers["authorization"] || req.headers["Authorization"] || "";
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(
    raw
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf("=");
        if (idx <= 0) return ["", ""];
        return [decodeURIComponent(c.slice(0, idx)), decodeURIComponent(c.slice(idx + 1))];
      })
      .filter(([k]) => k)
  );
}

export async function isAuthorized(req) {
  const configured = (process.env.API_BEARER_TOKEN || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const provided = parseAuthToken(req);

  // Bearer token match — admin/service access
  if (configured.length > 0 && provided && configured.includes(provided)) {
    return { userId: null, token: provided };
  }

  // Session-based auth
  const token = provided || parseCookies(req).soul_safety_session || "";
  if (!token) return null;

  const db = getSupabase();
  const { data: session } = await db
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && Number(session.expires_at) < now) {
    await db.from("sessions").delete().eq("token", token);
    return null;
  }

  return { userId: session.user_id, token };
}

export function resolveActingUserId(authUserId, payloadUserId) {
  if (authUserId) {
    if (payloadUserId && payloadUserId !== authUserId) return null;
    return authUserId;
  }
  return payloadUserId || null;
}

export { parseAuthToken, parseCookies };
