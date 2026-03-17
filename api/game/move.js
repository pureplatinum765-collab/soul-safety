import { cors } from "../../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json, uuid, nowTs, ensureGamePlayer, safeJson } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const body = await safeJson(req);
    const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
    if (!actingUserId || !Number.isInteger(body?.delta_position)) {
      return json(res, 400, { error: "Invalid payload" });
    }

    await ensureGamePlayer(actingUserId);
    const db = getSupabase();

    const { data: player } = await db
      .from("game_players")
      .select("position, points")
      .eq("user_id", actingUserId)
      .maybeSingle();

    if (!player) return json(res, 404, { error: "Player not found" });

    const newPos = Number(player.position) + Number(body.delta_position);
    const ts = nowTs();

    await Promise.all([
      db.from("game_players")
        .update({ position: newPos, updated_at: ts })
        .eq("user_id", actingUserId),
      db.from("game_events").insert({
        id: uuid(),
        user_id: actingUserId,
        event_type: "moved",
        delta_position: body.delta_position,
        delta_points: 0,
        note: body.note || null,
        created_at: ts
      })
    ]);

    return json(res, 200, { user_id: actingUserId, position: newPos, points: Number(player.points) });
  } catch (err) {
    console.error("POST /game/move error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
