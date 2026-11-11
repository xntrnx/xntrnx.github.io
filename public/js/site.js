/* site.js — utilidades compartidas: cielo de fondo, texto que aparece entre bruma y pequeños
   comportamientos de formularios. Sin dependencias ni rastreadores. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  // Cielo: nubes que derivan muy despacio detrás del contenido.
  function mountAtmosphere() {
    if (document.querySelector('.atmo')) return;
    const a = document.createElement('div');
    a.className = 'atmo';
    a.setAttribute('aria-hidden', 'true');
    a.innerHTML = '<i class="cloud a"></i><i class="cloud b"></i><i class="cloud c"></i><i class="cloud d"></i>';
    document.body.prepend(a);
  }

  // El texto aparece como bruma que se disipa, letra por letra.
  function reveal(el, text, opts) {
    opts = opts || {};
    const step = opts.step || 60;
    el.classList.remove('out');
    if (reduce) { el.textContent = text; return Promise.resolve(); }
    el.setAttribute('aria-label', text);
    el.textContent = '';
    el.classList.add('rv');
    const chars = [...text];
    chars.forEach((ch, i) => {
      const s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      s.textContent = /\s/.test(ch) ? ' ' : ch;
      s.style.animationDelay = (i * step) + 'ms';
      el.appendChild(s);
    });
    return sleep(chars.length * step + 1500);
  }
  // Lo contrario: el texto se deshace en bruma.
  function dissolve(el) {
    if (reduce) return Promise.resolve();
    el.querySelectorAll('span').forEach((s, i) => { s.style.animationDelay = (i * 35) + 'ms'; });
    el.classList.add('out');
    return sleep(el.children.length * 35 + 1100);
  }

  window.Site = { reduce, sleep, esc, fmtMoney, fontsReady, reveal, dissolve };

  mountAtmosphere();

  // Títulos marcados con data-decode aparecen entre la bruma al entrar.
  document.querySelectorAll('[data-decode]').forEach((el) => {
    const text = el.textContent;
    fontsReady(['300 80px "Cormorant Garamond"'], 1200).then(() => reveal(el, text, { step: 70 }));
  });

  // Formularios con confirmación (acciones delicadas).
  document.addEventListener('submit', (e) => {
    const msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !confirm(msg)) e.preventDefault();
  });

  // Botón "Imprimir".
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-print]')) window.print(); });

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
