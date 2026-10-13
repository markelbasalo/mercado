// Llamada a la API de Gemini (plan gratuito con una clave de Google AI Studio).
// Se usa la API "interactions" de la documentación actual y, si el modelo
// o la cuenta no la aceptan, el método generateContent como alternativa.

const HOST = "https://generativelanguage.googleapis.com/v1beta";

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function extractInteractionText(json) {
  const steps = Array.isArray(json?.steps) ? json.steps : [];
  const parts = [];
  for (const s of steps) {
    if (s?.type !== "model_output") continue;
    for (const c of s.content || []) if (c?.type === "text" && c.text) parts.push(c.text);
  }
  if (parts.length) return parts.join("\n").trim();
  if (typeof json?.output_text === "string") return json.output_text.trim();
  return "";
}

export function extractGenerateText(json) {
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

function failFor(status, body) {
  if (status === 429) return new AiError("rate_limited", "Has llegado al límite gratuito de la IA. Espera un poco o inténtalo mañana.");
  if (status === 401 || status === 403) return new AiError("bad_key", "La clave de Gemini no es válida o no tiene permiso. Revisa GEMINI_API_KEY.");
  return new AiError("api_error", `Gemini respondió ${status}. ${String(body).slice(0, 200)}`);
}

export async function callGemini(prompt, { apiKey, model, fetchImpl = fetch }) {
  if (!apiKey) throw new AiError("no_key", "Falta la clave GEMINI_API_KEY.");
  const headers = { "x-goog-api-key": apiKey, "Content-Type": "application/json" };

  const r1 = await fetchImpl(`${HOST}/interactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, input: prompt }),
    signal: AbortSignal.timeout(50000)
  });
  if (r1.ok) {
    const text = extractInteractionText(await r1.json());
    if (text) return text;
  } else if (r1.status === 429 || r1.status === 401 || r1.status === 403) {
    throw failFor(r1.status, await r1.text());
  }

  const r2 = await fetchImpl(`${HOST}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers,
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4 } }),
    signal: AbortSignal.timeout(50000)
  });
  if (!r2.ok) throw failFor(r2.status, await r2.text());
  const text = extractGenerateText(await r2.json());
  if (!text) throw new AiError("empty", "La IA no devolvió texto. Inténtalo de nuevo.");
  return text;
}
