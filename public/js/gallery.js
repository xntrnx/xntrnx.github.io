/* gallery.js — galería: filtro, profundidad al hacer scroll, inclinación y posición. */
(function () {
  const S = window.Site;
  const field = document.getElementById('field');
  const countEl = document.getElementById('count');
  const none = document.getElementById('none');
  const hud = document.getElementById('hud');
  const hudN = document.getElementById('hudN');
  const hudT = document.getElementById('hudT');
  const all = Array.from(field.querySelectorAll('.fig'));
  if (!all.length) return;

  const SPEEDS = [0.07, -0.05, 0.10, -0.08, 0.06, -0.10];
  const damp = innerWidth < 900 ? 0.6 : 1;
  let figs = [], bases = [], io = null;

  function layout(filter) {
    figs = all.filter((f) => filter === 'all' || f.dataset.open === '1');
    all.forEach((f) => { f.hidden = !figs.includes(f); });
    figs.forEach((f, i) => {
      f.className = 'fig p' + (i % 6) + (i % 2 ? ' alt' : '');
      f.dataset.sp = (SPEEDS[i % SPEEDS.length] * damp).toFixed(3);
      f.style.setProperty('--bob', (9 + (i * 1.7) % 5).toFixed(1) + 's');
      f.style.setProperty('--bd', (-((i * 2.3) % 9)).toFixed(1) + 's');
      f.firstElementChild.style.transform = '';
    });
    countEl.textContent = figs.length === 1 ? '1 obra' : figs.length + ' obras';
    field.classList.toggle('solo', figs.length === 1);
    none.hidden = figs.length > 0;

    // Indicador de posición: qué obra está cruzando el centro de la pantalla.
    if (io) io.disconnect();
    hud.classList.remove('on');
    io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = figs.indexOf(e.target);
        if (i < 0) return;
        hudN.textContent = (i + 1) + ' / ' + figs.length;
        hudT.textContent = e.target.querySelector('.t').textContent;
        hud.classList.add('on');
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    figs.forEach((f) => io.observe(f));
    measure(); update();
  }

  function setFilter(f) {
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
    layout(f);
  }
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.f)));
  document.getElementById('seeAll').addEventListener('click', () => setFilter('all'));

  /* Profundidad: cada obra se desplaza a distinta velocidad respecto al scroll. */
  function measure() {
    const ft = field.getBoundingClientRect().top + scrollY;
    bases = figs.map((f) => ({ c: ft + f.offsetTop + f.offsetHeight / 2, sp: Number(f.dataset.sp) }));
  }
  let ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  function update() {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    if (!S.reduce) {
      for (let i = 0; i < figs.length; i++) {
        const d = bases[i].c - (y + vh / 2);
        if (Math.abs(d) > vh * 1.3) continue;
        figs[i].firstElementChild.style.transform = 'translate3d(0,' + (d * bases[i].sp).toFixed(1) + 'px,0)';
      }
    }
    if (y < vh * 0.45) hud.classList.remove('on');
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); update(); });
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(field);

  /* Inclinación suave al pasar el cursor (solo con mouse). */
  if (matchMedia('(hover:hover)').matches && !S.reduce) {
    field.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const p = e.target.closest('.piece');
      if (!p) return;
      const r = p.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      p.querySelector('.tilt').style.transform =
        'rotateY(' + (x * 6).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg) scale(1.015)';
    });
    field.addEventListener('pointerout', (e) => {
      const p = e.target.closest('.piece');
      if (p && !p.contains(e.relatedTarget)) p.querySelector('.tilt').style.transform = '';
    });
  }

  layout('all');
})();
