import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../lib/helpers.js";

// Consolidated challenge router:
// POST /api/challenge           → create challenge
// POST /api/challenge/:id/move  → make a game move
// POST /api/challenge/:id/respond → accept/decline

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = req.url || "";
  const after = url.replace(/^\/api\/challenge\/?/, "").split("?")[0];
  // after: "" | ":id/move" | ":id/respond"

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    // POST /api/challenge — create
    if (after === "" && req.method === "POST") {
      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.challenger);
      const opponent = (body?.opponent || (actingUserId === "raphael" ? "taylor" : "raphael") || "").trim();
      const game = (body?.game || "").trim();

      if (!actingUserId || !opponent || !game) return json(res, 400, { error: "Invalid payload" });
      if (!["pong", "rps", "rock-paper-scissors", "lucky-word"].includes(game)) return json(res, 400, { error: "Unsupported game" });

      await upsertUser(actingUserId);
      await upsertUser(opponent);

      const challengeId = uuid();
      const ts = nowTs();
      const challengePayload = { challenge_id: challengeId, challenger: actingUserId, opponent, game, status: "pending", game_state: {}, created_at: ts };

      const db = getSupabase();
      const messageId = uuid();
      let persistedMessageId = null;

      try {
        await db.from("messages").insert({ id: messageId, user_id: actingUserId, type: "challenge", content: JSON.stringify(challengePayload), created_at: ts });
        persistedMessageId = messageId;
      } catch {
        await db.from("messages").insert({ id: messageId, user_id: actingUserId, type: "text", content: JSON.stringify({ ...challengePayload, message_type: "challenge" }), created_at: ts });
        persistedMessageId = messageId;
      }

      const { error } = await db.from("challenges").insert({ id: challengeId, challenger: actingUserId, opponent, game, status: "pending", game_state: "{}", message_id: persistedMessageId, created_at: ts });
      if (error) throw error;

      return json(res, 201, { id: challengeId, challenger: actingUserId, opponent, game, status: "pending", game_state: {}, message_id: persistedMessageId, created_at: ts });
    }

    // POST /api/challenge/:id/move
    if (after.endsWith("/move") && req.method === "POST") {
      const challengeId = after.replace(/\/move$/, "");
      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || body?.move_data === undefined) return json(res, 400, { error: "Invalid payload" });

      const db = getSupabase();
      const { data: challenge } = await db.from("challenges").select("*").eq("id", challengeId).maybeSingle();
      if (!challenge) return json(res, 404, { error: "Challenge not found" });
      if (actingUserId !== challenge.challenger && actingUserId !== challenge.opponent) return json(res, 403, { error: "Forbidden" });
      if (challenge.status === "declined") return json(res, 409, { error: "Challenge was declined" });

      let gameState = {};
      try { gameState = challenge.game_state ? JSON.parse(challenge.game_state) : {}; } catch { gameState = {}; }
      if (!Array.isArray(gameState.moves)) gameState.moves = [];
      gameState.moves.push({ user_id: actingUserId, move_data: body.move_data, timestamp: nowTs() });

      const newStatus = challenge.status === "pending" ? "active" : challenge.status;
      await db.from("challenges").update({ game_state: JSON.stringify(gameState), status: newStatus }).eq("id", challenge.id);

      if (challenge.message_id) {
        const msgContent = JSON.stringify({ challenge_id: challenge.id, challenger: challenge.challenger, opponent: challenge.opponent, game: challenge.game, status: newStatus, game_state: gameState });
        await db.from("messages").update({ content: msgContent }).eq("id", challenge.message_id);
      }

      return json(res, 200, { id: challenge.id, status: newStatus, game_state: gameState });
    }

    // POST /api/challenge/:id/respond
    if (after.endsWith("/respond") && req.method === "POST") {
      const challengeId = after.replace(/\/respond$/, "");
      const body = await safeJson(req);
      const response = body?.response;
      if (response !== "accept" && response !== "decline") return json(res, 400, { error: "Invalid response" });

      const db = getSupabase();
      const { data: challenge } = await db.from("challenges").select("*").eq("id", challengeId).maybeSingle();
      if (!challenge) return json(res, 404, { error: "Challenge not found" });

      const actingUserId = auth.userId || body?.user_id || null;
      if (!actingUserId || actingUserId !== challenge.opponent) return json(res, 403, { error: "Only the challenged player can respond" });

      const nextStatus = response === "accept" ? "accepted" : "declined";
      await db.from("challenges").update({ status: nextStatus }).eq("id", challenge.id);

      if (challenge.message_id) {
        const content = JSON.stringify({ challenge_id: challenge.id, challenger: challenge.challenger, opponent: challenge.opponent, game: challenge.game, status: nextStatus });
        await db.from("messages").update({ content }).eq("id", challenge.message_id);
      }

      return json(res, 200, { id: challenge.id, status: nextStatus });
    }

    return json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("challenge handler error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
