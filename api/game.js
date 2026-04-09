import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, ensureGamePlayer, safeJson } from "../lib/helpers.js";

// Consolidated game router:
// GET  /api/game/state         → game state
// POST /api/game/move          → roll dice / move
// GET  /api/game/tasks         → list tasks
// POST /api/game/task-complete → complete task

const BOARD_SIZE = 20;

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = req.url || "";
  const subpath = url.replace(/^\/api\/game\/?/, "").split("?")[0];

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    // GET /api/game/state
    if (subpath === "state" && req.method === "GET") {
      if (auth.userId) await ensureGamePlayer(auth.userId);
      const db = getSupabase();
      const [playersRes, feedRes, lastMoveRes] = await Promise.all([
        db.from("game_players").select("user_id, position, points, updated_at").order("user_id", { ascending: true }),
        db.from("game_events").select("id, user_id, event_type, delta_position, delta_points, task_id, note, created_at").order("created_at", { ascending: false }).limit(20),
        db.from("game_events").select("user_id").eq("event_type", "moved").order("created_at", { ascending: false }).limit(1).maybeSingle()
      ]);
      const players = playersRes.data || [];
      const feed = (feedRes.data || []).map((e) => ({ ...e, timestamp: e.created_at }));
      const lastMove = lastMoveRes.data;
      const whose_turn = !lastMove ? "raphael" : (lastMove.user_id === "raphael" ? "taylor" : "raphael");
      if (auth.userId) {
        const me = players.find((p) => p.user_id === auth.userId) || null;
        return json(res, 200, { me, players, feed, whose_turn, board_size: BOARD_SIZE });
      }
      return json(res, 200, { players, feed, whose_turn, board_size: BOARD_SIZE });
    }

    // POST /api/game/move
    if (subpath === "move" && req.method === "POST") {
      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId) return json(res, 400, { error: "Invalid payload" });

      await ensureGamePlayer(actingUserId);
      const db = getSupabase();

      const { data: lastMove } = await db.from("game_events").select("user_id").eq("event_type", "moved").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const expectedTurn = !lastMove ? "raphael" : (lastMove.user_id === "raphael" ? "taylor" : "raphael");

      if (actingUserId !== expectedTurn) {
        return json(res, 403, { error: "Not your turn", whose_turn: expectedTurn });
      }

      const roll = Math.floor(Math.random() * 6) + 1;
      const { data: player } = await db.from("game_players").select("position, points").eq("user_id", actingUserId).maybeSingle();
      if (!player) return json(res, 404, { error: "Player not found" });

      let newPos = Number(player.position) + roll;
      let won = false;
      if (newPos >= BOARD_SIZE) { newPos = BOARD_SIZE; won = true; }

      let bonusNote = "";
      if (!won) {
        if (newPos === 5 || newPos === 15) {
          newPos = Math.min(newPos + 2, BOARD_SIZE);
          bonusNote = " ⭐ Bonus +2!";
          if (newPos >= BOARD_SIZE) won = true;
        } else if (newPos === 9 || newPos === 17) {
          newPos = Math.max(newPos - 2, 0);
          bonusNote = " 🌀 Slip back 2!";
        }
      }

      const ts = nowTs();
      const note = `Rolled ${roll}${bonusNote}${won ? " 🏆 Winner!" : ""}`;

      await Promise.all([
        db.from("game_players").update({ position: newPos, points: won ? Number(player.points) + 10 : Number(player.points), updated_at: ts }).eq("user_id", actingUserId),
        db.from("game_events").insert({ id: uuid(), user_id: actingUserId, event_type: "moved", delta_position: roll, delta_points: won ? 10 : 0, note, created_at: ts })
      ]);

      if (won) {
        await db.from("game_events").insert({ id: uuid(), user_id: actingUserId, event_type: "game_won", delta_position: 0, delta_points: 10, note: `${actingUserId === "raphael" ? "Raphael" : "Taylor"} wins the round! 🎉`, created_at: ts + 1 });
        await Promise.all([
          db.from("game_players").update({ position: 0, updated_at: ts + 2 }).eq("user_id", "raphael"),
          db.from("game_players").update({ position: 0, updated_at: ts + 2 }).eq("user_id", "taylor")
        ]);
      }

      const nextTurn = actingUserId === "raphael" ? "taylor" : "raphael";
      return json(res, 200, { user_id: actingUserId, roll, position: won ? 0 : newPos, points: won ? Number(player.points) + 10 : Number(player.points), won, bonus_note: bonusNote, next_turn: nextTurn, note });
    }

    // GET /api/game/tasks
    if (subpath === "tasks" && req.method === "GET") {
      const db = getSupabase();
      const { data: tasks, error } = await db.from("game_tasks").select("id, task_type, title, description, points_awarded, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return json(res, 200, tasks || []);
    }

    // POST /api/game/task-complete
    if (subpath === "task-complete" && req.method === "POST") {
      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.task_id) return json(res, 400, { error: "Invalid payload" });

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
        db.from("game_players").update({ points: newPoints, updated_at: ts }).eq("user_id", actingUserId),
        db.from("game_events").insert({ id: uuid(), user_id: actingUserId, event_type: "task_completed", delta_position: 0, delta_points: deltaPoints, task_id: body.task_id, note: body.note || null, created_at: ts })
      ]);

      return json(res, 200, { user_id: actingUserId, position: Number(player.position), points: newPoints });
    }

    return json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("game handler error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
