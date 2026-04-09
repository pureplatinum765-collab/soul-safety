import { cors } from "../lib/cors.js";
import { isAuthorized, resolveActingUserId } from "../lib/auth.js";
import { getSupabase } from "../lib/db.js";
import { json, uuid, nowTs, upsertUser, safeJson } from "../lib/helpers.js";

// Consolidated daily-spark router:
// GET  /api/daily-spark/today   → get today's spark + shares + reflections
// POST /api/daily-spark/reflect → submit reflection
// POST /api/daily-spark/share   → share a spark

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const url = req.url || "";
  const subpath = url.replace(/^\/api\/daily-spark\/?/, "").split("?")[0];

  try {
    const auth = await isAuthorized(req);
    if (!auth) return json(res, 401, { error: "Unauthorized" });

    // GET /api/daily-spark/today
    if (subpath === "today" && req.method === "GET") {
      const date = req.query?.date || new Date().toISOString().slice(0, 10);
      const db = getSupabase();

      const { data: spark } = await db
        .from("daily_sparks")
        .select("id, spark_date, spark_type, content, source, created_at")
        .eq("spark_date", date)
        .maybeSingle();

      if (!spark) return json(res, 404, { error: "No spark found", date });

      const [sharesRes, reflectionsRes] = await Promise.all([
        db.from("spark_shares").select("id, spark_id, user_id, message_id, created_at").eq("spark_id", spark.id).order("created_at", { ascending: true }),
        db.from("spark_reflections").select("id, spark_id, user_id, reflection_text, created_at").eq("spark_id", spark.id).order("created_at", { ascending: true })
      ]);

      return json(res, 200, { spark, shares: sharesRes.data || [], reflections: reflectionsRes.data || [] });
    }

    // POST /api/daily-spark/reflect
    if (subpath === "reflect" && req.method === "POST") {
      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.spark_id || !body?.reflection_text) return json(res, 400, { error: "Invalid payload" });

      await upsertUser(actingUserId);
      const id = uuid();
      const ts = nowTs();
      const db = getSupabase();

      const { error } = await db.from("spark_reflections").insert({
        id, spark_id: body.spark_id, user_id: actingUserId, reflection_text: body.reflection_text, created_at: ts
      });
      if (error) throw error;

      return json(res, 201, { id, spark_id: body.spark_id, user_id: actingUserId, reflection_text: body.reflection_text, created_at: ts });
    }

    // POST /api/daily-spark/share
    if (subpath === "share" && req.method === "POST") {
      const body = await safeJson(req);
      const actingUserId = resolveActingUserId(auth.userId, body?.user_id);
      if (!actingUserId || !body?.spark_id) return json(res, 400, { error: "Invalid payload" });

      await upsertUser(actingUserId);
      const id = uuid();
      const ts = nowTs();
      const db = getSupabase();

      const { error } = await db.from("spark_shares").insert({
        id, spark_id: body.spark_id, user_id: actingUserId, message_id: body.message_id || null, created_at: ts
      });
      if (error) throw error;

      return json(res, 201, { id, spark_id: body.spark_id, user_id: actingUserId, message_id: body.message_id || null, created_at: ts });
    }

    return json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("daily-spark handler error:", err);
    return json(res, 500, { error: "Internal server error" });
  }
}
