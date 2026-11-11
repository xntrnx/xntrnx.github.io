// Eventos en vivo (Server-Sent Events) para las subastas.
export function createHub({ maxPerChannel = 500 } = {}) {
  const channels = new Map();

  const beat = setInterval(() => {
    for (const set of channels.values()) for (const res of set) res.write(': ping\n\n');
  }, 25_000);
  beat.unref();

  return {
    subscribe(key, req, res, initial) {
      let set = channels.get(key);
      if (!set) channels.set(key, (set = new Set()));
      if (set.size >= maxPerChannel) { res.status(503).end(); return; }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      if (initial) res.write(`event: state\ndata: ${JSON.stringify(initial)}\n\n`);
      set.add(res);
      req.on('close', () => {
        set.delete(res);
        if (!set.size) channels.delete(key);
      });
    },
    publish(key, data) {
      const set = channels.get(key);
      if (!set) return;
      const frame = `event: state\ndata: ${JSON.stringify(data)}\n\n`;
      for (const res of set) res.write(frame);
    },
    close() {
      clearInterval(beat);
      for (const set of channels.values()) for (const res of set) res.end();
      channels.clear();
    },
  };
}
