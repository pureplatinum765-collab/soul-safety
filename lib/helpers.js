import crypto from "crypto";
import { getSupabase } from "./db.js";

export function nowTs() {
  return Math.floor(Date.now() / 1000);
}

export function uuid() {
  return crypto.randomUUID();
}

export function json(res, status, body) {
  res.status(status).json(body);
}

export async function upsertUser(userId) {
  if (!userId) return;
  const displayName = userId === "raphael" ? "Raphael" : userId === "taylor" ? "Taylor" : userId;
  const db = getSupabase();
  await db.from("users").upsert(
    { id: userId, display_name: displayName },
    { onConflict: "id" }
  );
}

export async function ensureGamePlayer(userId) {
  if (!userId) return;
  await upsertUser(userId);
  const db = getSupabase();
  await db.from("game_players").upsert(
    { user_id: userId, position: 0, points: 0, updated_at: nowTs() },
    { onConflict: "user_id", ignoreDuplicates: true }
  );
}

const SCRYPT_PREFIX = "$scrypt$";

function scryptKey(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scryptKey(password, salt);
  return `${SCRYPT_PREFIX}${salt}:${key}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash) return true;
  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const [salt, expected] = storedHash.slice(SCRYPT_PREFIX.length).split(":");
    const actual = await scryptKey(password, salt);
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  }
  // Legacy SHA-256 — verified on login, then re-hashed with scrypt
  return crypto.createHash("sha256").update(password).digest("hex") === storedHash;
}

export function buildSessionCookie(token, maxAgeSeconds) {
  return `soul_safety_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function safeJson(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined && req.body !== null) {
      resolve(req.body);
      return;
    }
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}
