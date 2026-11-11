// Términos y Condiciones (incluyen las Reglas de Subasta), ES / EN.
// IMPORTANTE: si cambias el contenido, actualiza la versión en src/legal/versions.js.
import { html } from '../lib/html.js';
import { fmtMoney } from '../lib/util.js';
import { TERMS_VERSION } from '../legal/versions.js';
import { ph, legalDoc } from './legal-base.js';

const hours = (ms) => Math.round(ms / 3600_000);

export function termsEs(req, config) {
  const l = config.legal;
  const contact = config.site.contactEmail ? html`<a class="link" href="mailto:${config.site.contactEmail}">${config.site.contactEmail}</a>` : ph('', 'correo de contacto');
  const ship = (c) => (c ? fmtMoney(c) : 'incluido en el precio');
  return legalDoc(req, {
    title: 'Términos y Condiciones',
    lang: 'es',
    other: '/legal/terms',
    version: TERMS_VERSION,
    body: html`
<h1>Términos y Condiciones</h1>
<p class="lead">Estas son las reglas para usar el sitio, comprar obra y participar en subastas. Incluyen las <a class="link" href="#subastas">Reglas de Subasta</a>.</p>

<h2>1. Quiénes somos y aceptación</h2>
<p>Este sitio («${config.site.name}») es operado por <strong>${ph(l.controllerName, 'nombre legal completo del vendedor')}</strong>, con domicilio en ${ph(l.controllerAddress, 'domicilio completo')} («el Artista», «nosotros»). Contacto: ${contact}.</p>
<p>Al crear una cuenta, comprar o pujar aceptas estos Términos. Si no estás de acuerdo, no uses esas funciones; siempre puedes visitar la galería sin cuenta. El tratamiento de tus datos se rige por el <a class="link" href="/legal/privacidad">Aviso de Privacidad</a>.</p>

<h2>2. Tu cuenta</h2>
<ul>
  <li>Debes ser mayor de 18 años y tener capacidad legal para contratar.</li>
  <li>Los datos que proporciones deben ser verdaderos y estar actualizados. Una cuenta es personal: no la compartas ni la transfieras.</li>
  <li>Eres responsable de mantener tu contraseña en secreto y de lo que se haga desde tu cuenta. Avísanos de inmediato si sospechas un acceso no autorizado.</li>
  <li>Puedes eliminar tu cuenta cuando quieras desde «Seguridad y privacidad», salvo mientras tengas un pedido en curso o la puja más alta en una subasta abierta.</li>
</ul>

<h2>3. Las obras</h2>
<ul>
  <li>Cada obra es una <strong>pieza única y original</strong>. Hacemos lo posible por describirla y fotografiarla con fidelidad; los colores pueden variar ligeramente según tu pantalla. Las dimensiones son aproximadas.</li>
  <li>Cada obra vendida se entrega con un <strong>certificado de autenticidad firmado digitalmente</strong>, verificable por cualquier persona en este sitio.</li>
  <li>La obra se entrega sin marco, salvo que su ficha indique otra cosa.</li>
</ul>

<h2>4. Precios, impuestos y moneda</h2>
<ul>
  <li>Los precios se muestran en pesos mexicanos (MXN) e incluyen los impuestos mexicanos aplicables a la venta. No cobramos comisión de comprador ni cargos ocultos: antes de pagar verás siempre el total.</li>
  <li>Envío asegurado: dentro de México, ${ship(config.shipping.mxCents)}; resto del mundo, ${ship(config.shipping.intlCents)}.</li>
  <li>En envíos fuera de México, los impuestos, aranceles y trámites de importación del país de destino, si los hay, corren por tu cuenta y no están incluidos en el total.</li>
  <li>Si pagas con una moneda distinta, el tipo de cambio y las comisiones los fija tu banco o PayPal.</li>
  <li>Si por un error evidente una obra aparece con un precio manifiestamente equivocado, podremos cancelar el pedido y devolver íntegramente lo pagado.</li>
</ul>

<h2>5. Compra directa</h2>
<ol>
  <li><strong>Apartado.</strong> Al confirmar tu pedido, la obra queda apartada a tu nombre durante ${hours(config.orderHoldMs)} horas. Mientras tanto nadie más puede comprarla.</li>
  <li><strong>Pago.</strong> Puedes pagar con PayPal (incluye tarjetas) o por transferencia SPEI. Las transferencias se confirman manualmente al identificar el depósito.</li>
  <li><strong>Contrato.</strong> El contrato de compraventa se perfecciona cuando confirmamos la recepción de tu pago; te lo notificamos por correo. Si el pago no se recibe dentro del plazo, el pedido se cancela automáticamente sin costo para ti y la obra vuelve a estar disponible.</li>
  <li><strong>Cancelación antes de pagar.</strong> Puedes cancelar un pedido de compra directa en cualquier momento antes de pagarlo.</li>
</ol>
<p>Si recibimos un pago de un pedido ya vencido y la obra ya no está disponible, te reembolsaremos el importe completo.</p>

<h2>6. Envío y entrega</h2>
<ul>
  <li>Enviamos la obra embalada profesionalmente y asegurada, a la dirección que indiques, normalmente dentro de los 10 días hábiles siguientes a la confirmación del pago. Te avisaremos por correo con los datos de rastreo.</li>
  <li>El riesgo de pérdida o daño pasa a ti cuando tú, o quien designes, recibe físicamente la obra.</li>
  <li>Si el paquete llega dañado, consérvalo todo (obra, embalaje y etiquetas), tómale fotografías y escríbenos dentro de los 5 días naturales siguientes a la entrega para gestionar la reclamación con la aseguradora; repararemos, sustituiremos por reembolso o reembolsaremos según corresponda.</li>
  <li>Si la entrega fracasa por datos incorrectos o por no recoger el paquete, los costos del reenvío corren por tu cuenta.</li>
</ul>

<h2 id="devoluciones">7. Derecho de desistimiento y devoluciones</h2>
<p>Además de los derechos que te dé la ley de tu país, que estos Términos no limitan:</p>
<ul>
  <li><strong>Si resides en México:</strong> por tratarse de una venta a distancia, puedes revocar tu consentimiento sin responsabilidad dentro de los <strong>5 días hábiles</strong> siguientes a la entrega de la obra (art. 56 de la Ley Federal de Protección al Consumidor).</li>
  <li><strong>Si compras como consumidor/a desde la Unión Europea, el Espacio Económico Europeo o el Reino Unido:</strong> tienes derecho a desistir del contrato, sin necesidad de justificación, dentro de los <strong>14 días naturales</strong> siguientes al día en que tú, o un tercero que indiques distinto del transportista, reciba la obra. Este derecho aplica tanto a las compras directas como a las obras adjudicadas en nuestras subastas en línea.</li>
  <li><strong>Si resides en otro país:</strong> aplicará el plazo de desistimiento o retracto que la ley de tu país reconozca de forma imperativa a las ventas a distancia.</li>
</ul>
<p><strong>Cómo ejercerlo.</strong> Envíanos, antes de que venza el plazo, una declaración inequívoca a ${contact} indicando tu número de pedido (por ejemplo: «Desisto del contrato de compra del pedido P-XXXXXXXX»). Devuelve la obra sin demora y a más tardar dentro de los 14 días siguientes a tu aviso, en su embalaje original o uno equivalente, asegurada, y en el mismo estado en que la recibiste.</p>
<p><strong>Efectos.</strong> Te reembolsaremos el precio y el costo del envío estándar de ida, por el mismo medio de pago, dentro de los 14 días siguientes a tu aviso; podemos retener el reembolso hasta recibir la obra o hasta que acredites su envío. El costo directo de la devolución (transporte y seguro de regreso) corre por tu cuenta. Respondes de la disminución de valor de la obra que resulte de una manipulación distinta a la necesaria para comprobar su naturaleza y características.</p>
<p>Fuera de estos supuestos, por tratarse de piezas únicas, las ventas son definitivas.</p>

<h2>8. Garantías</h2>
<ul>
  <li><strong>Autenticidad, sin límite de tiempo:</strong> garantizamos que cada obra es original del Artista. Si se demostrara lo contrario, te devolveremos todo lo pagado contra la devolución de la obra.</li>
  <li><strong>Conformidad:</strong> la obra corresponderá a su descripción. Conservas en todo caso la garantía legal que la ley de tu país reconozca a las personas consumidoras.</li>
</ul>

<h2>9. Propiedad intelectual</h2>
<ul>
  <li>Al comprar adquieres la <strong>propiedad del objeto físico</strong>. Los derechos de autor (incluidos los de reproducción, distribución, comunicación pública y transformación) siguen perteneciendo al Artista; no puedes reproducir la obra con fines comerciales sin autorización escrita.</li>
  <li>El Artista conserva sus derechos morales (entre ellos, ser reconocido como autor y oponerse a la deformación de la obra) y puede seguir usando imágenes de la obra en su portafolio, catálogos, exposiciones y este sitio.</li>
  <li>Los textos, fotografías, diseño y código del sitio están protegidos. Puedes compartir enlaces e imágenes citando la autoría, sin fines comerciales.</li>
</ul>

<h2 id="subastas">10. Reglas de Subasta</h2>
<p>Estas reglas aplican a las subastas en línea del sitio. Al registrarte a una subasta las aceptas expresamente.</p>
<ol>
  <li><strong>Modalidad.</strong> Subasta abierta ascendente en tiempo real: gana la puja válida más alta al cierre. Quien vende es el propio Artista; no hay intermediarios ni comisión de comprador.</li>
  <li><strong>Registro.</strong> Para pujar necesitas una cuenta con correo confirmado, nombre, teléfono y país, y registrarte a cada subasta aceptando estas reglas. Se te asigna un <strong>número de paleta</strong>: es lo único que se muestra públicamente junto a tus pujas. Podemos pedirte que acredites tu identidad o tu capacidad de pago antes de admitirte o de adjudicarte una obra.</li>
  <li><strong>Las pujas son vinculantes.</strong> Cada puja es una oferta firme e irrevocable de compra por el importe indicado. No puede retirarse ni reducirse. Revisa el importe antes de confirmar.</li>
  <li><strong>Importe de las pujas.</strong> La primera puja debe ser al menos igual al precio de salida; cada puja siguiente debe superar a la más alta en al menos el incremento mínimo que se indica en la subasta. No puedes superar tu propia puja mientras sea la más alta.</li>
  <li><strong>Precio de reserva.</strong> Una subasta puede tener un precio de reserva confidencial. El sitio indica si la reserva se ha alcanzado. Si al cierre la puja más alta no la alcanza, la obra no se adjudica.</li>
  <li><strong>Cierre y prórroga.</strong> La subasta cierra a la hora indicada. Si se recibe una puja dentro de los minutos finales señalados en la subasta, el cierre se recorre automáticamente por ese mismo lapso, tantas veces como sea necesario, para que todas las personas puedan responder.</li>
  <li><strong>Hora oficial.</strong> El reloj del servidor es el único que cuenta. La cuenta regresiva de tu pantalla es orientativa y puede diferir por tu conexión. Te recomendamos no esperar al último segundo.</li>
  <li><strong>Adjudicación.</strong> Al cierre, la obra se adjudica a la puja válida más alta que alcance la reserva. En ese momento se perfecciona la compraventa por el precio de adjudicación, más el envío. Se lo notificamos por correo a quien gana; no publicamos su identidad.</li>
  <li><strong>Pago.</strong> Quien gana debe indicar su dirección de envío y pagar el total dentro de las <strong>${hours(config.auctionPayMs)} horas</strong> siguientes al cierre, por los medios de pago del sitio.</li>
  <li><strong>Incumplimiento.</strong> Si quien gana no paga en plazo, podremos, a nuestra elección: (a) dar por cancelada la venta; (b) ofrecer la obra a la siguiente puja más alta o volver a subastarla; y (c) suspender la cuenta incumplidora e impedirle participar en futuras subastas; todo ello sin perjuicio de reclamar los daños y perjuicios que el incumplimiento cause.</li>
  <li><strong>Conductas prohibidas.</strong> Está prohibido pujar sin intención real de comprar, pujar por cuenta del vendedor o para inflar el precio, coludirse con otras personas, usar más de una cuenta en la misma subasta, automatizar pujas o interferir con el sistema. <strong>El Artista y las personas vinculadas a él no pujan en sus propias subastas.</strong> Podemos anular las pujas que infrinjan estas reglas y suspender las cuentas implicadas.</li>
  <li><strong>Cancelación y errores.</strong> Podemos corregir errores evidentes, suspender, prorrogar o cancelar una subasta antes de su cierre por causa justificada (por ejemplo, fallas técnicas, error en la ficha o indicios de fraude). En tal caso las pujas quedan sin efecto y no generan obligación para nadie.</li>
  <li><strong>Fallas técnicas.</strong> Hacemos lo razonable para que el sistema funcione sin interrupciones, pero no garantizamos que tu conexión, tu dispositivo o servicios de terceros no fallen. No somos responsables de las pujas que no lleguen a registrarse por causas ajenas a nuestro control.</li>
  <li><strong>Desistimiento.</strong> Las personas consumidoras conservan el derecho de desistimiento de la sección 7 respecto de las obras adjudicadas en subasta en línea, en los términos que les reconozca su ley.</li>
</ol>

<h2>11. Uso aceptable</h2>
<p>No puedes usar el sitio para actividades ilícitas, intentar acceder a cuentas o sistemas ajenos, introducir código malicioso, extraer datos de forma masiva o automatizada, suplantar a otra persona ni interferir con el funcionamiento del sitio o de las subastas.</p>

<h2>12. Suspensión y terminación</h2>
<p>Podemos suspender o cancelar una cuenta que incumpla estos Términos, en particular por fraude, impago de una puja ganadora o conductas prohibidas en subastas, avisándote por correo con el motivo. Las obligaciones ya nacidas (por ejemplo, entregar una obra pagada o pagar una obra adjudicada) subsisten.</p>

<h2>13. Prevención de operaciones con recursos de procedencia ilícita</h2>
<p>La legislación mexicana considera actividad vulnerable la comercialización de obras de arte por encima de ciertos montos. Cuando una operación los alcance, estaremos obligados a identificarte (lo que puede incluir identificación oficial y datos fiscales) y, en su caso, a dar aviso a la autoridad. Si no proporcionas la información exigida por la ley, no podremos concluir la venta. También pueden aplicar límites legales al pago en efectivo.</p>

<h2>14. Responsabilidad</h2>
<p>Nada en estos Términos excluye o limita la responsabilidad que por ley no puede excluirse ni limitarse (por ejemplo, por dolo, culpa grave, daños personales o los derechos irrenunciables de las personas consumidoras). Dentro de esos límites: (a) no respondemos por daños indirectos o por pérdida de ganancias; y (b) nuestra responsabilidad total frente a ti por una operación se limita al importe que hayas pagado por ella. No garantizamos que una obra conserve o aumente su valor: no ofrecemos asesoría de inversión.</p>

<h2>15. Ley aplicable, quejas y jurisdicción</h2>
<p>Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Si eres consumidor/a con residencia habitual en otro país, conservas además la protección de las normas imperativas de tu país y puedes demandar ante los tribunales de tu domicilio.</p>
<p>Ante cualquier inconformidad, escríbenos primero a ${contact}: respondemos en un máximo de 10 días hábiles. Las personas consumidoras en México pueden acudir a la Procuraduría Federal del Consumidor (PROFECO), autoridad competente en la vía administrativa. Para todo lo demás, las partes se someten a los tribunales competentes del domicilio del Artista, sin perjuicio de lo dicho para las personas consumidoras.</p>

<h2>16. Cambios a estos Términos</h2>
<p>Podemos actualizar estos Términos. La versión vigente y su fecha estarán siempre en esta página. Los cambios no afectan a los pedidos ya realizados ni a las subastas ya abiertas, que se rigen por la versión que aceptaste. Si el cambio es sustancial te avisaremos por correo, y te pediremos aceptar la nueva versión en tu siguiente compra o registro a una subasta.</p>

<h2>17. Disposiciones finales</h2>
<p>Si alguna cláusula resultara inválida, las demás seguirán vigentes. No ejercer un derecho no implica renunciar a él. Estos Términos se publican en español y en inglés; en caso de discrepancia prevalece la versión en español, salvo que la ley de tu país de residencia disponga otra cosa a tu favor.</p>
<p class="fine">Versión ${TERMS_VERSION}.</p>`,
  });
}

