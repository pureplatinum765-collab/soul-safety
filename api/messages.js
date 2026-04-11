import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../lib/helpers.js";
import { IncomingForm } from "formidable";
import fs from "fs";

// Consolidated messages router:
// GET  /api/messages            → list messages
// POST /api/messages/text       → send text
// POST /api/messages/media      → upload media
// GET  /api/messages/:id/media  → get media binary
// DELETE /api/messages/:id      → delete message
// GET  /api/messages/factoids   → list factoids
// POST /api/messages/factoids   → create factoid
// DELETE /api/messages/factoids/:id → delete factoid

export const config = { api: { bodyParser: false } };

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = req.url || "";
  // Strip /api/messages prefix and query string
  const after = url.replace(/^\/api\/messages\/?/, "").split("?")[0];
  // after could be: "" | "text" | "media" | ":id" | ":id/media"

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    // GET /api/messages — list
    if (after === "" && req.method === "GET") {
      const since = parseFloat(req.query?.since || "0") || 0;
      const db = getSupabase();
      const { data: rows, error } = await db
        .from("messages")
        .select("id, user_id, type, content, media_type, duration, created_at")
        .gt("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const messages = (rows || []).map((m) => ({ ...m, timestamp: m.created_at, media_data: undefined }));
      return json(res, 200, messages);
    }

    // POST /api/messages/text
    if (after === "text" && req.method === "POST") {
      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || typeof body?.content !== "string" || body.content.trim() === "") {
        return json(res, 400, { error: "Invalid payload" });
      }
      const id = uuid();
      const timestamp = nowTs();
      await upsertUser(actingUserId);
      const db = getSupabase();
      const { error } = await db.from("messages").insert({
        id, user_id: actingUserId, type: "text", content: body.content, created_at: timestamp
      });
      if (error) throw error;
      return json(res, 201, { id, user_id: actingUserId, type: "text", content: body.content, timestamp });
    }

    // POST /api/messages/media
    if (after === "media" && req.method === "POST") {
      const { fields, files } = await parseForm(req);
      const rawUserId = Array.isArray(fields.user_id) ? fields.user_id[0] : fields.user_id;
      const userId = resolveActingUserId(auth.userId, rawUserId);
      const mediaTypeName = Array.isArray(fields.media_type_name) ? fields.media_type_name[0] : fields.media_type_name;
      const duration = Array.isArray(fields.duration) ? fields.duration[0] : fields.duration || null;
      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!userId || !mediaTypeName || !file) return json(res, 400, { error: "Missing required form fields" });
      if (!["voice", "photo", "video"].includes(String(mediaTypeName))) return json(res, 400, { error: "Unsupported media type" });
      const filePath = file.filepath || file.path;
      const buffer = fs.readFileSync(filePath);
      const mediaData = buffer.toString("base64");
      const mediaContentType = file.mimetype || file.type || "application/octet-stream";
      const id = uuid();
      const timestamp = nowTs();
      await upsertUser(userId);
      const db = getSupabase();
      const { error } = await db.from("messages").insert({
        id, user_id: userId, type: mediaTypeName, media_data: mediaData, media_type: mediaContentType, duration, created_at: timestamp
      });
      if (error) throw error;
      try { fs.unlinkSync(filePath); } catch {}
      return json(res, 201, { id, user_id: userId, type: mediaTypeName, media_type: mediaContentType, duration, timestamp });
    }

    // GET /api/messages/factoids — list all factoids
    if (after === "factoids" && req.method === "GET") {
      const db = getSupabase();
      const { data: rows, error } = await db
        .from("factoids")
        .select("id, user_id, about, text, created_at")
        .order("created_at", { ascending: true });
      if (error) {
        // Table may not exist yet — return empty array gracefully
        if (error.code === '42P01') return json(res, 200, []);
        throw error;
      }
      return json(res, 200, rows || []);
    }

    // POST /api/messages/factoids — create factoid
    if (after === "factoids" && req.method === "POST") {
      const body = await safeJson(req);
      if (!body?.text || typeof body.text !== "string" || body.text.trim() === "") {
        return json(res, 400, { error: "Factoid text required" });
      }
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id) || "raphael";
      const about = ["raphael", "taylor"].includes(body?.about) ? body.about : actingUserId;
      const id = uuid();
      const timestamp = nowTs();
      const db = getSupabase();
      const { error } = await db.from("factoids").insert({
        id, user_id: actingUserId, about, text: body.text.trim(), created_at: timestamp
      });
      if (error) throw error;
      return json(res, 201, { id, user_id: actingUserId, about, text: body.text.trim(), created_at: timestamp });
    }

    // DELETE /api/messages/factoids/:id
    if (req.method === "DELETE" && after.startsWith("factoids/")) {
      const factoidId = after.replace("factoids/", "");
      const db = getSupabase();
      await db.from("factoids").delete().eq("id", factoidId);
      return json(res, 200, { deleted: factoidId });
    }

    // Dynamic :id routes
    // GET /api/messages/:id/media
    if (req.method === "GET" && after.endsWith("/media")) {
      const msgId = after.replace(/\/media$/, "");
      const db = getSupabase();
      const { data: msg } = await db.from("messages").select("media_data, media_type").eq("id", msgId).maybeSingle();
      if (!msg?.media_data) return json(res, 404, { error: "Media not found" });
      const bytes = Buffer.from(msg.media_data, "base64");
      res.setHeader("Content-Type", msg.media_type || "application/octet-stream");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.status(200).end(bytes);
      return;
    }

    // DELETE /api/messages/:id
    if (req.method === "DELETE" && after !== "" && !after.includes("/")) {
      const msgId = after;
      const db = getSupabase();
      await db.from("read_receipts").update({ last_read_message_id: null }).eq("last_read_message_id", msgId);
      await db.from("spark_shares").update({ message_id: null }).eq("message_id", msgId);
      await db.from("messages").delete().eq("id", msgId);
      return json(res, 200, { deleted: msgId });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error("messages handler error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
