import { cors } from "../lib/cors.js";

/** GET /api/client-config
 *  Returns the public Supabase config needed for frontend real-time features.
 *  No authentication required — only public/anon key is exposed.
 */
export default function handler(req, res) {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  });
}
