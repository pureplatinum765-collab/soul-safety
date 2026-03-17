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

    const date = req.query?.date || new Date().toISOString().slice(0, 10);
    const db = getSupabase();

    const { data: spark } = await db
      .from("daily_sparks")
      .select("id, spark_date, spark_type, content, source, created_at")
      .eq("spark_date", date)
      .maybeSingle();

    if (!spark) return json(res, 404, { error: "No spark found", date });

    const [sharesRes, reflectionsRes] = await Promise.all([
      db.from("spark_shares")
        .select("id, spark_id, user_id, message_id, created_at")
        .eq("spark_id", spark.id)
        .order("created_at", { ascending: true }),
      db.from("spark_reflections")
        .select("id, spark_id, user_id, reflection_text, created_at")
        .eq("spark_id", spark.id)
        .order("created_at", { ascending: true })
    ]);

    return json(res, 200, {
      spark,
      shares: sharesRes.data || [],
      reflections: reflectionsRes.data || []
    });
  } catch (err) {
    console.error("GET /daily-spark/today error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