export function termsEn(req, config) {
  const l = config.legal;
  const contact = config.site.contactEmail ? html`<a class="link" href="mailto:${config.site.contactEmail}">${config.site.contactEmail}</a>` : ph('', 'contact e-mail');
  const ship = (c) => (c ? fmtMoney(c) : 'included in the price');
  return legalDoc(req, {
    title: 'Terms and Conditions',
    lang: 'en',
    other: '/legal/terminos',
    version: TERMS_VERSION,
    body: html`
<h1>Terms and Conditions</h1>
<p class="lead">These are the rules for using the site, buying works and taking part in auctions. They include the <a class="link" href="#auctions">Auction Rules</a>.</p>

<h2>1. Who we are, and acceptance</h2>
<p>This site (“${config.site.name}”) is operated by <strong>${ph(l.controllerName, 'full legal name of the seller')}</strong>, with address at ${ph(l.controllerAddress, 'full address')} (the “Artist”, “we”, “us”). Contact: ${contact}.</p>
<p>By creating an account, buying or bidding you accept these Terms. If you do not agree, do not use those features; you can always browse the gallery without an account. The processing of your data is governed by the <a class="link" href="/legal/privacy">Privacy Notice</a>.</p>

<h2>2. Your account</h2>
<ul>
  <li>You must be at least 18 years old and legally able to enter into contracts.</li>
  <li>The information you provide must be true and kept up to date. An account is personal: do not share or transfer it.</li>
  <li>You are responsible for keeping your password secret and for what is done from your account. Tell us at once if you suspect unauthorised access.</li>
  <li>You may delete your account at any time under “Security and privacy”, except while you have an order in progress or hold the highest bid in an open auction.</li>
</ul>

<h2>3. The works</h2>
<ul>
  <li>Each work is a <strong>unique, original piece</strong>. We do our best to describe and photograph it faithfully; colours may vary slightly depending on your screen. Dimensions are approximate.</li>
  <li>Each work sold comes with a <strong>digitally signed certificate of authenticity</strong> that anyone can verify on this site.</li>
  <li>Works are delivered unframed unless their listing says otherwise.</li>
</ul>

<h2>4. Prices, taxes and currency</h2>
<ul>
  <li>Prices are shown in Mexican pesos (MXN) and include the Mexican taxes applicable to the sale. We charge no buyer's premium and no hidden fees: you will always see the total before paying.</li>
  <li>Insured shipping: within Mexico, ${ship(config.shipping.mxCents)}; rest of the world, ${ship(config.shipping.intlCents)}.</li>
  <li>For shipments outside Mexico, any import taxes, duties and formalities of the destination country are your responsibility and are not included in the total.</li>
  <li>If you pay in another currency, the exchange rate and fees are set by your bank or PayPal.</li>
  <li>If, by obvious error, a work is listed at a manifestly wrong price, we may cancel the order and refund in full whatever was paid.</li>
</ul>

<h2>5. Direct purchase</h2>
<ol>
  <li><strong>Reservation.</strong> When you confirm your order the work is reserved in your name for ${hours(config.orderHoldMs)} hours. Nobody else can buy it meanwhile.</li>
  <li><strong>Payment.</strong> You can pay with PayPal (including cards) or by SPEI bank transfer. Transfers are confirmed manually once the deposit is identified.</li>
  <li><strong>Contract.</strong> The sale contract is concluded when we confirm receipt of your payment; we notify you by e-mail. If payment is not received in time, the order is cancelled automatically at no cost to you and the work becomes available again.</li>
  <li><strong>Cancelling before payment.</strong> You may cancel a direct-purchase order at any time before paying for it.</li>
</ol>
<p>If we receive payment for an order that has already expired and the work is no longer available, we will refund the full amount.</p>

<h2>6. Shipping and delivery</h2>
<ul>
  <li>We ship the work professionally packed and insured to the address you give, normally within 10 working days of payment being confirmed. We will e-mail you the tracking details.</li>
  <li>The risk of loss or damage passes to you when you, or the person you designate, physically receive the work.</li>
  <li>If the parcel arrives damaged, keep everything (work, packaging and labels), photograph it and write to us within 5 calendar days of delivery so we can handle the claim with the insurer; we will repair, or refund, as appropriate.</li>
  <li>If delivery fails because of incorrect details or failure to collect the parcel, re-shipping costs are yours.</li>
</ul>

<h2 id="returns">7. Right of withdrawal and returns</h2>
<p>In addition to the rights the law of your country gives you, which these Terms do not limit:</p>
<ul>
  <li><strong>If you live in Mexico:</strong> as this is a distance sale, you may revoke your consent without liability within <strong>5 working days</strong> of delivery of the work (Art. 56 of the Federal Consumer Protection Law).</li>
  <li><strong>If you buy as a consumer from the European Union, the European Economic Area or the United Kingdom:</strong> you have the right to withdraw from the contract, without giving any reason, within <strong>14 calendar days</strong> of the day on which you, or a third party other than the carrier indicated by you, receive the work. This right applies both to direct purchases and to works awarded in our online auctions.</li>
  <li><strong>If you live elsewhere:</strong> the withdrawal or cooling-off period that the law of your country mandatorily grants for distance sales will apply.</li>
</ul>
<p><strong>How to exercise it.</strong> Before the period expires, send an unequivocal statement to ${contact} quoting your order number (for example: “I withdraw from the purchase contract for order P-XXXXXXXX”). Return the work without undue delay and no later than 14 days after telling us, in its original or equivalent packaging, insured, and in the condition in which you received it.</p>
<p><strong>Effects.</strong> We will refund the price and the cost of standard outbound shipping, by the same means of payment, within 14 days of your notice; we may withhold the refund until we receive the work or you supply proof of having sent it back. The direct cost of returning the work (return transport and insurance) is yours. You are liable for any diminished value of the work resulting from handling beyond what is necessary to establish its nature and characteristics.</p>
<p>Outside these cases, since these are unique pieces, sales are final.</p>

<h2>8. Guarantees</h2>
<ul>
  <li><strong>Authenticity, without time limit:</strong> we guarantee that each work is an original by the Artist. If the contrary were proven, we will refund everything paid against return of the work.</li>
  <li><strong>Conformity:</strong> the work will match its description. You keep in any case the legal guarantee that the law of your country grants to consumers.</li>
</ul>

<h2>9. Intellectual property</h2>
<ul>
  <li>By buying you acquire <strong>ownership of the physical object</strong>. Copyright (including the rights of reproduction, distribution, communication to the public and adaptation) remains with the Artist; you may not reproduce the work commercially without written permission.</li>
  <li>The Artist retains moral rights (including to be identified as author and to object to distortion of the work) and may continue to use images of the work in portfolios, catalogues, exhibitions and on this site.</li>
  <li>The site's texts, photographs, design and code are protected. You may share links and images with attribution, for non-commercial purposes.</li>
</ul>

<h2 id="auctions">10. Auction Rules</h2>
<p>These rules apply to the site's online auctions. By registering for an auction you expressly accept them.</p>
<ol>
  <li><strong>Format.</strong> Open ascending auction in real time: the highest valid bid at closing wins. The seller is the Artist; there are no intermediaries and no buyer's premium.</li>
  <li><strong>Registration.</strong> To bid you need an account with a confirmed e-mail, name, telephone and country, and you must register for each auction by accepting these rules. You are assigned a <strong>paddle number</strong>: it is the only thing shown publicly next to your bids. We may ask you to prove your identity or ability to pay before admitting you or awarding you a work.</li>
  <li><strong>Bids are binding.</strong> Each bid is a firm, irrevocable offer to buy at the amount stated. It cannot be withdrawn or reduced. Check the amount before confirming.</li>
  <li><strong>Bid amounts.</strong> The first bid must be at least the starting price; each later bid must exceed the highest bid by at least the minimum increment shown for the auction. You cannot outbid yourself while yours is the highest bid.</li>
  <li><strong>Reserve price.</strong> An auction may have a confidential reserve price. The site shows whether the reserve has been met. If the highest bid at closing does not meet it, the work is not awarded.</li>
  <li><strong>Closing and extension.</strong> The auction closes at the time shown. If a bid is received within the final minutes stated for the auction, closing is automatically extended by that same period, as many times as necessary, so that everyone can respond.</li>
  <li><strong>Official time.</strong> Only the server clock counts. The countdown on your screen is indicative and may differ because of your connection. We recommend not waiting until the last second.</li>
  <li><strong>Award.</strong> At closing, the work is awarded to the highest valid bid that meets the reserve. At that moment the sale is concluded at the hammer price, plus shipping. We notify the winner by e-mail; we do not publish their identity.</li>
  <li><strong>Payment.</strong> The winner must provide a delivery address and pay the total within <strong>${hours(config.auctionPayMs)} hours</strong> of closing, using the site's payment methods.</li>
  <li><strong>Default.</strong> If the winner does not pay in time we may, at our choice: (a) treat the sale as cancelled; (b) offer the work to the next highest bid or auction it again; and (c) suspend the defaulting account and bar it from future auctions; all without prejudice to claiming the damages caused by the default.</li>
  <li><strong>Prohibited conduct.</strong> It is forbidden to bid without a genuine intention to buy, to bid on the seller's behalf or to inflate the price, to collude with others, to use more than one account in the same auction, to automate bids or to interfere with the system. <strong>The Artist and persons connected with the Artist do not bid in the Artist's own auctions.</strong> We may void bids that break these rules and suspend the accounts involved.</li>
  <li><strong>Cancellation and errors.</strong> We may correct obvious errors, and suspend, extend or cancel an auction before it closes for good reason (for example technical failure, an error in the listing or signs of fraud). In that case bids have no effect and create no obligation for anyone.</li>
  <li><strong>Technical failures.</strong> We take reasonable steps to keep the system running without interruption, but we cannot guarantee that your connection, your device or third-party services will not fail. We are not liable for bids that fail to register for reasons beyond our control.</li>
  <li><strong>Withdrawal.</strong> Consumers keep the right of withdrawal in section 7 for works awarded in an online auction, to the extent their law grants it.</li>
</ol>

<h2>11. Acceptable use</h2>
<p>You may not use the site for unlawful activities, attempt to access other people's accounts or systems, introduce malicious code, extract data in bulk or by automated means, impersonate anyone, or interfere with the operation of the site or its auctions.</p>

<h2>12. Suspension and termination</h2>
<p>We may suspend or close an account that breaches these Terms, in particular for fraud, non-payment of a winning bid or prohibited conduct in auctions, telling you the reason by e-mail. Obligations already incurred (for example delivering a work that has been paid for, or paying for a work awarded) survive.</p>

<h2>13. Anti-money-laundering</h2>
<p>Mexican law treats the sale of works of art above certain amounts as a regulated activity. Where a transaction reaches those amounts we are required to identify you (which may include an official identity document and tax details) and, where applicable, to report to the authority. If you do not provide the information required by law, we cannot complete the sale. Legal limits on cash payments may also apply.</p>

<h2>14. Liability</h2>
<p>Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law (for example for fraud, gross negligence, personal injury, or the non-waivable rights of consumers). Within those limits: (a) we are not liable for indirect loss or loss of profit; and (b) our total liability to you for a transaction is limited to the amount you paid for it. We do not guarantee that a work will keep or increase its value: we give no investment advice.</p>

<h2>15. Governing law, complaints and jurisdiction</h2>
<p>These Terms are governed by the laws of Mexico. If you are a consumer habitually resident in another country, you also keep the protection of the mandatory rules of your country and may bring proceedings before the courts of your home.</p>
<p>If you have any complaint, please write to us first at ${contact}: we reply within 10 working days. Consumers in Mexico may turn to the Federal Consumer Protection Agency (PROFECO), the competent administrative authority. For everything else the parties submit to the competent courts of the Artist's domicile, without prejudice to the above regarding consumers.</p>

<h2>16. Changes to these Terms</h2>
<p>We may update these Terms. The current version and its date will always be on this page. Changes do not affect orders already placed or auctions already open, which are governed by the version you accepted. If a change is material we will notify you by e-mail and ask you to accept the new version at your next purchase or auction registration.</p>

<h2>17. Final provisions</h2>
<p>If any clause is found invalid, the rest remain in force. Not exercising a right does not waive it. These Terms are published in Spanish and in English; in case of discrepancy the Spanish version prevails, unless the law of your country of residence provides otherwise in your favour.</p>
<p class="fine">Version ${TERMS_VERSION}.</p>`,
  });
}
