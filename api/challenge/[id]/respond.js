import { cors } from "../../../lib/cors.js";
import { isAuthorized } from "../../../lib/auth.js";
import { getSupabase } from "../../../lib/db.js";
import { json, safeJson } from "../../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const body = await safeJson(req);
    const response = body?.response;
    if (response !== "accept" && response !== "decline") {
      return json(res, 400, { error: "Invalid response" });
    }

    const challengeId = req.query.id;
    const db = getSupabase();

    const { data: challenge } = await db
      .from("challenges")
      .select("*")
      .eq("id", challengeId)
      .maybeSingle();

    if (!challenge) return json(res, 404, { error: "Challenge not found" });

    const actingUserId = auth.userId || body?.user_id || null;
    if (!actingUserId || actingUserId !== challenge.opponent) {
      return json(res, 403, { error: "Only the challenged player can respond" });
    }

    const nextStatus = response === "accept" ? "accepted" : "declined";
    await db.from("challenges").update({ status: nextStatus }).eq("id", challenge.id);

    // Update the challenge message in the feed
    if (challenge.message_id) {
      const content = JSON.stringify({
        challenge_id: challenge.id,
        challenger: challenge.challenger,
        opponent: challenge.opponent,
        game: challenge.game,
        status: nextStatus
      });
      await db.from("messages").update({ content }).eq("id", challenge.message_id);
    }

    return json(res, 200, { id: challenge.id, status: nextStatus });
  } catch (err) {
    console.error("POST /challenge/[id]/respond error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
