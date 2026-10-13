// Pruebas con respuestas simuladas (no usan internet): node test/test.mjs
import assert from "node:assert/strict";
import { parseChart, fetchChart } from "../lib/yahoo.js";
import { parseGoogleRss, mergeNews } from "../lib/news.js";
import { extractInteractionText, extractGenerateText, callGemini } from "../lib/gemini.js";
import { buildPrompt } from "../lib/advisor.js";
import { loadQuotes, cleanExtras } from "../lib/quotes.js";
import { authorized } from "../lib/http.js";
import { clearCache } from "../lib/cache.js";
import { createQuotesHandler } from "../api/quotes.js";
import { createChartHandler } from "../api/chart.js";
import { createNewsHandler } from "../api/news.js";
import { createAdviceHandler } from "../api/advice.js";
import { ASSETS } from "../lib/assets.js";

let n = 0;
async function t(name, fn) {
  try {
    await fn();
    n++;
    console.log("ok  -", name);
  } catch (e) {
    console.error("FALLO -", name, "\n", e);
    process.exitCode = 1;
  }
}

const now = Date.UTC(2026, 9, 13, 15, 0, 0);
const chartJson = (symbol, price, prev) => ({
  chart: {
    result: [{
      meta: { symbol, longName: symbol + " largo", currency: "USD", fullExchangeName: "TEST", regularMarketPrice: price, chartPreviousClose: prev, regularMarketDayHigh: price + 1, regularMarketDayLow: price - 1, regularMarketTime: now / 1000 },
      timestamp: [now / 1000 - 600, now / 1000 - 300, now / 1000],
      indicators: { quote: [{ close: [price - 0.5, null, price] }] }
    }],
    error: null
  }
});

const rss = `<?xml version="1.0"?><rss><channel>
<item><title>La bolsa sube con fuerza - Expansión</title><link>https://example.com/a</link><pubDate>Tue, 13 Oct 2026 13:00:00 GMT</pubDate><source url="https://expansion.com">Expansión</source></item>
<item><title><![CDATA[Banca &amp; tipos: el BCE decide - Cinco Días]]></title><link>https://example.com/b</link><pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate><source url="https://cincodias.com">Cinco Días</source></item>
</channel></rss>`;

function fakeFetch(routes = {}) {
  return async (url) => {
    const u = String(url);
    if (u.includes("/v8/finance/chart/")) {
      const sym = decodeURIComponent(u.split("/chart/")[1].split("?")[0]);
      if (sym === "MALO") return { ok: false, status: 404, json: async () => ({}) };
      if (routes.chartStatus) return { ok: false, status: routes.chartStatus, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => chartJson(sym, 100, 98) };
    }
    if (u.includes("/v1/finance/search")) {
      return { ok: true, status: 200, json: async () => ({ news: [{ title: "Nvidia sube tras resultados", link: "https://y.example/1", publisher: "Reuters", providerPublishTime: now / 1000 - 3600 }] }) };
    }
    if (u.includes("news.google.com")) return { ok: true, status: 200, text: async () => rss };
    throw new Error("URL inesperada " + u);
  };
}

function mockRes() {
  const r = { headers: {}, statusCode: 0, body: "" };
  r.setHeader = (k, v) => (r.headers[k] = v);
  r.end = (b) => (r.body = b);
  r.json = () => JSON.parse(r.body);
  return r;
}

function mkDeps(over = {}) {
  const f = over.fetchImpl || fakeFetch();
  return {
    env: { GEMINI_API_KEY: "k", ...(over.env || {}) },
    quote: (s) => fetchChart(s, "1d", f),
    chart: (s, r) => fetchChart(s, r, f),
    news: async (q) => mergeNews([parseGoogleRss(rss), [{ title: "Titular de " + q, url: "https://x.example", source: "Prueba", time: now - 1000, lang: "es" }]], { now }),
    gemini: over.gemini || (async (prompt) => "Resumen: prueba. " + (prompt.includes("Titular de Nvidia") ? "[con noticias]" : "[sin noticias]"))
  };
}

await t("parseChart extrae precio, cierre anterior y descarta nulos", () => {
  const q = parseChart(chartJson("NVDA", 226.27, 226.32), "NVDA");
  assert.equal(q.price, 226.27);
  assert.equal(q.prevClose, 226.32);
  assert.equal(q.points.length, 2);
  assert.equal(q.time, now);
});

await t("parseChart falla con respuesta vacía", () => {
  assert.throws(() => parseChart({ chart: { result: null, error: { description: "No data found" } } }, "X"), /No data found/);
});

