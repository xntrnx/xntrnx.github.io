// Límite de intentos en memoria (ventana fija). Suficiente para una sola instancia.
export function createLimiter() {
  const hits = new Map();

  function check(key, max, windowMs, now = Date.now()) {
    let e = hits.get(key);
    if (!e || e.reset <= now) {
      e = { n: 0, reset: now + windowMs };
      hits.set(key, e);
    }
    e.n += 1;
    return e.n <= max;
  }

  function sweep(now = Date.now()) {
    for (const [k, e] of hits) if (e.reset <= now) hits.delete(k);
  }

  return { check, sweep };
}
