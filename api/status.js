import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, nowTs, upsertUser, safeJson } from "../lib/helpers.js";

// Consolidated status router:
// GET  /api/client-config → return public Supabase config (no auth required)
// POST /api/read          → mark messages read
// POST /api/typing        → update typing status

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = req.url || "";
  const subpath = url.replace(/^\/api\//, "").split("?")[0]; // "read", "typing", or "client-config"

  // --- GET /api/client-config (no auth required) ---
  if (subpath === "client-config") {
    res.setHeader("Cache-Control", "public, max-age=3600");
    return json(res, 200, {
      supabaseUrl: process.env.SUPABASE_URL || "",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    });
  }

  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const body = await safeJson(req);
    const actingUserId = resolveActingUserId(auth.userId, body?.user_id);

    // POST /api/read
    if (subpath === "read") {
      if (!actingUserId || !body?.last_read_message_id) return json(res, 400, { error: "Invalid payload" });
      await upsertUser(actingUserId);
      const db = getSupabase();
      await db.from("read_receipts").upsert(
        { user_id: actingUserId, last_read_message_id: body.last_read_message_id, updated_at: nowTs() },
        { onConflict: "user_id" }
      );
      return json(res, 200, { ok: true });
    }

    // POST /api/typing
    if (subpath === "typing") {
      if (!actingUserId || typeof body?.is_typing !== "boolean") return json(res, 400, { error: "Invalid payload" });
      await upsertUser(actingUserId);
      const db = getSupabase();
      await db.from("typing_status").upsert(
        { user_id: actingUserId, is_typing: body.is_typing, updated_at: nowTs() },
        { onConflict: "user_id" }
      );
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("status handler error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
