/* site.js — utilidades compartidas: atmósfera, texto que se descifra y pequeños
   comportamientos de formularios. Sin dependencias ni rastreadores. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+<>|{}[]();/#';
  const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  const moneyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const fmtMoney = (cents) => moneyFmt.format(cents / 100) + ' MXN';

  // Espera a que carguen las fuentes indicadas (con tope de tiempo, nunca bloquea).
  function fontsReady(specs, timeout) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const all = Promise.all((specs || []).map((s) => document.fonts.load(s).catch(() => {})));
    return Promise.race([all, sleep(timeout || 1800)]);
  }

  function mountAtmosphere() {
    if (document.querySelector('.atmo')) return;
    const a = document.createElement('div');
    a.className = 'atmo';
    a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<i class="orb a"></i><i class="orb b"></i><i class="orb c"></i>';
    if (!reduce) {
      const n = innerWidth < 700 ? 8 : 14;
      for (let i = 0; i < n; i++) {
        const d = document.createElement('i');
        d.className = 'dust' + (i % 4 === 0 ? ' r' : '');
        const s = 1 + Math.random() * 1.8;
        d.style.left = (Math.random() * 100).toFixed(1) + '%';
        d.style.width = d.style.height = s.toFixed(1) + 'px';
        d.style.setProperty('--o', (0.15 + Math.random() * 0.3).toFixed(2));
        d.style.setProperty('--dx', ((Math.random() * 60 - 30) | 0) + 'px');
        d.style.animationDuration = (26 + Math.random() * 30).toFixed(1) + 's';
        d.style.animationDelay = '-' + (Math.random() * 40).toFixed(1) + 's';
        a.appendChild(d);
      }
    }
    document.body.prepend(a);
  }

  // Convierte el contenido de `el` en una letra por <span>, fijando el ancho de cada una
  // para que el texto no "salte" mientras se mezclan glifos de distinto ancho.
  function splitLocked(el, text) {
    el.textContent = '';
    const chars = [...text];
    const spans = chars.map((ch) => {
      const s = document.createElement('span');
      s.textContent = /\s/.test(ch) ? ' ' : ch;
      el.appendChild(s);
      return s;
    });
    spans.forEach((s) => {
      const w = s.getBoundingClientRect().width;
      s.style.display = 'inline-block';
      s.style.width = w + 'px';
      s.style.textAlign = 'center';
    });
    return { chars, spans };
  }

  // Descifra `text` dentro de `el`: arranca como ruido de código y se resuelve de
  // izquierda a derecha en la tipografía final.
  function decode(el, text, opts) {
    opts = opts || {};
    const delay = opts.delay || 0, step = opts.step || 55;
    const scrambleMs = opts.scrambleMs || 520, jitter = opts.jitter || 140;
    return new Promise((resolve) => {
      if (reduce) { el.textContent = text; resolve(); return; }
      el.setAttribute('aria-label', text);
      const { chars, spans } = splitLocked(el, text);
      const t0 = performance.now();
      const st = spans.map((s, i) => ({
        s, ch: chars[i], last: 0,
        done: /\s/.test(chars[i]),
        at: delay + i * step + scrambleMs + Math.random() * jitter,
      }));
      st.forEach((o) => { if (!o.done) { o.s.classList.add('mx'); o.s.textContent = rnd(); } });
      (function frame(now) {
        const t = now - t0;
        let pending = 0;
        for (const o of st) {
          if (o.done) continue;
          if (t >= o.at) {
            o.s.classList.remove('mx');
            o.s.classList.add('lock');
            o.s.textContent = o.ch;
            o.done = true;
            continue;
          }
          pending++;
          if (t - o.last > 70) { o.s.textContent = rnd(); o.last = t; }
        }
        if (pending) requestAnimationFrame(frame);
        else setTimeout(() => { el.textContent = text; resolve(); }, 450);
      })(t0);
    });
  }

  // Lo contrario: el texto se corrompe en código y se desvanece.
  function scramble(el, ms) {
    ms = ms || 650;
    return new Promise((resolve) => {
      if (reduce) { resolve(); return; }
      const text = el.textContent;
      const { chars, spans } = splitLocked(el, text);
      spans.forEach((s, i) => { if (!/\s/.test(chars[i])) { s.classList.add('mx'); s.textContent = rnd(); } });
      el.style.transition = 'opacity ' + ms + 'ms ease-in';
      requestAnimationFrame(() => { el.style.opacity = '0'; });
      const t0 = performance.now();
      let last = 0;
      (function frame(now) {
        const t = now - t0;
        if (t - last > 70) {
          spans.forEach((s, i) => { if (!/\s/.test(chars[i])) s.textContent = rnd(); });
          last = t;
        }
        if (t < ms) requestAnimationFrame(frame); else resolve();
      })(t0);
    });
  }

  window.Site = { reduce, sleep, esc, fmtMoney, fontsReady, decode, scramble };

  mountAtmosphere();

  // Títulos marcados con data-decode se "descifran" al entrar.
  document.querySelectorAll('[data-decode]').forEach((el) => {
    const text = el.textContent;
    fontsReady(['400 80px "Courier Prime"', '400 16px "Noto Sans JP"'], 1200)
      .then(() => decode(el, text, { step: 70, scrambleMs: 600 }));
  });

  // Formularios con confirmación (acciones delicadas).
  document.addEventListener('submit', (e) => {
    const msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !confirm(msg)) e.preventDefault();
  });

  // Botones "Copiar".
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    try {
      await navigator.clipboard.writeText(b.getAttribute('data-copy'));
      const old = b.textContent;
      b.textContent = 'Copiada';
      setTimeout(() => { b.textContent = old; }, 1800);
    } catch (err) { /* sin permiso de portapapeles: no pasa nada */ }
  });
})();
