/* home.js — portada: el nombre aparece entre la bruma, se sostiene y se disipa, en ciclo. */
(function () {
  const S = window.Site;
  const words = Array.from(document.querySelectorAll('.word'));
  const HOLD = 3600;
  if (!words.length) return;

  async function run() {
    await S.fontsReady(['300 60px "Cormorant Garamond"', 'italic 300 60px "Cormorant Garamond"'], 2200);
    if (S.reduce) {
      let i = 0;
      if (words.length > 1) setInterval(() => {
        words[i].classList.remove('active');
        i = (i + 1) % words.length;
        words[i].classList.add('active');
      }, 4500);
      return;
    }
    let i = 0;
    for (;;) {
      const w = words[i];
      const part = w.querySelector('[data-t]');
      words.forEach((x) => x.classList.toggle('active', x === w));
      await S.reveal(part, part.dataset.t, { step: 90 });
      await S.sleep(HOLD);
      if (words.length < 2) { await S.sleep(HOLD * 4); continue; }
      await S.dissolve(part);
      w.classList.remove('active');
      await S.sleep(250);
      i = (i + 1) % words.length;
    }
  }
  run();
})();
