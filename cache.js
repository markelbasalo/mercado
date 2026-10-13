// Memoria temporal en la propia función: evita repetir peticiones iguales
// en pocos segundos y protege los límites de las fuentes gratuitas.

const store = new Map();

export function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.p;
  const p = Promise.resolve().then(fn);
  store.set(key, { p, exp: now + ttlMs });
  p.catch(() => {
    const cur = store.get(key);
    if (cur && cur.p === p) store.delete(key);
  });
  if (store.size > 300) {
    for (const [k, v] of store) if (v.exp <= now) store.delete(k);
  }
  return p;
}

export function clearCache() {
  store.clear();
}
