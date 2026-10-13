// Conecta las piezas reales (red, caché, claves). Las pruebas usan versiones simuladas.
import { cached } from "./cache.js";
import { fetchChart } from "./yahoo.js";
import { getNews } from "./news.js";
import { callGemini } from "./gemini.js";

export const realDeps = {
  get env() {
    return process.env;
  },
  quote: (symbol) => cached(`q:${symbol}`, 30_000, () => fetchChart(symbol, "1d")),
  chart: (symbol, range) => cached(`c:${symbol}:${range}`, range === "1d" ? 30_000 : 300_000, () => fetchChart(symbol, range)),
  news: (query) => cached(`n:${query}`, 300_000, () => getNews(query)),
  gemini: (prompt) =>
    callGemini(prompt, {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash"
    })
};
