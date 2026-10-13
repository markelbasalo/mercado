import { ASSETS, SYMBOL_RE, findAsset } from "./assets.js";

export function cleanExtras(list, max = 10) {
  const out = [];
  for (const raw of list) {
    const s = String(raw || "").trim().toUpperCase();
    if (!SYMBOL_RE.test(s) || findAsset(s) || out.includes(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// deps.quote(symbol) devuelve el resultado de fetchChart(symbol, "1d")
export async function loadQuotes(deps, extras = []) {
  const wanted = [...ASSETS.map((a) => a.id), ...cleanExtras(extras)];
  const settled = await Promise.allSettled(wanted.map((s) => deps.quote(s)));
  const assets = [];
  const errors = [];
  settled.forEach((r, i) => {
    const sym = wanted[i];
    if (r.status !== "fulfilled") {
      errors.push(sym);
      return;
    }
    const q = r.value;
    const meta = findAsset(sym);
    const change = q.prevClose != null ? q.price - q.prevClose : null;
    assets.push({
      id: sym,
      short: meta?.short || sym,
      name: meta?.name || q.name,
      cat: meta?.cat || "mine",
      price: q.price,
      prevClose: q.prevClose,
      change,
      changePct: q.prevClose ? (change / q.prevClose) * 100 : null,
      dayHigh: q.dayHigh,
      dayLow: q.dayLow,
      time: q.time,
      currency: q.currency,
      exchange: q.exchange
    });
  });
  return { updatedAt: Date.now(), assets, errors };
}
