/* verify.js — verificación del certificado EN EL NAVEGADOR de quien visita.
   No depende de confiar en el servidor: cualquiera puede repetir la comprobación.
   1) firma Ed25519 de la credencial (W3C VC 2.0, Data Integrity eddsa-jcs-2022);
   2) la llave pertenece al emisor y sigue vigente (documento did:web del sitio);
   3) la huella SHA-256 de cada foto publicada coincide con la firmada. */
(function () {
  const E = window.Site.esc;
  const root = document.getElementById('verify');
  const certUrl = root.dataset.certUrl;

  // Solo se descargan fotos del propio sitio.
  function localPath(src) {
    try {
      const u = new URL(src, location.origin);
      return u.pathname.startsWith('/media/') ? u.pathname : null;
    } catch (e) { return null; }
  }
  async function fetchJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  const bad = (label) => ({ state: 'bad', label, notes: [] });
  const pending = (label) => ({ state: 'pending', label, notes: [] });

  async function checkPhotos(list) { // [{ src, sri }]
    if (!list.length) return null;
    for (const p of list) {
      const path = localPath(p.src);
      if (!path || !p.sri) return 'unavailable';
      try {
        const res = await fetch(path);
        if (!res.ok) return 'unavailable';
        if (await VC.sri(await res.arrayBuffer()) !== p.sri) return 'mismatch';
      } catch (e) { return 'unavailable'; }
    }
    return 'ok';
  }
  function withPhotos(result, photos) {
    if (photos === 'mismatch') return bad('Foto alterada: una imagen publicada no coincide con la que se firmó.');
    if (photos === 'ok') result.notes.push('Fotos verificadas (SHA-256).');
    if (photos === 'unavailable') result.notes.push('No se pudieron comprobar las fotos en este momento.');
    return result;
  }

  async function verifyVc(cert) {
    const proof = cert.proof;
    if (!proof || Array.isArray(proof)) return bad('La credencial no trae una firma.');
    const issuer = typeof cert.issuer === 'string' ? cert.issuer : (cert.issuer || {}).id;
    const parts = String(proof.verificationMethod || '').split('#');
    let raw;
    try { raw = VC.rawFromMultikey(parts[1]); } catch (e) { return bad('La firma no identifica una llave Ed25519 válida.'); }
    let sigOk;
    try { sigOk = await VC.verifyProof(cert, raw); } catch (e) {
      return pending('Este navegador no puede verificar firmas Ed25519. Prueba con una versión reciente de Chrome, Firefox o Safari.');
    }
    if (!sigOk) return bad('Firma no válida: el contenido no coincide con lo firmado.');
    if (parts[0] !== issuer) return bad('La llave que firma no pertenece al emisor declarado.');

    let did;
    try { did = await fetchJson('/.well-known/did.json'); } catch (e) {
      return pending('La firma es correcta, pero no se pudo cargar la identidad del emisor para confirmarla.');
    }
    if (issuer !== did.id) return bad('La firma es correcta, pero la emitió «' + issuer + '», no este sitio (' + did.id + ').');
    const vm = (did.verificationMethod || []).find((m) => m.id === proof.verificationMethod);
    if (!vm) return bad('Llave desconocida: no está entre las llaves publicadas por el artista.');
    if (vm.revoked || !(did.assertionMethod || []).includes(vm.id)) {
      return bad('Llave revocada' + (vm.revoked ? ' desde ' + String(vm.revoked).slice(0, 10) : '') + ': no confíes en este certificado sin confirmarlo con el artista.');
    }

    const result = { state: 'ok', label: 'Firma auténtica. El certificado coincide con la firma del artista.', notes: [] };
    // ¿Existe un certificado más reciente de la misma obra? (por ejemplo, cambió de propietario)
    const code = (cert.credentialSubject || {}).identifier;
    if (code) {
      try {
        const current = await fetchJson('/obra/' + encodeURIComponent(code) + '/certificado.json');
        if (current.id && current.id !== cert.id) {
          result.label = 'Firma auténtica, pero ya existe un certificado más reciente de esta obra.';
          result.notes.push('Este certificado fue sustituido. Consulta el vigente en la página de la obra.');
          result.state = 'pending';
          return result;
        }
      } catch (e) { /* obra no publicada: no hay con qué comparar */ }
    }
    return withPhotos(result, await checkPhotos((cert.relatedResource || []).map((r) => ({ src: r.id, sri: r.digestSRI }))));
  }

  // Formato anterior del sitio: "signature" + "publicKeyBase64" sobre JSON canónico.
  async function verifyLegacy(cert) {
    const copy = Object.assign({}, cert);
    delete copy.signature; delete copy.publicKeyBase64;
    let sigOk;
    try {
      const key = await crypto.subtle.importKey('raw', VC.b64ToBytes(cert.publicKeyBase64), { name: 'Ed25519' }, false, ['verify']);
      sigOk = await crypto.subtle.verify('Ed25519', key, VC.b64ToBytes(cert.signature), new TextEncoder().encode(VC.jcs(copy)));
    } catch (e) { return pending('Este navegador no puede verificar firmas Ed25519.'); }
    if (!sigOk) return bad('Firma no válida: el contenido no coincide con lo firmado.');
    let keys;
    try { keys = await fetchJson('/llaves.json'); } catch (e) { return pending('No se pudo cargar el historial de llaves para confirmar el emisor.'); }
    const entry = keys.find((k) => k.publicKeyBase64 === cert.publicKeyBase64);
    if (!entry) return bad('Llave desconocida: no está en el historial publicado por el artista.');
    if (entry.revoked) return bad('Llave revocada desde ' + (entry.revokedDate || 'fecha desconocida') + '.');
    const result = { state: 'ok', label: 'Firma auténtica (formato anterior).', notes: [] };
    const hashes = cert.fotosSha256 || [];
    const photos = (cert.fotos || []).map((src, i) => ({
      src, sri: hashes[i] ? 'sha256-' + btoa(String.fromCharCode(...hashes[i].match(/../g).map((h) => parseInt(h, 16)))) : null,
    }));
    return withPhotos(result, await checkPhotos(photos));
  }

  async function verify(cert) {
    if (!cert || typeof cert !== 'object' || Array.isArray(cert)) return bad('El archivo no es un certificado.');
    if (cert.proof || cert['@context']) return verifyVc(cert);
    if (cert.signature && cert.publicKeyBase64) return verifyLegacy(cert);
    return bad('El archivo no trae firma.');
  }

  // Sello: tinta = auténtico, rosa = no válido, gris = sin verificar.
  function seal(state) {
    const color = { ok: 'var(--ink)', bad: 'var(--rose)', pending: 'var(--mute)' }[state];
    const word = { ok: 'AUTÉNTICO', bad: 'NO VÁLIDO', pending: 'SIN VERIFICAR' }[state];
    return '<svg viewBox="0 0 160 160" width="100%" height="100%" role="img" aria-label="' + word + '">' +
      '<g fill="none" stroke="' + color + '"><circle cx="80" cy="80" r="62" stroke-width="1.2"/><circle cx="80" cy="80" r="55" stroke-width=".6"/></g>' +
      '<text x="80" y="78" text-anchor="middle" fill="' + color + '" font-family="Jost, sans-serif" font-weight="400" letter-spacing="2.5" font-size="' + (word.length > 10 ? 10 : 12.5) + '">' + word + '</text>' +
      '<text x="80" y="99" text-anchor="middle" fill="' + color + '" font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-size="15">certificado</text></svg>';
  }
  function show(result, stampEl, statusEl, notesEl) {
    stampEl.innerHTML = seal(result.state);
    statusEl.className = 'vstatus ' + result.state;
    statusEl.textContent = result.label;
    notesEl.innerHTML = result.notes.map((n) => '<p class="hash-line">' + E(n) + '</p>').join('');
    requestAnimationFrame(() => stampEl.classList.add('show'));
  }

  // Verificación manual de cualquier certificado.
  const ta = document.getElementById('manualJson');
  const file = document.getElementById('manualFile');
  const out = document.getElementById('manual-result');
  file.addEventListener('change', async () => { const f = file.files[0]; if (f) ta.value = await f.text(); });
  document.getElementById('manualBtn').addEventListener('click', async () => {
    let cert;
    try { cert = JSON.parse(ta.value); } catch (e) {
      out.innerHTML = '<p class="err box" role="alert">Eso no es JSON válido: ' + E(e.message) + '</p>';
      return;
    }
    const s = cert.credentialSubject || {};
    const rows = [
      ['Obra', s.name || cert.titulo], ['Código', s.identifier || (cert.credentialSubject ? '' : cert.id)],
      ['Artista', (s.creator || {}).name], ['Técnica', s.artMedium || cert.tecnica], ['Medidas', s.size || cert.dimensiones],
      ['Fecha', s.dateCreated || cert.anio], ['Propietario', s.currentOwner || cert.propietarioActual],
      ['Emitido', cert.validFrom || cert.fechaRegistro],
    ].filter((r) => r[1]);
    out.innerHTML = '<dl class="kv">' + rows.map((r) => '<dt>' + r[0] + '</dt><dd>' + E(r[1]) + '</dd>').join('') + '</dl>' +
      '<div class="stamp-zone"><div class="stamp" id="m-stamp"></div></div><p class="vstatus pending" id="m-status" role="status">Verificando…</p><div id="m-notes"></div>';
    show(await verify(cert), document.getElementById('m-stamp'), document.getElementById('m-status'), document.getElementById('m-notes'));
  });

  if (certUrl) {
    const els = [document.getElementById('stamp'), document.getElementById('vstatus'), document.getElementById('vnotes')];
    fetchJson(certUrl).then(verify).then((r) => show(r, ...els))
      .catch(() => show(pending('No se pudo cargar el certificado para verificarlo.'), ...els));
  }
})();
