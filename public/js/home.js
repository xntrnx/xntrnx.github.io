/* home.js — portada: el nombre se descifra, se sostiene y se corrompe, en ciclo. */
(function () {
  const S = window.Site;
  const words = Array.from(document.querySelectorAll('.word'));
  const enter = document.querySelector('.enter');
  const HOLD = 3200;
  if (!words.length) return;

  async function run() {
    await S.fontsReady(['400 40px "Courier Prime"', '400 16px "Noto Sans JP"'], 2200);

    if (S.reduce) {
      let i = 0;
      if (words.length > 1) setInterval(() => {
        words[i].classList.remove('active');
        i = (i + 1) % words.length;
        words[i].classList.add('active');
      }, 4000);
      return;
    }

    let i = 0, first = true;
    for (;;) {
      const w = words[i];
      const part = w.querySelector('[data-t]');
      words.forEach((x) => x.classList.toggle('active', x === w));
      await S.decode(part, part.dataset.t, { step: 70, scrambleMs: 560 });
      if (first) {
        first = false;
        S.decode(enter, enter.textContent, { step: 35, scrambleMs: 400, jitter: 120 });
      }
      await S.sleep(HOLD);
      if (words.length < 2) { await S.sleep(HOLD * 3); }
      await S.scramble(part, 650);
      w.classList.remove('active');
      part.style.transition = 'none'; part.style.opacity = '';
      part.textContent = part.dataset.t;
      await S.sleep(180);
      i = (i + 1) % words.length;
    }
  }
  run();
})();
