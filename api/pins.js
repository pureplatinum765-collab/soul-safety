import { cors } from "../lib/cors.js";
import { isAuthorized } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, safeJson } from "../lib/helpers.js";

// Pins router:
// GET    /api/pins        → list all pins
// POST   /api/pins        → create a pin { text, image_url, color, user_id }
// DELETE /api/pins/:id    → delete a pin by id

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = req.url || "";
  // Strip /api/pins prefix and query string to get optional /:id
  const after = url.replace(/^\/api\/pins\/?/, "").split("?")[0];

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const db = getSupabase();

    // GET /api/pins — list all pins
    if (after === "" && req.method === "GET") {
      const { data: rows, error } = await db
        .from("pins")
        .select("id, user_id, text, image_url, color, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        // Table may not exist yet — return empty array gracefully
        // Supabase may return code 42P01, or message about "relation" not existing
        if (error.code === "42P01" || (error.message && error.message.includes('relation')) ||
            (error.message && error.message.includes('does not exist'))) {
          return json(res, 200, []);
        }
        throw error;
      }

      return json(res, 200, rows || []);
    }

    // POST /api/pins — create a pin
    if (after === "" && req.method === "POST") {
      const body = await safeJson(req);

      if (!body?.text || typeof body.text !== "string" || body.text.trim() === "") {
        return json(res, 400, { error: "Pin text is required" });
      }

      // Resolve user_id: from payload (if bearer-auth admin), else from session
      const userId =
        (auth.userId ? auth.userId : null) ||
        (typeof body?.user_id === "string" ? body.user_id : null) ||
        "raphael";

      const ALLOWED_COLORS = ["terracotta", "sage", "cream", "blush", "lavender"];
      const color = ALLOWED_COLORS.includes(body?.color) ? body.color : "cream";

      const imageUrl =
        typeof body?.image_url === "string" && body.image_url.trim().startsWith("http")
          ? body.image_url.trim()
          : null;

      const id = uuid();
      const timestamp = nowTs();

      const { error } = await db.from("pins").insert({
        id,
        user_id: userId,
        text: body.text.trim(),
        image_url: imageUrl,
        color,
        created_at: timestamp,
      });

      if (error) {
        // If table doesn't exist yet, return a helpful message
        if (error.code === "42P01" || (error.message && error.message.includes('relation')) ||
            (error.message && error.message.includes('does not exist'))) {
          return json(res, 503, { error: "Pinboard not set up yet" });
        }
        throw error;
      }

      return json(res, 201, {
        id,
        user_id: userId,
        text: body.text.trim(),
        image_url: imageUrl,
        color,
        created_at: timestamp,
      });
    }

    // DELETE /api/pins/:id
    if (req.method === "DELETE" && after !== "" && !after.includes("/")) {
      const pinId = after;
      const { error } = await db.from("pins").delete().eq("id", pinId);
      if (error) throw error;
      return json(res, 200, { deleted: pinId });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("pins handler error:", err?.message || err);
    // If the table simply doesn't exist, degrade gracefully for GET
    if (req.method === "GET") return json(res, 200, []);
    return json(res, 500, { error: "Internal server error" });
  }
}
