import { cors } from "../lib/cors.js";
import { isAuthorized } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, nowTs } from "../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const since = parseFloat(req.query?.since || "0") || 0;
    const db = getSupabase();

    const [messagesRes, reactionsRes, typingRes, readsRes, moodsRes] = await Promise.all([
      db.from("messages")
        .select("id, user_id, type, content, media_type, duration, created_at")
        .gt("created_at", since)
        .order("created_at", { ascending: true }),
      db.from("reactions")
        .select("id, message_id, user_id, emoji, created_at")
        .gt("created_at", since)
        .order("created_at", { ascending: true }),
      db.from("typing_status")
        .select("user_id, is_typing, updated_at"),
      db.from("read_receipts")
        .select("user_id, last_read_message_id"),
      db.from("moods")
        .select("user_id, emoji, text")
    ]);

    const current = nowTs();
    const typingUsers = (typingRes.data || [])
      .filter((t) => t.is_typing === true && current - Number(t.updated_at) < 5)
      .map((t) => t.user_id);

    const readMap = Object.fromEntries(
      (readsRes.data || []).map((r) => [r.user_id, r.last_read_message_id])
    );
    const moodMap = Object.fromEntries(
      (moodsRes.data || []).map((m) => [m.user_id, { emoji: m.emoji, text: m.text }])
    );

    const messages = (messagesRes.data || []).map((m) => ({
      ...m,
      timestamp: m.created_at,
      media_data: undefined
    }));

    return json(res, 200, {
      messages,
      reactions: (reactionsRes.data || []).map((r) => ({ ...r, timestamp: r.created_at })),
      typing: typingUsers,
      read_receipts: readMap,
      moods: moodMap,
      server_time: current
    });
  } catch (err) {
    console.error("GET /poll error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
