/* verify.js — verificación del certificado EN EL NAVEGADOR de quien visita:
   firma Ed25519 de la ficha + llave en el historial público + huella SHA-256 de cada foto.
   No depende de confiar en el servidor: cualquiera puede repetir la comprobación. */
(function () {
  const E = window.Site.esc;
  const root = document.getElementById('verify');
  const contentEl = document.getElementById('content');
  const certUrl = root.dataset.certUrl;

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  function canonicalize(obj) {
    if (Array.isArray(obj)) return obj.map(canonicalize);
    if (obj && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = canonicalize(obj[k]); return acc; }, {});
    }
    return obj;
  }
  // Solo se cargan fotos del propio sitio.
  function localPhoto(src) {
    try {
      const u = new URL(src, location.origin);
      return u.origin === location.origin ? u.pathname : null;
    } catch (e) { return null; }
  }

  async function verifyWork(work) {
    const copy = Object.assign({}, work);
    const sigB64 = copy.signature, pubB64 = copy.publicKeyBase64;
    delete copy.signature;
    delete copy.publicKeyBase64;
    if (!sigB64 || !pubB64) return { ok: false, reason: 'La ficha no trae firma.' };

    let keyEntry = null, keysLoaded = false;
    try {
      const res = await fetch('/llaves.json', { cache: 'no-store' });
      if (res.ok) {
        const list = await res.json();
        keysLoaded = true;
        keyEntry = list.find((k) => k.publicKeyBase64 === pubB64) || null;
      }
    } catch (e) { /* se refleja como "sin confirmar" */ }

    const data = new TextEncoder().encode(JSON.stringify(canonicalize(copy)));
    let sigOk;
    try {
      const key = await crypto.subtle.importKey('raw', b64ToBytes(pubB64), { name: 'Ed25519' }, false, ['verify']);
      sigOk = await crypto.subtle.verify('Ed25519', key, b64ToBytes(sigB64), data);
    } catch (e) {
      return { ok: false, reason: 'Este navegador no puede verificar firmas Ed25519. Prueba con una versión reciente de Chrome, Firefox o Safari.' };
    }
    if (!sigOk) return { ok: false, tampered: true };
    if (!keysLoaded) return { ok: false, pending: true, reason: 'No se pudo cargar el historial de llaves para confirmar el emisor.' };
    if (!keyEntry) return { ok: false, unknownKey: true };
    if (keyEntry.revoked) return { ok: false, revoked: true, revokedDate: keyEntry.revokedDate };
    const photos = await checkPhotos(copy);
    if (photos === 'mismatch') return { ok: false, photoMismatch: true };
    return { ok: true, photos };
  }

  // Compara el SHA-256 real de cada foto publicada con la huella firmada.
  async function checkPhotos(work) {
    const urls = work.fotos || [];
    const hashes = work.fotosSha256;
    if (!urls.length) return 'none';
    if (!Array.isArray(hashes) || hashes.length !== urls.length) return 'nohash';
    for (let i = 0; i < urls.length; i++) {
      const src = localPhoto(urls[i]);
      if (!src) return 'unavailable';
      try {
        const res = await fetch(src);
        if (!res.ok) return 'unavailable';
        const digest = await crypto.subtle.digest('SHA-256', await res.arrayBuffer());
        const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (hex !== hashes[i]) return 'mismatch';
      } catch (e) { return 'unavailable'; }
    }
    return 'ok';
  }

  // Sello: hueso = auténtico, rojo = no válido, ceniza = sin verificar.
  function seal(color, word) {
    const id = 'f' + Math.random().toString(36).slice(2);
    return '<svg viewBox="0 0 160 160" width="100%" height="100%" role="img" aria-label="' + word + '">' +
      '<defs><filter id="' + id + '"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter></defs>' +
      '<g filter="url(#' + id + ')" fill="none" stroke="' + color + '" stroke-width="3"><circle cx="80" cy="80" r="62"/><circle cx="80" cy="80" r="52"/></g>' +
      '<text x="80" y="76" text-anchor="middle" fill="' + color + '" font-family="Courier Prime, Courier New, monospace" font-size="' + (word.length > 10 ? 12 : 15) + '" filter="url(#' + id + ')">' + word + '</text>' +
      '<text x="80" y="98" text-anchor="middle" fill="' + color + '" font-family="Newsreader, Georgia, serif" font-style="italic" font-size="12" filter="url(#' + id + ')">certificado</text></svg>';
  }

  function render(work, result) {
    let cls, label, svg;
    if (result.ok) { cls = 'ok'; label = 'Firma auténtica. El certificado coincide con la firma del artista.'; svg = seal('var(--bone)', 'AUTÉNTICO'); }
    else if (result.tampered) { cls = 'bad'; label = 'Firma no válida: el contenido no coincide con lo firmado.'; svg = seal('var(--red-hi)', 'NO VÁLIDO'); }
    else if (result.photoMismatch) { cls = 'bad'; label = 'Foto alterada: la imagen publicada no coincide con la que se firmó.'; svg = seal('var(--red-hi)', 'NO VÁLIDO'); }
    else if (result.revoked) { cls = 'bad'; label = 'Llave revocada desde ' + E(result.revokedDate || 'fecha desconocida') + ': no confíes en este certificado sin confirmarlo con el artista.'; svg = seal('var(--red-hi)', 'NO VÁLIDO'); }
    else if (result.unknownKey) { cls = 'bad'; label = 'Llave desconocida: no está en el historial publicado por el artista.'; svg = seal('var(--red-hi)', 'NO VÁLIDO'); }
    else { cls = 'pending'; label = E(result.reason || 'No se pudo verificar.'); svg = seal('var(--ash)', 'SIN VERIFICAR'); }

    const photoNote = result.ok && { ok: 'Fotos verificadas (SHA-256).', nohash: 'Esta ficha no incluye huellas de fotos.', unavailable: 'No se pudieron comprobar las fotos en este momento.' }[result.photos];
    const photos = (work.fotos || []).map(localPhoto).filter(Boolean).map((src) => '<img src="' + E(src) + '" alt="">').join('');
    const lines = [work.tecnica, work.anio, work.dimensiones].filter(Boolean).map((x) => '<div>' + E(x) + '</div>').join('');
    const sig = String(work.signature || '');
    const workUrl = root.dataset.workUrl;

    contentEl.innerHTML =
      '<p class="idline">' + E(work.id || '') + '</p>' +
      '<h1>' + E(work.titulo || '(sin título)') + '</h1>' +
      '<div class="lines">' + lines + '</div>' +
      (photos ? '<div class="photos-strip">' + photos + '</div>' : '') +
      (work.descripcion ? '<p class="desc">' + E(work.descripcion) + '</p>' : '') +
      '<dl class="kv">' +
        (work.propietarioActual ? '<dt>Propietario</dt><dd>' + E(work.propietarioActual) + '</dd>' : '') +
        (work.fechaRegistro ? '<dt>Registrada</dt><dd>' + E(work.fechaRegistro) + '</dd>' : '') +
      '</dl><hr>' +
      '<div class="stamp-zone"><div class="stamp" id="stamp">' + svg + '</div></div>' +
      '<p class="vstatus ' + cls + '" role="status">' + label + '</p>' +
      (photoNote ? '<div class="hash-line">' + photoNote + '</div>' : '') +
      (sig ? '<div class="hash-line">Firma ' + E(sig.slice(0, 8)) + '···' + E(sig.slice(-8)) + '</div>' : '') +
      (workUrl ? '<p class="back"><a class="link" href="' + E(workUrl) + '">Ver la obra</a></p>' : '');
    requestAnimationFrame(() => { const s = document.getElementById('stamp'); if (s) s.classList.add('show'); });
  }

  // Verificación manual de cualquier ficha.
  const ta = document.getElementById('manualJson');
  const file = document.getElementById('manualFile');
  file.addEventListener('change', async () => { const f = file.files[0]; if (f) ta.value = await f.text(); });
  document.getElementById('manualBtn').addEventListener('click', async () => {
    let work;
    try { work = JSON.parse(ta.value); } catch (e) {
      contentEl.innerHTML = '<h1>Verificar un certificado</h1><p class="err box" role="alert">Eso no es JSON válido: ' + E(e.message) + '</p>';
      return;
    }
    root.dataset.workUrl = '';
    render(work, await verifyWork(work));
    contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  if (certUrl) {
    fetch(certUrl, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('no encontrada'); return r.json(); })
      .then(async (work) => render(work, await verifyWork(work)))
      .catch(() => { contentEl.innerHTML = '<h1>Certificado no disponible</h1><p class="note">No se pudo cargar la ficha de esta obra.</p>'; });
  }
})();
