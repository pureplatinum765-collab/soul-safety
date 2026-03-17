import { cors } from "../../../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../../../lib/auth.js";
import { getSupabase } from "../../../lib/db.js";
import { json, nowTs, safeJson } from "../../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const body = await safeJson(req);
    const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
    if (!actingUserId || body?.move_data === undefined) {
      return json(res, 400, { error: "Invalid payload" });
    }

    const challengeId = req.query.id;
    const db = getSupabase();

    const { data: challenge } = await db
      .from("challenges")
      .select("*")
      .eq("id", challengeId)
      .maybeSingle();

    if (!challenge) return json(res, 404, { error: "Challenge not found" });

    if (actingUserId !== challenge.challenger && actingUserId !== challenge.opponent) {
      return json(res, 403, { error: "Forbidden" });
    }
    if (challenge.status === "declined") {
      return json(res, 409, { error: "Challenge was declined" });
    }

    let gameState = {};
    try {
      gameState = challenge.game_state ? JSON.parse(challenge.game_state) : {};
    } catch {
      gameState = {};
    }

    if (!Array.isArray(gameState.moves)) gameState.moves = [];
    gameState.moves.push({ user_id: actingUserId, move_data: body.move_data, timestamp: nowTs() });

    const newStatus = challenge.status === "pending" ? "active" : challenge.status;
    await db.from("challenges")
      .update({ game_state: JSON.stringify(gameState), status: newStatus })
      .eq("id", challenge.id);

    // Update the challenge message in the feed
    if (challenge.message_id) {
      const msgContent = JSON.stringify({
        challenge_id: challenge.id,
        challenger: challenge.challenger,
        opponent: challenge.opponent,
        game: challenge.game,
        status: newStatus,
        game_state: gameState
      });
      await db.from("messages").update({ content: msgContent }).eq("id", challenge.message_id);
    }

    return json(res, 200, { id: challenge.id, status: newStatus, game_state: gameState });
  } catch (err) {
    console.error("POST /challenge/[id]/move error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
