import { cors } from "../../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const body = await safeJson(req);
    const actingUserId = resolveActingUserId(auth.userId, body?.challenger);
    const opponent = (body?.opponent || (actingUserId === "raphael" ? "taylor" : "raphael") || "").trim();
    const game = (body?.game || "").trim();

    if (!actingUserId || !opponent || !game) {
      return json(res, 400, { error: "Invalid payload" });
    }
    if (!["pong", "rps", "rock-paper-scissors", "lucky-word"].includes(game)) {
      return json(res, 400, { error: "Unsupported game" });
    }

    await upsertUser(actingUserId);
    await upsertUser(opponent);

    const challengeId = uuid();
    const ts = nowTs();
    const challengePayload = {
      challenge_id: challengeId,
      challenger: actingUserId,
      opponent,
      game,
      status: "pending",
      game_state: {},
      created_at: ts
    };

    const db = getSupabase();

    // Insert challenge message into messages feed
    const messageId = uuid();
    let persistedMessageId = null;
    try {
      await db.from("messages").insert({
        id: messageId,
        user_id: actingUserId,
        type: "challenge",
        content: JSON.stringify(challengePayload),
        created_at: ts
      });
      persistedMessageId = messageId;
    } catch {
      // Fallback if 'challenge' type isn't allowed by a check constraint
      await db.from("messages").insert({
        id: messageId,
        user_id: actingUserId,
        type: "text",
        content: JSON.stringify({ ...challengePayload, message_type: "challenge" }),
        created_at: ts
      });
      persistedMessageId = messageId;
    }

    // Insert challenge record
    const { error } = await db.from("challenges").insert({
      id: challengeId,
      challenger: actingUserId,
      opponent,
      game,
      status: "pending",
      game_state: "{}",
      message_id: persistedMessageId,
      created_at: ts
    });
    if (error) throw error;

    return json(res, 201, {
      id: challengeId,
      challenger: actingUserId,
      opponent,
      game,
      status: "pending",
      game_state: {},
      message_id: persistedMessageId,
      created_at: ts
    });
  } catch (err) {
    console.error("POST /challenge error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
