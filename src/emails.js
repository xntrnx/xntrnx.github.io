// Textos de los correos transaccionales (texto plano, sin rastreadores ni imágenes).
import { fmtMoney, fmtDateTime } from './lib/util.js';

const hi = (name) => (name ? `Hola, ${name}:` : 'Hola:');

export const emails = {
  verify: ({ name, url }) => ({
    subject: 'Confirma tu correo',
    text: `${hi(name)}\n\nPara activar tu cuenta, confirma tu correo abriendo este enlace (vence en 48 horas):\n\n${url}\n\nSi no creaste esta cuenta, ignora este mensaje; sin confirmación no se activa.`,
  }),

  alreadyRegistered: ({ name, loginUrl, resetUrl }) => ({
    subject: 'Ya tienes una cuenta',
    text: `${hi(name)}\n\nAlguien (quizá tú) intentó crear una cuenta con este correo, pero ya existe una.\n\nEntrar: ${loginUrl}\n¿Olvidaste tu contraseña?: ${resetUrl}\n\nSi no fuiste tú, no tienes que hacer nada.`,
  }),

  reset: ({ name, url }) => ({
    subject: 'Restablecer contraseña',
    text: `${hi(name)}\n\nPara elegir una contraseña nueva abre este enlace (vence en 1 hora y solo sirve una vez):\n\n${url}\n\nSi no lo pediste, ignora este mensaje; tu contraseña no cambia.`,
  }),

  passwordChanged: ({ name }) => ({
    subject: 'Tu contraseña cambió',
    text: `${hi(name)}\n\nLa contraseña de tu cuenta se acaba de cambiar y se cerraron las demás sesiones.\n\nSi no fuiste tú, restablécela de inmediato y escríbenos.`,
  }),

  accountDeleted: () => ({
    subject: 'Tu cuenta fue eliminada',
    text: `Hola:\n\nConfirmamos que tu cuenta fue eliminada y tus datos personales se borraron o anonimizaron, salvo los que la ley nos obliga a conservar (por ejemplo, comprobantes de compras), que quedan bloqueados hasta que venza su plazo legal.\n\nEste es el último correo que recibirás.`,
  }),

  orderCreated: ({ name, order, work, url, viaAuction }) => ({
    subject: viaAuction ? `Ganaste la subasta: ${work.title}` : `Pedido ${order.code}: ${work.title}`,
    text: `${hi(name)}\n\n${viaAuction
      ? `Tu puja fue la ganadora de "${work.title}" (${work.code}).`
      : `Apartamos "${work.title}" (${work.code}) para ti.`}\n\nPedido: ${order.code}\nImporte: ${fmtMoney(order.total_cents)}\nFecha límite de pago: ${fmtDateTime(order.expires_at)}\n\nCompleta el pago aquí:\n${url}\n\n${viaAuction
      ? 'Recuerda que una puja ganadora es un compromiso de compra, conforme a las Reglas de Subasta.'
      : 'Si no se recibe el pago antes de la fecha límite, el pedido se cancela y la obra vuelve a estar disponible.'}`,
  }),

  speiReceived: ({ name, order, url }) => ({
    subject: `Recibimos tu aviso de transferencia (${order.code})`,
    text: `${hi(name)}\n\nRecibimos tu aviso de transferencia SPEI para el pedido ${order.code}. La confirmación es manual: en cuanto veamos el depósito te avisamos por este medio.\n\nEstado del pedido: ${url}`,
  }),

  paid: ({ name, order, work, url }) => ({
    subject: `Pago confirmado (${order.code})`,
    text: `${hi(name)}\n\nConfirmamos tu pago de ${fmtMoney(order.total_cents)} por "${work.title}" (${work.code}). ¡Gracias!\n\nPrepararemos el envío junto con el certificado de autenticidad firmado y te avisaremos cuando salga.\n\nPedido: ${url}`,
  }),

  shipped: ({ name, order, work, url }) => ({
    subject: `Tu obra va en camino (${order.code})`,
    text: `${hi(name)}\n\n"${work.title}" ya fue enviada.${order.tracking ? `\n\nGuía / rastreo: ${order.tracking}` : ''}\n\nPedido: ${url}`,
  }),

  orderClosed: ({ name, order, work, reason }) => ({
    subject: `Pedido ${order.code} ${reason === 'expired' ? 'vencido' : 'cancelado'}`,
    text: `${hi(name)}\n\nEl pedido ${order.code} de "${work.title}" ${reason === 'expired' ? 'venció porque no se recibió el pago a tiempo' : 'fue cancelado'}.\n\nSi crees que es un error o ya habías pagado, responde a este correo.`,
  }),

  paymentRejected: ({ name, order, url }) => ({
    subject: `No pudimos confirmar tu transferencia (${order.code})`,
    text: `${hi(name)}\n\nNo encontramos el depósito correspondiente al pedido ${order.code}. El pedido sigue abierto por unas horas más para que puedas intentar de nuevo o enviarnos tu comprobante respondiendo a este correo.\n\nPedido: ${url}`,
  }),

  outbid: ({ name, work, amount, url }) => ({
    subject: `Superaron tu puja: ${work.title}`,
    text: `${hi(name)}\n\nAlguien superó tu puja en "${work.title}". La puja más alta ahora es ${fmtMoney(amount)}.\n\nVer la subasta: ${url}`,
  }),

  // --- Avisos internos ---
  adminNewOrder: ({ order, work, url }) => ({
    subject: `[Galería] Pedido nuevo ${order.code}`,
    text: `Pedido ${order.code} (${order.source === 'auction' ? 'subasta' : 'compra directa'})\nObra: ${work.title} (${work.code})\nImporte: ${fmtMoney(order.total_cents)}\n\n${url}`,
  }),
  adminSpei: ({ order, url }) => ({
    subject: `[Galería] SPEI por confirmar ${order.code}`,
    text: `La persona compradora avisó que transfirió ${fmtMoney(order.total_cents)} por el pedido ${order.code}.${order.payment_ref ? `\nReferencia: ${order.payment_ref}` : ''}\n\nRevisa tu banco y confirma o rechaza aquí:\n${url}`,
  }),
  adminPaid: ({ order, work, url }) => ({
    subject: `[Galería] Pago recibido ${order.code}`,
    text: `Pago confirmado de ${fmtMoney(order.total_cents)} por "${work.title}" (${work.code}) vía ${order.payment_method}.\n\nPrepara el envío y firma la ficha actualizada del certificado:\n${url}`,
  }),
  adminAlert: ({ title, body, url }) => ({
    subject: `[Galería] ${title}`,
    text: `${body}${url ? `\n\n${url}` : ''}`,
  }),
};