await t("fetchChart rechaza rango no válido y errores HTTP", async () => {
  await assert.rejects(() => fetchChart("NVDA", "10y", fakeFetch()), /Rango/);
  await assert.rejects(() => fetchChart("NVDA", "1d", fakeFetch({ chartStatus: 429 })), /429/);
});

await t("parseGoogleRss limpia título, CDATA y entidades", () => {
  const items = parseGoogleRss(rss);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "La bolsa sube con fuerza");
  assert.equal(items[0].source, "Expansión");
  assert.equal(items[1].title, "Banca & tipos: el BCE decide");
  assert.ok(items[0].time > items[1].time);
});

await t("mergeNews elimina duplicados y noticias antiguas y ordena por fecha", () => {
  const out = mergeNews([
    [{ title: "A  noticia", url: "u1", source: "s", time: now - 1000 }, { title: "Vieja", url: "u2", source: "s", time: now - 30 * 24 * 3600 * 1000 }],
    [{ title: "a noticia!", url: "u3", source: "s", time: now - 500 }, { title: "Otra", url: "u4", source: "s", time: now - 100 }]
  ], { now });
  assert.deepEqual(out.map((x) => x.title), ["Otra", "A  noticia"]);
});

await t("extractInteractionText toma solo model_output", () => {
  const j = { steps: [{ type: "thought", signature: "x" }, { type: "model_output", content: [{ type: "text", text: "Hola" }, { type: "text", text: "mundo" }] }] };
  assert.equal(extractInteractionText(j), "Hola\nmundo");
  assert.equal(extractGenerateText({ candidates: [{ content: { parts: [{ text: "a" }, { text: "b" }] } }] }), "ab");
});

await t("callGemini usa interactions y cae a generateContent si falla", async () => {
  const calls = [];
  const f1 = async (url) => { calls.push(String(url)); return { ok: true, status: 200, json: async () => ({ steps: [{ type: "model_output", content: [{ type: "text", text: "OK1" }] }] }) }; };
  assert.equal(await callGemini("p", { apiKey: "k", model: "m", fetchImpl: f1 }), "OK1");
  assert.ok(calls[0].endsWith("/interactions"));
  const f2 = async (url) => String(url).endsWith("/interactions")
    ? { ok: false, status: 404, text: async () => "no" }
    : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: "OK2" }] } }] }) };
  assert.equal(await callGemini("p", { apiKey: "k", model: "m", fetchImpl: f2 }), "OK2");
});

await t("callGemini distingue límite de uso y clave mala", async () => {
  const f = (status) => async () => ({ ok: false, status, text: async () => "x" });
  await assert.rejects(() => callGemini("p", { apiKey: "k", model: "m", fetchImpl: f(429) }), (e) => e.code === "rate_limited");
  await assert.rejects(() => callGemini("p", { apiKey: "k", model: "m", fetchImpl: f(403) }), (e) => e.code === "bad_key");
  await assert.rejects(() => callGemini("p", { apiKey: "", model: "m" }), (e) => e.code === "no_key");
});

await t("cleanExtras valida, ignora repetidos y los que ya existen", () => {
  assert.deepEqual(cleanExtras(["amzn", "AMZN", "NVDA", "x y", "rep.mc", "<script>"]), ["AMZN", "REP.MC"]);
});

await t("loadQuotes calcula variación y reporta los que fallan", async () => {
  clearCache();
  const d = mkDeps();
  const r = await loadQuotes(d, ["MALO", "AMZN"]);
  assert.equal(r.assets.length, ASSETS.length + 1);
  assert.deepEqual(r.errors, ["MALO"]);
  const a = r.assets.find((x) => x.id === "NVDA");
  assert.equal(a.cat, "acc");
  assert.ok(Math.abs(a.changePct - (2 / 98) * 100) < 1e-9);
  assert.equal(r.assets.find((x) => x.id === "AMZN").cat, "mine");
});

await t("authorized exige contraseña solo si está configurada", () => {
  assert.equal(authorized({ headers: {} }, {}), true);
  assert.equal(authorized({ headers: {} }, { APP_PASSWORD: "abc" }), false);
  assert.equal(authorized({ headers: { "x-app-password": "abc" } }, { APP_PASSWORD: "abc" }), true);
  assert.equal(authorized({ headers: { "x-app-password": "abd" } }, { APP_PASSWORD: "abc" }), false);
});

