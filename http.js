import { timingSafeEqual } from "node:crypto";

export function send(res, status, obj, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}

export function params(req) {
  return new URL(req.url || "/", "http://localhost").searchParams;
}

// Si defines APP_PASSWORD, solo responde a quien envíe esa contraseña.
// Así nadie más gasta tu cuota gratuita de IA ni de datos.
export function authorized(req, env) {
  const expected = env.APP_PASSWORD;
  if (!expected) return true;
  const got = String(req.headers?.["x-app-password"] || "");
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
