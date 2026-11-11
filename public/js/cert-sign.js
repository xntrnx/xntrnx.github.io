/* cert-sign.js — firma el certificado de una obra EN EL NAVEGADOR del artista y publica
   el resultado. La llave privada se lee del archivo elegido, se usa en memoria y nunca
   se envía al servidor. */
(function () {
  const box = document.getElementById('cert-sign');
  if (!box) return;
  const btn = document.getElementById('cert-sign-btn');
  const input = document.getElementById('f-key');
  const msg = document.getElementById('cert-sign-msg');
  const say = (text) => { msg.textContent = text; msg.hidden = !text; };

  btn.addEventListener('click', async () => {
    say('');
    const file = input.files[0];
    if (!file) { say('Elige tu archivo private-key.pem.'); return; }
    btn.disabled = true;
    try {
      let signer;
      try { signer = await VC.importPrivateKeyPem(await file.text()); } catch (e) {
        throw new Error('Ese archivo no es una llave privada Ed25519 válida (o este navegador no admite Ed25519; usa una versión reciente de Chrome, Safari o Firefox).');
      }
      const did = await (await fetch('/.well-known/did.json', { cache: 'no-store' })).json();
      const vmId = did.id + '#' + signer.multikey;
      if (!did.assertionMethod.includes(vmId)) {
        throw new Error('Esta llave no está entre las llaves vigentes del sitio (certs/keys.json). Si es nueva, agrégala con «npm run cert:keygen».');
      }
      const res = await fetch('/admin/obras/' + box.dataset.work + '/credencial.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo obtener la credencial sin firmar.');
      const signed = await VC.sign(await res.json(), signer.key, vmId);
      const put = await fetch('/admin/obras/' + box.dataset.work + '/certificado.json', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(signed),
      });
      const out = await put.json().catch(() => ({}));
      if (!put.ok) throw new Error(out.error || 'El servidor rechazó el certificado.');
      location.href = '/obra/' + encodeURIComponent(box.dataset.code) + '/certificado';
    } catch (e) {
      say(e.message);
    } finally {
      input.value = '';
      btn.disabled = false;
    }
  });
})();
