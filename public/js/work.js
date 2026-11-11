/* work.js — vista de la obra: fotos, ampliación e inclinación. */
(function () {
  const S = window.Site;
  const hero = document.getElementById('hero');
  if (!hero) return;
  const fotos = JSON.parse(document.getElementById('photos').textContent);
  const countEl = document.getElementById('pcount');
  const baseAlt = hero.alt;
  let idx = 0;

  function showPhoto(i) {
    idx = (i + fotos.length) % fotos.length;
    const f = fotos[idx];
    countEl.textContent = (idx + 1) + ' / ' + fotos.length;
    hero.classList.remove('ready');
    const im = new Image();
    const swap = () => {
      hero.style.setProperty('--r', f.w / f.h);
      hero.width = f.w; hero.height = f.h;
      hero.src = f.src;
      hero.alt = baseAlt + (fotos.length > 1 ? ', foto ' + (idx + 1) : '');
      hero.classList.add('ready');
    };
    im.onload = () => setTimeout(swap, S.reduce ? 0 : 200);
    im.onerror = () => hero.classList.add('ready');
    im.src = f.src;
  }
  if (fotos.length > 1) {
    document.getElementById('prev').addEventListener('click', () => showPhoto(idx - 1));
    document.getElementById('next').addEventListener('click', () => showPhoto(idx + 1));
  }

  /* Inclinación sutil con el cursor */
  const tilt = document.getElementById('tilt');
  if (matchMedia('(hover:hover)').matches && !S.reduce) {
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = 'perspective(1400px) rotateY(' + (x * 3.5).toFixed(2) + 'deg) rotateX(' + (-y * 3.5).toFixed(2) + 'deg)';
    });
    hero.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
  }

  /* Ampliación: clic para abrir, clic para acercar, el cursor (o el dedo) recorre la imagen. */
  const zoom = document.getElementById('zoom');
  const zimg = zoom.querySelector('img');
  const zclose = document.getElementById('zclose');
  let zoomed = false, lastFocus = null;
  function setOrigin(e) {
    zimg.style.transformOrigin = (e.clientX / innerWidth * 100).toFixed(1) + '% ' + (e.clientY / innerHeight * 100).toFixed(1) + '%';
  }
  function openZoom() {
    lastFocus = document.activeElement;
    zimg.src = fotos[idx].src;
    zimg.alt = hero.alt;
    zoom.hidden = false;
    document.body.classList.add('noscroll');
    zclose.focus();
  }
  function closeZoom() {
    zoom.hidden = true; zoomed = false;
    zimg.classList.remove('in'); zimg.style.transformOrigin = '';
    document.body.classList.remove('noscroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  hero.addEventListener('click', openZoom);
  hero.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openZoom(); } });
  zclose.addEventListener('click', closeZoom);
  zimg.addEventListener('click', (e) => {
    zoomed = !zoomed;
    zimg.classList.toggle('in', zoomed);
    if (zoomed) setOrigin(e);
  });
  zoom.addEventListener('pointermove', (e) => { if (zoomed) setOrigin(e); });
  zoom.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); zclose.focus(); } });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !zoom.hidden) closeZoom();
    else if (zoom.hidden && fotos.length > 1 && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      if (e.key === 'ArrowRight') showPhoto(idx + 1);
      if (e.key === 'ArrowLeft') showPhoto(idx - 1);
    }
  });

  /* Deslizar para cambiar de foto en pantallas táctiles */
  let sx = null;
  const viewer = document.querySelector('.viewer');
  viewer.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  viewer.addEventListener('touchend', (e) => {
    if (sx === null || fotos.length < 2) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) showPhoto(idx + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
