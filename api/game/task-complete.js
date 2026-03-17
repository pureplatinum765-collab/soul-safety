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
    if (!actingUserId || !body?.task_id) {
      return json(res, 400, { error: "Invalid payload" });
    }

    await ensureGamePlayer(actingUserId);
    const db = getSupabase();

    const [playerRes, taskRes] = await Promise.all([
      db.from("game_players").select("position, points").eq("user_id", actingUserId).maybeSingle(),
      db.from("game_tasks").select("id, points_awarded").eq("id", body.task_id).maybeSingle()
    ]);

    const player = playerRes.data;
    const task = taskRes.data;
    if (!player) return json(res, 404, { error: "Player not found" });
    if (!task) return json(res, 404, { error: "Task not found" });

    const deltaPoints = Number(task.points_awarded) || 0;
    const newPoints = Number(player.points) + deltaPoints;
    const ts = nowTs();

    await Promise.all([
      db.from("game_players")
        .update({ points: newPoints, updated_at: ts })
        .eq("user_id", actingUserId),
      db.from("game_events").insert({
        id: uuid(),
        user_id: actingUserId,
        event_type: "task_completed",
        delta_position: 0,
        delta_points: deltaPoints,
        task_id: body.task_id,
        note: body.note || null,
        created_at: ts
      })
    ]);

    return json(res, 200, { user_id: actingUserId, position: Number(player.position), points: newPoints });
  } catch (err) {
    console.error("POST /game/task-complete error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
