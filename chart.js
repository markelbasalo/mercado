import { authorized, params, send } from "../lib/http.js";
import { SYMBOL_RE } from "../lib/assets.js";
import { RANGES } from "../lib/yahoo.js";
import { realDeps } from "../lib/deps.js";

export function createChartHandler(deps) {
  return async function handler(req, res) {
    if (!authorized(req, deps.env)) return send(res, 401, { error: "Contraseña necesaria" });
    const p = params(req);
    const symbol = (p.get("symbol") || "").toUpperCase();
    const range = p.get("range") || "1d";
    if (!SYMBOL_RE.test(symbol)) return send(res, 400, { error: "Símbolo no válido" });
    if (!RANGES[range]) return send(res, 400, { error: "Rango no válido" });
    try {
      const q = await deps.chart(symbol, range);
      send(res, 200, { symbol, range, points: q.points }, { "Cache-Control": "private, max-age=15" });
    } catch (e) {
      send(res, 502, { error: "No se pudo obtener el gráfico" });
    }
  };
}

export default createChartHandler(realDeps);
