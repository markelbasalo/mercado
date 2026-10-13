// Precios desde el servicio público de gráficos de Yahoo Finance.
// No es una API oficial: puede cambiar o limitar peticiones. Si falla, ver README.

const BASE = "https://query1.finance.yahoo.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json"
};

export const RANGES = { "1d": "5m", "5d": "30m", "1mo": "1d", "6mo": "1d", "1y": "1d" };

export function parseChart(json, symbol) {
  const res = json?.chart?.result?.[0];
  if (!res) throw new Error(json?.chart?.error?.description || `Sin datos para ${symbol}`);
  const m = res.meta || {};
  const ts = res.timestamp || [];
  const closes = res.indicators?.quote?.[0]?.close || [];
  const points = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c)) points.push({ t: ts[i] * 1000, c });
  }
  const price = Number.isFinite(m.regularMarketPrice) ? m.regularMarketPrice : points.at(-1)?.c;
  if (!Number.isFinite(price)) throw new Error(`Sin precio para ${symbol}`);
  const prev = Number.isFinite(m.previousClose) ? m.previousClose : m.chartPreviousClose;
  return {
    symbol: m.symbol || symbol,
    name: m.longName || m.shortName || symbol,
    currency: m.currency || "",
    exchange: m.fullExchangeName || m.exchangeName || "",
    price,
    prevClose: Number.isFinite(prev) ? prev : null,
    dayHigh: Number.isFinite(m.regularMarketDayHigh) ? m.regularMarketDayHigh : null,
    dayLow: Number.isFinite(m.regularMarketDayLow) ? m.regularMarketDayLow : null,
    time: m.regularMarketTime ? m.regularMarketTime * 1000 : (points.at(-1)?.t ?? null),
    points
  };
}

export async function fetchChart(symbol, range = "1d", fetchImpl = fetch) {
  const interval = RANGES[range];
  if (!interval) throw new Error("Rango no válido");
  const url = `${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const r = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Yahoo respondió ${r.status} para ${symbol}`);
  return parseChart(await r.json(), symbol);
}

export async function yahooNews(query, count = 8, fetchImpl = fetch) {
  const url = `${BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&listsCount=0&newsCount=${count}`;
  const r = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Yahoo noticias respondió ${r.status}`);
  const j = await r.json();
  return (j.news || [])
    .filter((n) => n && n.title && n.link)
    .map((n) => ({
      title: String(n.title),
      url: String(n.link),
      source: String(n.publisher || "Yahoo Finance"),
      time: n.providerPublishTime ? n.providerPublishTime * 1000 : 0,
      lang: "en"
    }));
}
