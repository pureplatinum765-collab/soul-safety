import { cors } from "../../lib/cors.js";
import { isAuthorized } from "../../lib/auth.js";
import { getSupabase } from "../../lib/db.js";
import { json } from "../../lib/helpers.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    const db = getSupabase();
    const { data: tasks, error } = await db
      .from("game_tasks")
      .select("id, task_type, title, description, points_awarded, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return json(res, 200, tasks || []);
  } catch (err) {
    console.error("GET /game/tasks error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
