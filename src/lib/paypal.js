// PayPal Orders v2, del lado del servidor. El importe SIEMPRE sale de la base de datos
// (nunca del navegador) y la captura se valida contra el pedido antes de marcarlo pagado.
import { AppError, centsToDecimal } from './util.js';

export function createPaypal(config) {
  const cfg = config.paypal;
  const api = cfg.env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const doFetch = (...a) => (cfg.fetch || globalThis.fetch)(...a);
  let cached = null;

  async function token() {
    if (cached && cached.expires > Date.now() + 60_000) return cached.value;
    const res = await doFetch(`${api}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new AppError('No se pudo conectar con PayPal. Intenta de nuevo en unos minutos.', { code: 'paypal', status: 502 });
    const data = await res.json();
    cached = { value: data.access_token, expires: Date.now() + (data.expires_in || 300) * 1000 };
    return cached.value;
  }

  async function call(method, pathname, body, requestId) {
    const res = await doFetch(api + pathname, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  return {
    enabled: cfg.enabled,

    // Crea la orden en PayPal y devuelve { id, approveUrl }.
    async createOrder({ order, description, returnUrl, cancelUrl }) {
      const r = await call('POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: order.code,
          description: description.slice(0, 127),
          amount: { currency_code: order.currency, value: centsToDecimal(order.total_cents) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: config.site.name.slice(0, 127),
              shipping_preference: 'NO_SHIPPING', // la dirección ya se capturó en el sitio
              user_action: 'PAY_NOW',
              return_url: returnUrl,
              cancel_url: cancelUrl,
            },
          },
        },
      }, `${order.code}-${order.total_cents}`);
      const approve = r.data?.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
      if (!r.ok || !r.data?.id || !approve) {
        throw new AppError('PayPal no pudo iniciar el pago. Intenta de nuevo o usa otro método.', { code: 'paypal', status: 502 });
      }
      return { id: r.data.id, approveUrl: approve.href };
    },

    // Captura el pago y verifica que corresponda EXACTAMENTE al pedido.
    // Devuelve { captureId } o lanza AppError.
    async capture({ paypalOrderId, order }) {
      let r = await call('POST', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {}, `cap-${order.code}`);
      // Si ya estaba capturada (recarga de página, doble clic), se consulta su estado.
      if (!r.ok && r.data?.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) {
        r = await call('GET', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
      }
      if (!r.ok) {
        throw new AppError('PayPal no confirmó el pago. No se hizo ningún cargo; puedes intentarlo de nuevo.', { code: 'paypal_declined', status: 402 });
      }
      const unit = r.data?.purchase_units?.[0];
      const cap = unit?.payments?.captures?.[0];
      const amountOk = cap?.amount?.currency_code === order.currency && cap?.amount?.value === centsToDecimal(order.total_cents);
      const refOk = (cap?.custom_id ?? unit?.custom_id) === order.code;
      if (r.data?.status !== 'COMPLETED' || cap?.status !== 'COMPLETED' || !amountOk || !refOk) {
        throw new AppError('El pago de PayPal no coincide con el pedido o sigue pendiente. Escríbenos para revisarlo.', {
          code: 'paypal_mismatch', status: 409, data: { paypalStatus: r.data?.status, captureStatus: cap?.status },
        });
      }
      return { captureId: cap.id };
    },
  };
}
