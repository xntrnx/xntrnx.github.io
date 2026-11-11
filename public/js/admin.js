/* admin.js — convierte las fechas del formulario de subasta (hora local del navegador)
   a milisegundos UTC antes de enviar. */
(function () {
  const form = document.getElementById('auction-form');
  if (!form) return;
  form.addEventListener('submit', () => {
    form.querySelectorAll('input[data-ms]').forEach((input) => {
      const ms = input.value ? new Date(input.value).getTime() : NaN;
      form.elements[input.dataset.ms].value = Number.isFinite(ms) ? String(ms) : '';
    });
  });
})();
