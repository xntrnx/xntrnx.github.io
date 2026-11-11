/* auction.js — subasta en vivo: recibe el estado por Server-Sent Events, actualiza
   precio, cuenta regresiva y pujas, y envía las pujas sin recargar la página. */
(function () {
  const S = window.Site;
  const root = document.getElementById('auction');
  if (!root) return;
  const id = root.dataset.id;
  const myPaddle = root.dataset.paddle ? Number(root.dataset.paddle) : null;
  const $ = (x) => document.getElementById(x);
  const el = {
    status: $('a-status'), label: $('a-label'), current: $('a-current'), count: $('a-count'), reserve: $('a-reserve'),
    timelabel: $('a-timelabel'), countdown: $('a-countdown'), when: $('a-when'), you: $('a-you'), bids: $('a-bids'),
    form: $('bid-form'), amount: $('bid-amount'), min: $('a-min'), error: $('bid-error'), wait: $('a-wait'),
  };
  const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  let state = JSON.parse($('a-state').textContent);
  let offset = state.now - Date.now(); // diferencia entre el reloj del servidor y el de este equipo
  let lastMin = state.minNextCents;
  let touched = false;
  if (el.amount) el.amount.addEventListener('input', () => { touched = true; });

  function render() {
    const s = state;
    const live = s.status === 'live';
    const over = !live && s.status !== 'scheduled';
    root.classList.toggle('live', live);
    root.classList.toggle('soon', s.status === 'scheduled');
    root.classList.toggle('sold', s.status === 'sold');
    el.status.textContent = { scheduled: 'Subasta próxima', live: 'En subasta', sold: 'Subasta cerrada: adjudicada', unsold: 'Subasta cerrada sin venta', cancelled: 'Subasta cancelada' }[s.status];
    el.label.textContent = s.currentCents === null ? 'Precio de salida' : (s.status === 'sold' ? 'Precio de adjudicación' : 'Puja actual');
    el.current.textContent = S.fmtMoney(s.currentCents === null ? s.startCents : s.currentCents);
    el.count.textContent = s.bidCount === 1 ? '1 puja' : s.bidCount + ' pujas';
    el.reserve.textContent = s.hasReserve ? (s.reserveMet ? ' · Reserva alcanzada' : ' · Reserva no alcanzada') : ' · Sin reserva';
    el.timelabel.textContent = over ? 'Cerró' : live ? (s.extended ? 'Prorrogada. Cierra en' : 'Cierra en') : 'Abre en';
    const target = live || over ? s.endsAt : s.startsAt;
    el.when.dateTime = new Date(target).toISOString();
    el.when.textContent = dateFmt.format(new Date(target));

    el.bids.innerHTML = s.bids.length
      ? s.bids.map((b) => '<li' + (b.paddle === myPaddle ? ' class="me"' : '') + '><span>Paleta ' + b.paddle + '</span><span>' + S.fmtMoney(b.amountCents) + '</span></li>').join('')
      : '<li class="none">Todavía no hay pujas.</li>';

    if (myPaddle !== null) {
      const mine = s.bids.some((b) => b.paddle === myPaddle);
      const top = s.topPaddle === myPaddle;
      el.you.hidden = !mine;
      el.you.classList.toggle('out', mine && !top);
      if (mine) {
        el.you.textContent = s.status === 'sold'
          ? (top ? 'Ganaste la subasta. Te enviamos un correo con los pasos para pagar; también lo ves en «Mi cuenta».' : 'La subasta cerró y otra persona hizo la puja más alta.')
          : s.status === 'unsold' ? 'La subasta cerró sin alcanzar el precio de reserva.'
          : top ? 'Tienes la puja más alta.' : 'Superaron tu puja.';
      }
    }
    if (el.form) {
      el.form.hidden = !live;
      if (el.wait) el.wait.hidden = live || over;
      el.min.textContent = S.fmtMoney(s.minNextCents);
      // El campo sigue al mínimo mientras la persona no haya escrito otra cantidad.
      if (!touched || Number(el.amount.value) * 100 < s.minNextCents || lastMin !== s.minNextCents && Number(el.amount.value) * 100 === lastMin) {
        el.amount.value = s.minNextCents / 100;
        touched = false;
      }
      lastMin = s.minNextCents;
    }
    tick();
  }

  function tick() {
    const s = state;
    if (s.status !== 'live' && s.status !== 'scheduled') { el.countdown.textContent = ''; return; }
    const left = (s.status === 'live' ? s.endsAt : s.startsAt) - (Date.now() + offset);
    if (left <= 0) { el.countdown.textContent = s.status === 'live' ? 'cerrando…' : 'abriendo…'; return; }
    const t = Math.floor(left / 1000);
    const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
    const p = (n) => String(n).padStart(2, '0');
    el.countdown.textContent = d > 0 ? d + ' d ' + p(h) + ' h ' + p(m) + ' min' : p(h) + ':' + p(m) + ':' + p(sec);
  }
  setInterval(tick, 500);

  function apply(next) {
    state = next;
    offset = next.now - Date.now();
    render();
  }

  // Conexión en vivo; si el navegador o la red no la permiten, se consulta cada 5 segundos.
  let poll = null;
  function startPolling() {
    if (poll) return;
    poll = setInterval(() => {
      fetch('/subastas/' + id + '/estado', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null)).then((s) => { if (s) apply(s); }).catch(() => {});
    }, 5000);
  }
  if ('EventSource' in window) {
    const es = new EventSource('/subastas/' + id + '/eventos');
    es.addEventListener('state', (e) => { apply(JSON.parse(e.data)); });
    es.onerror = () => { if (es.readyState === EventSource.CLOSED) startPolling(); };
  } else startPolling();

  if (el.form) {
    el.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = el.amount.value.trim();
      const pesos = Number(amount.replace(/[$,\s]/g, ''));
      if (!Number.isFinite(pesos) || pesos <= 0) { showError('Escribe el importe en pesos, por ejemplo 9500.'); return; }
      if (!confirm('Vas a pujar ' + S.fmtMoney(Math.round(pesos * 100)) + '.\n\nLa puja es un compromiso de compra y no puede retirarse. ¿Confirmas?')) return;
      const btn = el.form.querySelector('button');
      btn.disabled = true;
      showError('');
      try {
        const r = await fetch(el.form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ amount }),
        });
        const data = await r.json().catch(() => ({}));
        if (data.state) { touched = false; apply(data.state); }
        if (!r.ok) showError(data.error || 'No se pudo registrar la puja. Inténtalo de nuevo.');
      } catch (err) {
        showError('Sin conexión. Revisa tu red e inténtalo de nuevo.');
      } finally {
        btn.disabled = false;
      }
    });
  }
  function showError(msg) {
    el.error.textContent = msg;
    el.error.hidden = !msg;
  }

  render();
})();
