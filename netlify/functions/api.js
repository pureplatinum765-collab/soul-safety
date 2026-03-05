// netlify/functions/api.js — Soul Safety API (Netlify Serverless)
// Uses Netlify Blobs for persistent storage

import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Content-Type": "application/json"
};

function respond(status, body) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

async function getData(store, key, fallback) {
  try {
    const val = await store.get(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

async function setData(store, key, data) {
  await store.set(key, JSON.stringify(data));
}

function uuid() {
  return Math.random().toString(36).substring(2, 10);
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "");
  const store = getStore("soul-safety");

  try {
    if (req.method === "GET" && path === "/messages") {
      const since = parseFloat(url.searchParams.get("since") || "0");
      const messages = await getData(store, "messages", []);
      const filtered = messages.filter(m => m.timestamp > since);
      return respond(200, filtered);
    }

    if (req.method === "POST" && path === "/messages/text") {
      const body = await req.json();
      const messages = await getData(store, "messages", []);
      const msg = {
        id: uuid(),
        user_id: body.user_id,
        type: "text",
        content: body.content,
        timestamp: Date.now() / 1000
      };
      messages.push(msg);
      if (messages.length > 500) messages.splice(0, messages.length - 500);
      await setData(store, "messages", messages);
      return respond(201, msg);
    }

    if (req.method === "POST" && path === "/messages/media") {
      const formData = await req.formData();
      const userId = formData.get("user_id");
      const mediaTypeName = formData.get("media_type_name");
      const duration = formData.get("duration");
      const file = formData.get("file");

      let mediaData = null;
      let mediaContentType = null;
      if (file && file.size > 0) {
        const buffer = await file.arrayBuffer();
        mediaData = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        mediaContentType = file.type;
      }

      const messages = await getData(store, "messages", []);
      const msg = {
        id: uuid(),
        user_id: userId,
        type: mediaTypeName,
        media_data: mediaData,
        media_type: mediaContentType,
        duration: duration,
        timestamp: Date.now() / 1000
      };
      messages.push(msg);
      if (messages.length > 500) messages.splice(0, messages.length - 500);
      await setData(store, "messages", messages);
      return respond(201, { ...msg, media_data: undefined });
    }

    const mediaMatch = path.match(/^\/messages\/([^/]+)\/media$/);
    if (req.method === "GET" && mediaMatch) {
      const msgId = mediaMatch[1];
      const messages = await getData(store, "messages", []);
      const msg = messages.find(m => m.id === msgId);
      if (!msg || !msg.media_data) {
        return respond(404, { error: "Media not found" });
      }
      const binary = Uint8Array.from(atob(msg.media_data), c => c.charCodeAt(0));
      return new Response(binary, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": msg.media_type || "application/octet-stream" }
      });
    }

    const reactMatch = path.match(/^\/reactions\/([^/]+)$/);
    if (req.method === "POST" && reactMatch) {
      const messageId = reactMatch[1];
      const body = await req.json();
      const reactions = await getData(store, "reactions", []);
      const idx = reactions.findIndex(
        r => r.message_id === messageId && r.user_id === body.user_id && r.emoji === body.emoji
      );
      if (idx >= 0) {
        reactions.splice(idx, 1);
        await setData(store, "reactions", reactions);
        return respond(200, { toggled: "off" });
      } else {
        reactions.push({
          id: uuid(), message_id: messageId,
          user_id: body.user_id, emoji: body.emoji,
          timestamp: Date.now() / 1000
        });
        await setData(store, "reactions", reactions);
        return respond(201, { toggled: "on" });
      }
    }

    if (req.method === "POST" && path === "/typing") {
      const body = await req.json();
      const typing = await getData(store, "typing", {});
      typing[body.user_id] = { is_typing: body.is_typing, updated_at: Date.now() / 1000 };
      await setData(store, "typing", typing);
      return respond(200, { ok: true });
    }

    if (req.method === "POST" && path === "/read") {
      const body = await req.json();
      const reads = await getData(store, "read_receipts", {});
      reads[body.user_id] = body.last_read_message_id;
      await setData(store, "read_receipts", reads);
      return respond(200, { ok: true });
    }

    if (req.method === "POST" && path === "/mood") {
      const body = await req.json();
      const moods = await getData(store, "moods", {});
      moods[body.user_id] = { emoji: body.emoji, text: body.text };
      await setData(store, "moods", moods);
      return respond(200, { ok: true });
    }

    if (req.method === "GET" && path === "/poll") {
      const since = parseFloat(url.searchParams.get("since") || "0");
      const [messages, reactions, typing, reads, moods] = await Promise.all([
        getData(store, "messages", []),
        getData(store, "reactions", []),
        getData(store, "typing", {}),
        getData(store, "read_receipts", {}),
        getData(store, "moods", {})
      ]);

      const now = Date.now() / 1000;
      const typingUsers = Object.entries(typing)
        .filter(([_, v]) => v.is_typing && (now - v.updated_at) < 5)
        .map(([k]) => k);

      return respond(200, {
        messages: messages.filter(m => m.timestamp > since).map(m => ({ ...m, media_data: undefined })),
        reactions: reactions.filter(r => r.timestamp > since),
        typing: typingUsers,
        read_receipts: reads,
        moods: moods,
        server_time: now
      });
    }

    const deleteMatch = path.match(/^\/messages\/([^/]+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      const msgId = deleteMatch[1];
      const messages = await getData(store, "messages", []);
      const filtered = messages.filter(m => m.id !== msgId);
      await setData(store, "messages", filtered);
      return respond(200, { deleted: msgId });
    }

    return respond(404, { error: "Not found" });
  } catch (err) {
    console.error("API error:", err);
    return respond(500, { error: err.message });
  }
};

export const config = {
  path: "/api/*"
};
