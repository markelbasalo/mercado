// Noticias recientes: Yahoo Finance (en inglés) y Google Noticias (en español, últimos 3 días).
import { yahooNews } from "./yahoo.js";

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; MercadoClaro/1.0)", Accept: "application/rss+xml, text/xml" };

function decode(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tag(block, name) {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
  if (!m) return "";
  return decode(m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "")).trim();
}

export function parseGoogleRss(xml, limit = 8) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const b = m[1];
    let title = tag(b, "title");
    const url = tag(b, "link");
    const source = tag(b, "source");
    const t = Date.parse(tag(b, "pubDate"));
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    if (title && url) items.push({ title, url, source: source || "Google Noticias", time: Number.isFinite(t) ? t : 0, lang: "es" });
  }
  return items;
}

export async function googleNews(query, limit = 8, fetchImpl = fetch) {
  const q = encodeURIComponent(`${query} when:3d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=es&gl=ES&ceid=ES:es`;
  const r = await fetchImpl(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Google Noticias respondió ${r.status}`);
  return parseGoogleRss(await r.text(), limit);
}

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function mergeNews(lists, { limit = 10, maxAgeMs = 7 * 24 * 3600 * 1000, now = Date.now() } = {}) {
  const seen = new Set();
  const out = [];
  for (const n of lists.flat()) {
    const key = norm(n.title).slice(0, 80);
    if (!key || seen.has(key)) continue;
    if (n.time && now - n.time > maxAgeMs) continue;
    seen.add(key);
    out.push(n);
  }
  out.sort((a, b) => (b.time || 0) - (a.time || 0));
  return out.slice(0, limit);
}

export async function getNews(query, fetchImpl = fetch, opts = {}) {
  const results = await Promise.allSettled([yahooNews(query, 8, fetchImpl), googleNews(query, 8, fetchImpl)]);
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!ok.length) throw new Error("No se pudieron obtener noticias de ninguna fuente");
  return mergeNews(ok, opts);
}
