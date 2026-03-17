import { cors } from "../../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json, uuid, nowTs, ensureGamePlayer, safeJson } from "../../lib/helpers.js";

const BOARD_SIZE = 20;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const body = await safeJson(req);
    const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
    if (!actingUserId) {
      return json(res, 400, { error: "Invalid payload" });
    }

    await ensureGamePlayer(actingUserId);
    const db = getSupabase();

    // Determine whose turn it is by checking the last "moved" event
    const { data: lastMove } = await db
      .from("game_events")
      .select("user_id")
      .eq("event_type", "moved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no moves yet, raphael goes first. Otherwise, alternate.
    const expectedTurn = !lastMove ? "raphael" : (lastMove.user_id === "raphael" ? "taylor" : "raphael");

    if (actingUserId !== expectedTurn) {
      return json(res, 403, { error: "Not your turn", whose_turn: expectedTurn });
    }

    // Roll the dice server-side (1-6)
    const roll = Math.floor(Math.random() * 6) + 1;

    const { data: player } = await db
      .from("game_players")
      .select("position, points")
      .eq("user_id", actingUserId)
      .maybeSingle();

    if (!player) return json(res, 404, { error: "Player not found" });

    let newPos = Number(player.position) + roll;
    let won = false;

    // Check for win (reached or passed the finish)
    if (newPos >= BOARD_SIZE) {
      newPos = BOARD_SIZE; // cap at finish line
      won = true;
    }

    // Special spaces (apply after moving)
    let bonusNote = "";
    if (!won) {
      if (newPos === 5 || newPos === 15) {
        // Bonus: move forward 2
        newPos = Math.min(newPos + 2, BOARD_SIZE);
        bonusNote = " ⭐ Bonus +2!";
        if (newPos >= BOARD_SIZE) won = true;
      } else if (newPos === 9 || newPos === 17) {
        // Penalty: move back 2
        newPos = Math.max(newPos - 2, 0);
        bonusNote = " 🌀 Slip back 2!";
      }
    }

    const ts = nowTs();
    const note = `Rolled ${roll}${bonusNote}${won ? " 🏆 Winner!" : ""}`;

    await Promise.all([
      db.from("game_players")
        .update({ position: newPos, points: won ? Number(player.points) + 10 : Number(player.points), updated_at: ts })
        .eq("user_id", actingUserId),
      db.from("game_events").insert({
        id: uuid(),
        user_id: actingUserId,
        event_type: "moved",
        delta_position: roll,
        delta_points: won ? 10 : 0,
        note,
        created_at: ts
      })
    ]);

    // If won, reset both players after recording the win
    if (won) {
      await db.from("game_events").insert({
        id: uuid(),
        user_id: actingUserId,
        event_type: "game_won",
        delta_position: 0,
        delta_points: 10,
        note: `${actingUserId === "raphael" ? "Raphael" : "Taylor"} wins the round! 🎉`,
        created_at: ts + 1
      });

      // Reset positions (but keep points as lifetime score)
      await Promise.all([
        db.from("game_players").update({ position: 0, updated_at: ts + 2 }).eq("user_id", "raphael"),
        db.from("game_players").update({ position: 0, updated_at: ts + 2 }).eq("user_id", "taylor")
      ]);
    }

    const nextTurn = won ? (actingUserId === "raphael" ? "taylor" : "raphael") : (actingUserId === "raphael" ? "taylor" : "raphael");

    return json(res, 200, {
      user_id: actingUserId,
      roll,
      position: won ? 0 : newPos,
      points: won ? Number(player.points) + 10 : Number(player.points),
      won,
      bonus_note: bonusNote,
      next_turn: nextTurn,
      note
    });
  } catch (err) {
    console.error("POST /game/move error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
