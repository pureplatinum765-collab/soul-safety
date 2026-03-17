import { cors } from "../../lib/cors.js";
import { isAuthorized } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json, ensureGamePlayer } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    if (auth.userId) {
      await ensureGamePlayer(auth.userId);
    }

    const db = getSupabase();

    const [playersRes, feedRes, lastMoveRes] = await Promise.all([
      db.from("game_players")
        .select("user_id, position, points, updated_at")
        .order("user_id", { ascending: true }),
      db.from("game_events")
        .select("id, user_id, event_type, delta_position, delta_points, task_id, note, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      db.from("game_events")
        .select("user_id")
        .eq("event_type", "moved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    const players = playersRes.data || [];
    const feed = (feedRes.data || []).map((e) => ({ ...e, timestamp: e.created_at }));
    const lastMove = lastMoveRes.data;

    // Determine whose turn
    const whose_turn = !lastMove ? "raphael" : (lastMove.user_id === "raphael" ? "taylor" : "raphael");

    if (auth.userId) {
      const me = players.find((p) => p.user_id === auth.userId) || null;
      return json(res, 200, { me, players, feed, whose_turn, board_size: 20 });
    }

    return json(res, 200, { players, feed, whose_turn, board_size: 20 });
  } catch (err) {
    console.error("GET /game/state error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