await t("buildPrompt incluye precios, noticias, fecha, perfil y formato", () => {
  const assets = [{ id: "NVDA", name: "Nvidia", price: 226.27, changePct: -0.02, currency: "USD", time: now - 60000, dayHigh: 227, dayLow: 223 }];
  const p = buildPrompt({ assets, focus: "NVDA", focusNews: [{ title: "Nvidia sube", source: "Reuters", time: now - 3600000 }], generalNews: [{ title: "El BCE mantiene tipos", source: "Expansión", time: now - 7200000 }], profile: { capital: "5000 €", riesgo: "alto", horizonte: "raro", cartera: "10 NVDA" }, question: "¿Compro?", now });
  for (const s of ["martes, 13 de octubre de 2026", "Nvidia (NVDA): 226,27".replace(",", "."), "[1]", "El BCE mantiene tipos", "5000 €", "Tolerancia al riesgo: alto", "Horizonte: medio", "PREGUNTA DEL INVERSOR: ¿Compro?", "no es asesoramiento financiero"]) {
    assert.ok(p.includes(s), "falta: " + s);
  }
});

await t("api/quotes: 401 sin contraseña, 200 con ella", async () => {
  clearCache();
  const h = createQuotesHandler(mkDeps({ env: { APP_PASSWORD: "pw" } }));
  const r1 = mockRes();
  await h({ url: "/api/quotes", headers: {} }, r1);
  assert.equal(r1.statusCode, 401);
  const r2 = mockRes();
  await h({ url: "/api/quotes?extra=AMZN", headers: { "x-app-password": "pw" } }, r2);
  assert.equal(r2.statusCode, 200);
  assert.equal(r2.json().assets.length, ASSETS.length + 1);
  assert.ok(r2.headers["Cache-Control"].startsWith("private"));
});

await t("api/quotes: 502 si ninguna fuente responde", async () => {
  const h = createQuotesHandler(mkDeps({ fetchImpl: fakeFetch({ chartStatus: 429 }) }));
  const r = mockRes();
  await h({ url: "/api/quotes", headers: {} }, r);
  assert.equal(r.statusCode, 502);
});

await t("api/chart valida símbolo y rango", async () => {
  const h = createChartHandler(mkDeps());
  let r = mockRes(); await h({ url: "/api/chart?symbol=%3Cx%3E&range=1d", headers: {} }, r); assert.equal(r.statusCode, 400);
  r = mockRes(); await h({ url: "/api/chart?symbol=NVDA&range=99y", headers: {} }, r); assert.equal(r.statusCode, 400);
  r = mockRes(); await h({ url: "/api/chart?symbol=NVDA&range=5d", headers: {} }, r); assert.equal(r.statusCode, 200); assert.equal(r.json().points.length, 2);
});

await t("api/news devuelve titulares del activo", async () => {
  const h = createNewsHandler(mkDeps());
  const r = mockRes();
  await h({ url: "/api/news?symbol=NVDA", headers: {} }, r);
  assert.equal(r.statusCode, 200);
  assert.ok(r.json().news.some((x) => x.title === "Titular de Nvidia"));
});

await t("api/advice: monta la consulta con noticias y devuelve texto y fuentes", async () => {
  clearCache();
  let seen = "";
  const h = createAdviceHandler(mkDeps({ gemini: async (p) => { seen = p; return "Resumen: ok"; } }));
  const r = mockRes();
  await h({ method: "POST", url: "/api/advice", headers: {}, body: { symbol: "NVDA", question: "¿Qué hago?", profile: { riesgo: "bajo" } } }, r);
  assert.equal(r.statusCode, 200);
  const j = r.json();
  assert.equal(j.text, "Resumen: ok");
  assert.ok(j.usedNews.length > 0);
  assert.ok(seen.includes("Titular de Nvidia") && seen.includes("ACTIVO EN FOCO") && seen.includes("¿Qué hago?"));
});

await t("api/advice: errores claros (sin clave, límite de IA, método, símbolo)", async () => {
  let r = mockRes();
  await createAdviceHandler(mkDeps({ env: { GEMINI_API_KEY: "" } }))({ method: "POST", url: "/", headers: {}, body: {} }, r);
  assert.equal(r.statusCode, 500);
  r = mockRes();
  await createAdviceHandler(mkDeps())({ method: "GET", url: "/", headers: {} }, r);
  assert.equal(r.statusCode, 405);
  r = mockRes();
  await createAdviceHandler(mkDeps())({ method: "POST", url: "/", headers: {}, body: { symbol: "<mal>" } }, r);
  assert.equal(r.statusCode, 400);
  clearCache();
  r = mockRes();
  const lim = Object.assign(new Error("Límite alcanzado"), { code: "rate_limited" });
  await createAdviceHandler(mkDeps({ gemini: async () => { throw lim; } }))({ method: "POST", url: "/", headers: {}, body: {} }, r);
  assert.equal(r.statusCode, 429);
});

console.log(`\n${n} pruebas correctas`);
