import { cors } from "../../lib/cors.js";
import { isAuthorized } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const rawId = req.query.id;

    // GET /api/messages/:id/media — Vercel doesn't natively match this,
    // but with path rewrites the subpath comes through.
    // We detect the "/media" suffix in the id param.
    if (req.method === "GET") {
      // The id might be "someid/media" from the catch-all
      const mediaMatch = rawId && rawId.endsWith("/media");
      if (!mediaMatch) return json(res, 404, { error: "Not found" });

      const msgId = rawId.replace(/\/media$/, "");
      const db = getSupabase();
      const { data: msg } = await db
        .from("messages")
        .select("media_data, media_type")
        .eq("id", msgId)
        .maybeSingle();

      if (!msg?.media_data) return json(res, 404, { error: "Media not found" });

      const bytes = Buffer.from(msg.media_data, "base64");
      res.setHeader("Content-Type", msg.media_type || "application/octet-stream");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(200).end(bytes);
      return;
    }

    // DELETE /api/messages/:id
    if (req.method === "DELETE") {
      const msgId = rawId;
      const db = getSupabase();

      // Clear FK references first
      await db.from("read_receipts").update({ last_read_message_id: null }).eq("last_read_message_id", msgId);
      await db.from("spark_shares").update({ message_id: null }).eq("message_id", msgId);
      await db.from("messages").delete().eq("id", msgId);

      return json(res, 200, { deleted: msgId });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("messages/[id] error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
