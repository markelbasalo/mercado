import { authorized, readJson, send } from "../lib/http.js";
import { GENERAL_NEWS_QUERIES, SYMBOL_RE, findAsset } from "../lib/assets.js";
import { loadQuotes } from "../lib/quotes.js";
import { buildPrompt } from "../lib/advisor.js";
import { realDeps } from "../lib/deps.js";

export function createAdviceHandler(deps) {
  return async function handler(req, res) {
    if (req.method !== "POST") return send(res, 405, { error: "Usa POST" });
    if (!authorized(req, deps.env)) return send(res, 401, { error: "Contraseña necesaria" });
    if (!deps.env.GEMINI_API_KEY) return send(res, 500, { error: "Falta la clave GEMINI_API_KEY en la configuración del proyecto." });

    let body;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: "Petición no válida" });
    }

    const focus = body.symbol ? String(body.symbol).toUpperCase() : null;
    if (focus && !SYMBOL_RE.test(focus)) return send(res, 400, { error: "Símbolo no válido" });

    try {
      const { assets } = await loadQuotes(deps, focus && !findAsset(focus) ? [focus] : []);
      if (!assets.length) return send(res, 502, { error: "Sin precios disponibles ahora mismo; no se puede analizar sin datos." });

      const focusMeta = focus ? findAsset(focus) : null;
      const focusQuery = focus ? (focusMeta ? focusMeta.newsQuery : focus.replace(/\.[A-Z]{1,3}$/, "")) : null;
      const [focusNewsR, ...generalR] = await Promise.allSettled([
        focusQuery ? deps.news(focusQuery) : Promise.resolve([]),
        ...GENERAL_NEWS_QUERIES.map((q) => deps.news(q))
      ]);
      const focusNews = focusNewsR.status === "fulfilled" ? focusNewsR.value.slice(0, 8) : [];
      const seen = new Set();
      const generalNews = generalR
        .filter((r) => r.status === "fulfilled")
        .flatMap((r) => r.value)
        .filter((n) => (seen.has(n.title) ? false : seen.add(n.title)))
        .sort((a, b) => (b.time || 0) - (a.time || 0))
        .slice(0, 10);

      const prompt = buildPrompt({ assets, focus, focusNews, generalNews, profile: body.profile, question: body.question });
      const text = await deps.gemini(prompt);
      send(res, 200, {
        text,
        generatedAt: Date.now(),
        usedNews: [...focusNews, ...generalNews].map((n) => ({ title: n.title, url: n.url, source: n.source, time: n.time }))
      });
    } catch (e) {
      const code = e?.code;
      const status = code === "rate_limited" ? 429 : code === "bad_key" || code === "no_key" ? 500 : 502;
      send(res, status, { error: e?.message || "No se pudo completar el análisis", code });
    }
  };
}

export default createAdviceHandler(realDeps);
