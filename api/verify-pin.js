import { cors } from "../lib/cors.js";
import { safeJson, json } from "../lib/helpers.js";

// POST /api/verify-pin
// Body: { pin: "..." }
// Returns: { ok: true, token: "..." } or { ok: false, error: "Incorrect PIN" }
export default async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await safeJson(req);
    const providedPin = typeof body?.pin === "string" ? body.pin.trim() : "";

    const correctPin = process.env.SOUL_SAFETY_PIN || "";
    const apiToken = process.env.SOUL_SAFETY_API_TOKEN || "";

    if (!correctPin) {
      // Misconfigured — fail closed
      return json(res, 500, { ok: false, error: "Server misconfigured" });
    }

    if (providedPin !== correctPin) {
      return json(res, 401, { ok: false, error: "Incorrect PIN" });
    }

    return json(res, 200, { ok: true, token: apiToken });
  } catch (err) {
    console.error("verify-pin error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}
