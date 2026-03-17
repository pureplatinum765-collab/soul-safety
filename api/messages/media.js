import { cors } from "../../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json, uuid, nowTs, upsertUser } from "../../lib/helpers.js";
import { IncomingForm } from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ maxFileSize: 10 * 1024 * 1024 });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function encodeBytesToBase64(uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < uint8Array.length; i += chunk) {
    const sub = uint8Array.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const { fields, files } = await parseForm(req);

    const rawUserId = Array.isArray(fields.user_id) ? fields.user_id[0] : fields.user_id;
    const userId = resolveActingUserId(auth.userId, rawUserId);
    const mediaTypeName = Array.isArray(fields.media_type_name) ? fields.media_type_name[0] : fields.media_type_name;
    const duration = Array.isArray(fields.duration) ? fields.duration[0] : fields.duration || null;
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!userId || !mediaTypeName || !file) {
      return json(res, 400, { error: "Missing required form fields" });
    }

    const allowed = new Set(["voice", "photo", "video"]);
    if (!allowed.has(String(mediaTypeName))) {
      return json(res, 400, { error: "Unsupported media type" });
    }

    const filePath = file.filepath || file.path;
    const buffer = fs.readFileSync(filePath);
    const mediaData = buffer.toString("base64");
    const mediaContentType = file.mimetype || file.type || "application/octet-stream";

    const id = uuid();
    const timestamp = nowTs();
    await upsertUser(userId);

    const db = getSupabase();
    const { error } = await db.from("messages").insert({
      id,
      user_id: userId,
      type: mediaTypeName,
      media_data: mediaData,
      media_type: mediaContentType,
      duration,
      created_at: timestamp
    });
    if (error) throw error;

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch {}

    return json(res, 201, {
      id,
      user_id: userId,
      type: mediaTypeName,
      media_type: mediaContentType,
      duration,
      timestamp
    });
  } catch (err) {
    console.error("POST /messages/media error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
