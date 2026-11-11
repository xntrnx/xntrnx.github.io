// Aviso de Privacidad (ES / EN) y página de cookies.
// IMPORTANTE: si cambias el contenido, actualiza la versión en src/legal/versions.js.
import { html } from '../lib/html.js';
import { PRIVACY_VERSION } from '../legal/versions.js';
import { page } from './layout.js';
import { ph, legalDoc } from './legal-base.js';

export { termsEs, termsEn } from './legal-terms.js';

export function privacyEs(req, config) {
  const l = config.legal;
  const site = config.site;
  const mail = l.privacyEmail ? html`<a class="link" href="mailto:${l.privacyEmail}">${l.privacyEmail}</a>` : ph('', 'correo de privacidad');
  return legalDoc(req, {
    title: 'Aviso de Privacidad',
    lang: 'es',
    other: '/legal/privacy',
    version: PRIVACY_VERSION,
    body: html`
<h1>Aviso de Privacidad Integral</h1>

<div class="callout">
  <p><strong>En pocas palabras</strong></p>
  <ul>
    <li>Solo pedimos los datos necesarios para que tengas una cuenta, compres obra o participes en una subasta.</li>
    <li><strong>No vendemos ni alquilamos tus datos</strong>, no usamos publicidad, analítica ni rastreadores de terceros, y no elaboramos perfiles.</li>
    <li>Nunca vemos ni guardamos los datos de tu tarjeta: el pago lo procesa PayPal o tu banco.</li>
    <li>En las subastas, tus pujas se muestran con un número de paleta, nunca con tu nombre.</li>
    <li>Puedes descargar, corregir o eliminar tus datos tú mismo/a, en cualquier momento, desde <a class="link" href="/cuenta/privacidad">tu cuenta</a>, o escribirnos a ${mail}.</li>
  </ul>
</div>

<h2 id="responsable">1. Quién es responsable de tus datos</h2>
<p><strong>${ph(l.controllerName, 'nombre legal completo del responsable')}</strong> (en adelante, «el Responsable», «nosotros»), con domicilio en ${ph(l.controllerAddress, 'domicilio completo del responsable')}, es responsable del tratamiento de los datos personales que se recaban a través de este sitio web («${site.name}», ${config.baseUrl}), en términos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares de México («LFPDPPP») y, cuando resulte aplicable por tu lugar de residencia, del Reglamento (UE) 2016/679 («RGPD»), del RGPD del Reino Unido, de la Lei Geral de Proteção de Dados de Brasil («LGPD»), de las leyes de privacidad de los estados de los Estados Unidos de América y de las demás normas de protección de datos que te amparen.</p>
<p>Para cualquier asunto relacionado con tus datos personales, nuestro contacto de privacidad es: ${mail}, o por escrito en el domicilio indicado.</p>
${l.euRepresentative ? html`<p>Representante en la Unión Europea (art. 27 RGPD): ${l.euRepresentative}.</p>` : ''}
${l.ukRepresentative ? html`<p>Representante en el Reino Unido: ${l.ukRepresentative}.</p>` : ''}

<h2 id="datos">2. Qué datos personales tratamos</h2>
<p>Tratamos únicamente los datos que tú nos proporcionas y los que se generan al usar el sitio:</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Categoría</th><th>Datos</th><th>Cuándo se recaban</th></tr></thead>
  <tbody>
    <tr><td>Identificación y contacto</td><td>Nombre completo, correo electrónico, país de residencia, teléfono.</td><td>Al crear tu cuenta (el teléfono, solo cuando compras o te registras a una subasta).</td></tr>
    <tr><td>Acceso a la cuenta</td><td>Contraseña (guardada únicamente como un resumen criptográfico irreversible; no podemos leerla), fecha de verificación del correo.</td><td>Al crear tu cuenta.</td></tr>
    <tr><td>Envío</td><td>Nombre de quien recibe, teléfono de contacto y domicilio de entrega.</td><td>Al hacer un pedido o al guardarlo en tu cuenta.</td></tr>
    <tr><td>Compras y pagos (datos patrimoniales)</td><td>Obras adquiridas, importes, método de pago elegido, identificador de la operación en PayPal, clave de rastreo o referencia de tu transferencia, estado del pedido y del envío. <strong>No tratamos números de tarjeta ni credenciales bancarias.</strong></td><td>Al hacer y pagar un pedido.</td></tr>
    <tr><td>Subastas</td><td>Registro a cada subasta, número de paleta asignado, cada puja (importe, fecha y hora) y el resultado.</td><td>Al registrarte y pujar.</td></tr>
    <tr><td>Consentimientos y solicitudes</td><td>Qué documentos aceptaste, en qué versión y cuándo; tus preferencias de comunicación; las solicitudes de derechos que nos envíes y nuestra respuesta.</td><td>Al aceptar, cambiar una preferencia o enviar una solicitud.</td></tr>
    <tr><td>Técnicos y de seguridad</td><td>Dirección IP, tipo de navegador y dispositivo, fecha y hora de inicios de sesión y de acciones relevantes (por ejemplo, una puja o un cambio de contraseña).</td><td>Automáticamente, al usar tu cuenta.</td></tr>
  </tbody>
</table></div>
<p><strong>Datos sensibles.</strong> No solicitamos ni tratamos datos personales sensibles (como origen racial o étnico, salud, creencias, opiniones políticas, datos biométricos u orientación sexual). Te pedimos no incluirlos en los campos de texto libre ni en tus mensajes.</p>
<p><strong>Identificación oficial.</strong> Solo si la ley nos obliga (por ejemplo, la legislación mexicana de prevención de operaciones con recursos de procedencia ilícita, que considera actividad vulnerable la comercialización de obras de arte por encima de ciertos montos) o si es necesario para acreditar tu identidad al ejercer tus derechos, podremos pedirte una identificación oficial y, en su caso, datos fiscales. Te lo pediremos de forma individual, explicándote el motivo, y recabaremos tu consentimiento expreso cuando la ley lo exija.</p>
<p><strong>Fuentes.</strong> Obtenemos tus datos directamente de ti. De PayPal recibimos únicamente la confirmación y el identificador de tu pago.</p>
<p><strong>¿Es obligatorio proporcionarlos?</strong> Los datos marcados como necesarios en cada formulario son indispensables para crear tu cuenta, celebrar y cumplir el contrato de compraventa o admitir tus pujas; sin ellos no podemos prestarte esos servicios. Puedes visitar la galería y verificar certificados sin darnos ningún dato.</p>

<h2 id="finalidades">3. Para qué usamos tus datos y con qué fundamento</h2>
<h3>Finalidades primarias (necesarias)</h3>
<p>Son las que dan origen a nuestra relación contigo y son necesarias para mantenerla y cumplirla:</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Finalidad</th><th>Datos</th><th>Base jurídica (RGPD / LGPD)</th></tr></thead>
  <tbody>
    <tr><td>Crear y administrar tu cuenta; verificar tu correo; autenticarte.</td><td>Identificación y contacto; acceso.</td><td>Ejecución de un contrato o medidas precontractuales a petición tuya (art. 6.1.b RGPD).</td></tr>
    <tr><td>Tramitar tus pedidos: apartar la obra, cobrar, enviar, entregar, emitir el certificado de autenticidad y atender devoluciones o garantías.</td><td>Identificación y contacto; envío; compras y pagos.</td><td>Ejecución de un contrato (art. 6.1.b).</td></tr>
    <tr><td>Operar las subastas: registrarte, recibir y ordenar pujas, determinar a quien gana y exigir el cumplimiento de la puja ganadora.</td><td>Identificación y contacto; subastas.</td><td>Ejecución de un contrato (art. 6.1.b).</td></tr>
    <tr><td>Enviarte comunicaciones del servicio: confirmaciones, avisos de pago y de envío, aviso de que superaron tu puja, cambios importantes en estos documentos.</td><td>Identificación y contacto.</td><td>Ejecución de un contrato (art. 6.1.b).</td></tr>
    <tr><td>Cumplir obligaciones legales: fiscales y contables, de protección al consumidor, de prevención de lavado de dinero y requerimientos de autoridad competente.</td><td>Identificación; compras y pagos; en su caso, identificación oficial y datos fiscales.</td><td>Cumplimiento de una obligación legal (art. 6.1.c).</td></tr>
    <tr><td>Proteger el sitio y a sus usuarios: prevenir fraude, pujas falsas, accesos no autorizados y abuso; conservar evidencia de consentimientos y operaciones.</td><td>Técnicos y de seguridad; consentimientos.</td><td>Interés legítimo en la seguridad del servicio y en la defensa de reclamaciones (art. 6.1.f). Puedes oponerte en cualquier momento (sección 8).</td></tr>
    <tr><td>Atender tus solicitudes, dudas y el ejercicio de tus derechos.</td><td>Identificación y contacto; solicitudes.</td><td>Obligación legal (art. 6.1.c) e interés legítimo en atenderte (art. 6.1.f).</td></tr>
  </tbody>
</table></div>
<h3>Finalidades secundarias (no necesarias)</h3>
<p>Solo si tú lo autorizas expresamente, y sin que negarte afecte en nada tu cuenta, tus compras o tus pujas:</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Finalidad</th><th>Datos</th><th>Base jurídica</th></tr></thead>
  <tbody>
    <tr><td>Enviarte por correo avisos de obra nueva, exposiciones y próximas subastas.</td><td>Nombre y correo.</td><td>Tu consentimiento (art. 6.1.a RGPD), que otorgas marcando una casilla que aparece desmarcada.</td></tr>
    <tr><td>Mostrar tu nombre como propietario/a en el certificado público de autenticidad de una obra que adquieras.</td><td>Nombre.</td><td>Tu consentimiento (art. 6.1.a), que otorgas marcando una casilla desmarcada al comprar. Si no lo das, el certificado indicará «Colección privada».</td></tr>
  </tbody>
</table></div>
<p><strong>Cómo negarte o retirar tu consentimiento a las finalidades secundarias:</strong> no marques la casilla correspondiente; si ya la marcaste, cámbiala en cualquier momento en <a class="link" href="/cuenta/privacidad">Mi cuenta → Seguridad y privacidad</a> o escríbenos a ${mail}. El retiro surte efecto de inmediato y no afecta la licitud del tratamiento anterior. Tratándose del nombre en un certificado ya firmado, emitiremos y publicaremos una nueva versión del certificado sin tu nombre.</p>
<p>No usamos tus datos para fines distintos o incompatibles con los aquí descritos. Si en el futuro necesitáramos hacerlo, te lo informaremos antes y, cuando la ley lo exija, pediremos tu consentimiento.</p>

<h2 id="subastas">4. Qué es público en una subasta</h2>
<p>Las subastas son abiertas y en tiempo real. Para que todas las personas participantes puedan confiar en el proceso, de cada puja se muestra públicamente <strong>solo</strong> el número de paleta (un seudónimo numérico distinto en cada subasta), el importe y el orden. <strong>Nunca publicamos tu nombre, correo ni ningún otro dato que te identifique</strong>, ni durante la subasta ni al adjudicarse la obra. El Responsable sí conoce la identidad detrás de cada paleta, para poder cobrar y entregar la obra a quien gana y prevenir fraudes.</p>

<h2 id="destinatarios">5. Con quién compartimos tus datos</h2>
<p><strong>No vendemos, alquilamos ni cedemos tus datos personales a terceros para sus propios fines comerciales o publicitarios.</strong> Solo los comunicamos en los siguientes casos:</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Destinatario</th><th>Para qué</th><th>Calidad</th></tr></thead>
  <tbody>
    <tr><td>Proveedor de alojamiento del sitio y de la base de datos, ubicado en ${ph(l.hostingLocation, 'país y proveedor de alojamiento')}.</td><td>Alojar el sitio y resguardar la información.</td><td>Encargado (actúa solo bajo nuestras instrucciones y con contrato).</td></tr>
    <tr><td>Proveedor de envío de correo electrónico${l.emailProvider ? html` (${l.emailProvider})` : html`: ${ph('', 'proveedor de correo y país')}`}.</td><td>Entregar los correos del servicio y, si lo autorizaste, los avisos.</td><td>Encargado.</td></tr>
    <tr><td>PayPal (PayPal Pte. Ltd., PayPal (Europe) S.à r.l. et Cie, S.C.A. o la entidad de PayPal que corresponda a tu país).</td><td>Procesar tu pago cuando eliges PayPal. Le enviamos el importe, la descripción de la obra y el número de pedido; PayPal recaba directamente de ti tus datos de pago.</td><td>Responsable independiente; aplica su propia política de privacidad.</td></tr>
    <tr><td>Instituciones bancarias.</td><td>Recibir e identificar tu transferencia (SPEI).</td><td>Responsable independiente.</td></tr>
    <tr><td>Empresas de mensajería, transporte de arte y aseguradoras del envío.</td><td>Entregarte la obra: nombre de quien recibe, domicilio y teléfono.</td><td>Destinatario necesario para cumplir el contrato.</td></tr>
    <tr><td>Asesores contables, fiscales y legales sujetos a deber de confidencialidad.</td><td>Cumplir obligaciones fiscales y defender nuestros derechos.</td><td>Encargado o destinatario bajo secreto profesional.</td></tr>
    <tr><td>Autoridades competentes.</td><td>Cuando una ley o un mandato fundado y motivado de autoridad lo exija.</td><td>Obligación legal.</td></tr>
  </tbody>
</table></div>
<p>Conforme a la LFPDPPP, estas comunicaciones no requieren tu consentimiento por ser remisiones a encargados, o transferencias necesarias para cumplir el contrato que celebramos contigo o exigidas por ley. Cualquier otra transferencia requeriría tu consentimiento previo, que te pediríamos de forma expresa. Si el negocio fuera objeto de fusión, cesión o sucesión, tus datos podrían pasar al nuevo responsable, que quedaría obligado por este Aviso, y te lo notificaríamos previamente.</p>

<h2 id="internacional">6. Transferencias internacionales</h2>
<p>El Responsable está establecido en México. Si resides en otro país, al usar el sitio tus datos se envían a México y a los países donde se ubican los proveedores indicados en la sección 5, cuyas leyes de protección de datos pueden ser distintas de las de tu país. La Comisión Europea y el Reino Unido no han emitido una decisión de adecuación respecto de México.</p>
<p>Si resides en el Espacio Económico Europeo, el Reino Unido o Suiza: nos proporcionas tus datos directamente para celebrar y ejecutar un contrato que tú solicitas (art. 49.1.b RGPD). Cuando nosotros encargamos el tratamiento a proveedores situados en países sin decisión de adecuación, lo hacemos con garantías adecuadas, como las cláusulas contractuales tipo aprobadas por la Comisión Europea (art. 46.2.c RGPD) o mecanismos equivalentes. Puedes pedirnos información sobre esas garantías escribiendo a ${mail}.</p>

<h2 id="conservacion">7. Cuánto tiempo conservamos tus datos</h2>
<p>Conservamos tus datos solo el tiempo necesario para las finalidades descritas y los plazos que marca la ley. Después se eliminan o se anonimizan de forma irreversible. Cuando la ley nos obliga a conservar un dato tras tu solicitud de eliminación, queda <strong>bloqueado</strong>: no se usa para nada más que para cumplir esa obligación, y al vencer el plazo se suprime.</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Datos</th><th>Plazo</th></tr></thead>
  <tbody>
    <tr><td>Cuenta (nombre, correo, teléfono, país, dirección guardada)</td><td>Mientras tu cuenta exista. Al eliminarla se borran de inmediato. Las cuentas cuyo correo nunca se confirmó se borran a los 30 días.</td></tr>
    <tr><td>Pedidos, pagos y datos de envío</td><td>6 años desde el cierre del pedido (la ley fiscal mexicana exige conservar la contabilidad y su documentación al menos 5 años). Después se eliminan los datos de envío y de pago del pedido.</td></tr>
    <tr><td>Registro de pujas</td><td>Forma parte del historial de cada subasta. Al eliminar tu cuenta queda anónimo (solo número de paleta e importe).</td></tr>
    <tr><td>Dirección IP y dispositivo en registros de seguridad y en pujas</td><td>12 meses.</td></tr>
    <tr><td>Sesiones iniciadas</td><td>Hasta 30 días sin actividad, o hasta que cierres sesión.</td></tr>
    <tr><td>Enlaces de verificación y de restablecimiento</td><td>48 horas y 1 hora, respectivamente.</td></tr>
    <tr><td>Constancia de consentimientos</td><td>Mientras tu cuenta exista y 5 años más, para poder acreditarlos.</td></tr>
    <tr><td>Solicitudes de derechos y su respuesta</td><td>3 años desde que se resuelven.</td></tr>
    <tr><td>Identificación oficial y expediente de prevención de lavado de dinero, cuando la ley obligue a recabarlos</td><td>5 años desde la operación, o el plazo que fije la ley aplicable.</td></tr>
  </tbody>
</table></div>

<h2 id="derechos">8. Tus derechos y cómo ejercerlos</h2>
<p>Ejercer tus derechos es <strong>gratuito</strong>. Vivas donde vivas, puedes:</p>
<ul>
  <li><strong>Acceder</strong> a tus datos y obtener una copia, y conocer cómo los tratamos.</li>
  <li><strong>Rectificarlos</strong> si son inexactos o están incompletos.</li>
  <li><strong>Cancelarlos o suprimirlos</strong> («derecho al olvido») cuando ya no sean necesarios o retires tu consentimiento, con las excepciones que marca la ley.</li>
  <li><strong>Oponerte</strong> a su tratamiento para fines específicos, en particular al basado en nuestro interés legítimo y, siempre y sin condiciones, a recibir comunicaciones promocionales.</li>
  <li><strong>Limitar</strong> su uso o divulgación.</li>
  <li><strong>Portarlos</strong>: recibirlos en un formato estructurado, de uso común y lectura mecánica, o pedir que se transmitan a otro responsable cuando sea técnicamente posible.</li>
  <li><strong>Revocar tu consentimiento</strong> en cualquier momento, sin efectos retroactivos.</li>
  <li><strong>No ser objeto de decisiones automatizadas</strong> con efectos jurídicos. No tomamos este tipo de decisiones ni elaboramos perfiles (sección 11).</li>
  <li><strong>Presentar una queja o reclamación</strong> ante la autoridad de protección de datos (sección 16).</li>
</ul>
<h3>Cómo ejercerlos</h3>
<ol>
  <li><strong>Tú mismo/a, al instante:</strong> en <a class="link" href="/cuenta/privacidad">Mi cuenta → Seguridad y privacidad</a> puedes descargar todos tus datos, corregirlos, cambiar tus consentimientos y eliminar tu cuenta.</li>
  <li><strong>Por solicitud:</strong> mediante el <a class="link" href="/privacidad/solicitud">formulario de derechos</a>, por correo a ${mail} o por escrito en nuestro domicilio.</li>
</ol>
<p><strong>Tu solicitud (derechos ARCO, revocación o limitación) debe contener:</strong> (i) tu nombre y un correo o domicilio para comunicarte la respuesta; (ii) los documentos que acrediten tu identidad o, en su caso, la representación legal de quien actúe en tu nombre; (iii) la descripción clara y precisa de los datos y del derecho que quieres ejercer; (iv) cualquier elemento que facilite localizar los datos; y (v) tratándose de rectificación, la corrección solicitada y el documento que la sustente. Si la solicitud llega desde el correo registrado en tu cuenta, normalmente eso basta para acreditar tu identidad; solo pediremos información adicional si tenemos dudas razonables, y la usaremos exclusivamente para ese fin.</p>
<p><strong>Plazos.</strong> Si la solicitud está incompleta, te pediremos subsanarla dentro de los 5 días hábiles siguientes y tendrás 10 días hábiles para hacerlo. Te comunicaremos nuestra determinación en un máximo de <strong>20 días hábiles</strong> desde que recibimos la solicitud y, si procede, la haremos efectiva dentro de los <strong>15 días hábiles</strong> siguientes; estos plazos pueden ampliarse una sola vez por un periodo igual cuando el caso lo justifique, y te avisaremos. Si la ley de tu país fija un plazo menor, lo respetaremos (por ejemplo: un mes bajo el RGPD, prorrogable dos meses en casos complejos; 15 días bajo la LGPD; 45 días bajo las leyes de California). La respuesta se entrega por el mismo medio por el que la solicitaste; la copia de tus datos, en formato electrónico.</p>
<p><strong>Límites.</strong> Podremos negar total o parcialmente una solicitud solo en los casos que la ley prevé; por ejemplo, no podemos suprimir los datos que debemos conservar por obligación fiscal, los necesarios para cumplir un contrato en curso (un pedido sin entregar o una puja vigente) ni los necesarios para la formulación, ejercicio o defensa de reclamaciones. En ese caso te explicaremos el motivo.</p>
<p><strong>Limitar el uso o divulgación.</strong> Además de lo anterior, puedes pedirnos tu inscripción en nuestro listado de exclusión para no recibir comunicaciones promocionales, y, si resides en México, inscribirte en el Registro Público para Evitar Publicidad (REPEP) de la PROFECO. No hacemos promoción por teléfono.</p>
<h3>Si resides en el Espacio Económico Europeo, el Reino Unido o Suiza</h3>
<p>Cuentas con los derechos de los artículos 15 a 22 del RGPD (acceso, rectificación, supresión, limitación, portabilidad y oposición), el de retirar tu consentimiento y el de reclamar ante la autoridad de control de tu país de residencia, de tu lugar de trabajo o del lugar de la supuesta infracción.${l.euRepresentative ? '' : ' Dado que somos un taller de artista que solo de manera ocasional vende obra a personas en la Unión Europea, que no trata categorías especiales de datos y cuyo tratamiento difícilmente entraña un riesgo para tus derechos, no hemos designado un representante en la Unión (art. 27.2 RGPD); puedes dirigirte directamente a nosotros en español o en inglés.'}</p>
<h3>Si resides en los Estados Unidos de América</h3>
<p>Según el estado en que residas (por ejemplo California, conforme a la CCPA/CPRA), puedes tener derecho a conocer las categorías y las piezas específicas de información personal que recabamos, a eliminarla, a corregirla, a limitar el uso de información sensible y a no ser discriminado/a por ejercer tus derechos. Las categorías que recabamos, sus fines, fuentes y destinatarios se describen en las secciones 2 a 5. <strong>No vendemos ni compartimos tu información personal</strong> (tampoco para publicidad conductual entre contextos), ni lo hemos hecho en los últimos 12 meses, y no usamos ni divulgamos información personal sensible para inferir características sobre ti. Puedes ejercer tus derechos, personalmente o mediante un agente autorizado, por los medios de esta sección. Al no existir rastreo entre sitios, no hay señal «Do Not Track» o «Global Privacy Control» que debamos procesar.</p>
<h3>Si resides en Brasil</h3>
<p>Cuentas con los derechos del artículo 18 de la LGPD, entre ellos la confirmación de la existencia del tratamiento, el acceso, la corrección, la anonimización, bloqueo o eliminación de datos innecesarios, la portabilidad, la información sobre con quién se comparten tus datos y la revocación del consentimiento, así como el de acudir a la Autoridade Nacional de Proteção de Dados (ANPD).</p>
<h3>Si resides en otro país</h3>
<p>Atenderemos tu solicitud conforme a este Aviso y respetaremos, además, los derechos que te reconozca de manera imperativa la ley de protección de datos de tu país (por ejemplo, las de Canadá, Argentina, Colombia, Chile, Perú, Australia o Japón).</p>

<h2 id="cookies">9. Cookies y tecnologías de rastreo</h2>
<p>Este sitio utiliza <strong>una sola cookie, estrictamente necesaria</strong>, para mantener tu sesión iniciada. No usamos cookies de publicidad, analítica ni de terceros, ni <em>web beacons</em>, píxeles, huellas digitales del navegador u otras tecnologías de rastreo, y las tipografías se sirven desde nuestro propio servidor. Por eso no mostramos un banner de cookies: no hay nada opcional que aceptar. El detalle está en la <a class="link" href="/legal/cookies">página de cookies</a>. Si eliges pagar con PayPal, serás redirigido/a al sitio de PayPal, que utiliza sus propias cookies conforme a su política.</p>

<h2 id="seguridad">10. Cómo protegemos tus datos</h2>
<p>Aplicamos medidas de seguridad administrativas, técnicas y físicas proporcionales al riesgo, entre ellas: cifrado de las comunicaciones (HTTPS/TLS); contraseñas guardadas solo como resúmenes criptográficos con sal (scrypt); sesiones con identificadores aleatorios que no se guardan en claro; acceso administrativo restringido y registrado en una bitácora; límites contra intentos automatizados; copias de respaldo; y recabar la menor cantidad de datos posible. Ningún sistema es infalible: si ocurriera una vulneración de seguridad que afecte de forma significativa tus derechos, te lo informaremos sin dilación, con las medidas que puedes tomar, y lo notificaremos a la autoridad cuando la ley lo exija (en el caso del RGPD, dentro de las 72 horas siguientes a conocerla).</p>

<h2 id="automatizadas">11. Decisiones automatizadas y perfiles</h2>
<p>No tomamos decisiones basadas únicamente en el tratamiento automatizado de tus datos que produzcan efectos jurídicos o te afecten significativamente, ni elaboramos perfiles. El cierre de una subasta se determina por una regla objetiva y pública (la puja válida más alta al cierre), y cualquier incidencia la revisa una persona.</p>

<h2 id="menores">12. Menores de edad</h2>
<p>El sitio está dirigido a personas mayores de 18 años y solo ellas pueden crear una cuenta. No recabamos a sabiendas datos de menores. Si eres madre, padre o tutor y crees que un menor nos proporcionó datos, escríbenos a ${mail} y los eliminaremos.</p>

<h2 id="terceros">13. Sitios de terceros</h2>
<p>El sitio puede enlazar a sitios de terceros (por ejemplo, PayPal o el rastreo de la empresa de mensajería). No somos responsables de sus prácticas de privacidad; te recomendamos leer sus avisos.</p>

<h2 id="consentimiento">14. Tu consentimiento</h2>
<p>Al crear tu cuenta marcando la casilla correspondiente declaras que leíste este Aviso y otorgas tu <strong>consentimiento expreso</strong> para el tratamiento de tus datos personales, incluidos los patrimoniales relacionados con tus compras y pagos, para las finalidades primarias descritas. Guardamos constancia de la versión que aceptaste, la fecha y la hora. Las finalidades secundarias requieren, además, tu autorización específica (sección 3).</p>

<h2 id="cambios">15. Cambios a este Aviso</h2>
<p>Podemos actualizar este Aviso por cambios legales, en nuestros servicios o en nuestros proveedores. La versión vigente estará siempre en ${config.baseUrl}/legal/privacidad con su fecha de entrada en vigor. Si el cambio es sustancial (por ejemplo, nuevas finalidades o nuevos destinatarios), te avisaremos por correo antes de que entre en vigor y, cuando la ley lo exija, te pediremos de nuevo tu consentimiento.</p>

<h2 id="autoridad">16. Autoridad de protección de datos</h2>
<p>Si consideras que tu derecho a la protección de datos ha sido vulnerado, te pedimos escribirnos primero para intentar resolverlo. En todo caso, tienes derecho a acudir a la autoridad competente:</p>
<ul>
  <li><strong>México:</strong> la Secretaría Anticorrupción y Buen Gobierno, autoridad que asumió las funciones del INAI en materia de protección de datos personales en posesión de particulares.</li>
  <li><strong>Unión Europea / EEE:</strong> la autoridad de control de tu Estado miembro (directorio del Comité Europeo de Protección de Datos).</li>
  <li><strong>Reino Unido:</strong> Information Commissioner's Office (ICO).</li>
  <li><strong>Brasil:</strong> Autoridade Nacional de Proteção de Dados (ANPD).</li>
  <li><strong>California:</strong> California Privacy Protection Agency o el Fiscal General de California.</li>
  <li><strong>Otros países:</strong> la autoridad de protección de datos de tu lugar de residencia.</li>
</ul>

<h2 id="idioma">17. Idioma</h2>
<p>Este Aviso se publica en español y en inglés. En caso de discrepancia prevalece la versión en español, salvo que la ley de tu país de residencia disponga otra cosa a tu favor.</p>
<p class="fine">Versión ${PRIVACY_VERSION}.</p>`,
  });
}

export function privacyEn(req, config) {
  const l = config.legal;
  const site = config.site;
  const mail = l.privacyEmail ? html`<a class="link" href="mailto:${l.privacyEmail}">${l.privacyEmail}</a>` : ph('', 'privacy e-mail');
  return legalDoc(req, {
    title: 'Privacy Notice',
    lang: 'en',
    other: '/legal/privacidad',
    version: PRIVACY_VERSION,
    body: html`
<h1>Privacy Notice</h1>

<div class="callout">
  <p><strong>In short</strong></p>
  <ul>
    <li>We only ask for the data needed for you to hold an account, buy an artwork or take part in an auction.</li>
    <li><strong>We do not sell or rent your data</strong>, we use no advertising, analytics or third-party trackers, and we do not profile you.</li>
    <li>We never see or store your card details: payment is handled by PayPal or your bank.</li>
    <li>In auctions, your bids are shown under a paddle number, never under your name.</li>
    <li>You can download, correct or delete your data yourself at any time from <a class="link" href="/cuenta/privacidad">your account</a>, or write to ${mail}.</li>
  </ul>
</div>

<h2 id="controller">1. Who is responsible for your data</h2>
<p><strong>${ph(l.controllerName, 'full legal name of the controller')}</strong> (the “Controller”, “we”, “us”), with address at ${ph(l.controllerAddress, 'full address of the controller')}, is the controller of the personal data collected through this website (“${site.name}”, ${config.baseUrl}) under Mexico's Federal Law on the Protection of Personal Data Held by Private Parties (“LFPDPPP”) and, where applicable because of where you live, Regulation (EU) 2016/679 (“GDPR”), the UK GDPR, Brazil's Lei Geral de Proteção de Dados (“LGPD”), United States state privacy laws and any other data protection law that protects you.</p>
<p>For anything relating to your personal data, our privacy contact is ${mail}, or by post at the address above.</p>
${l.euRepresentative ? html`<p>Representative in the European Union (Art. 27 GDPR): ${l.euRepresentative}.</p>` : ''}
${l.ukRepresentative ? html`<p>Representative in the United Kingdom: ${l.ukRepresentative}.</p>` : ''}

<h2 id="data">2. What personal data we process</h2>
<p>We process only the data you give us and the data generated when you use the site:</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Category</th><th>Data</th><th>When it is collected</th></tr></thead>
  <tbody>
    <tr><td>Identity and contact</td><td>Full name, e-mail address, country of residence, telephone number.</td><td>When you create your account (telephone only when you buy or register for an auction).</td></tr>
    <tr><td>Account access</td><td>Password (stored only as an irreversible cryptographic hash; we cannot read it), e-mail verification date.</td><td>When you create your account.</td></tr>
    <tr><td>Delivery</td><td>Recipient's name, contact telephone and delivery address.</td><td>When you place an order or save an address to your account.</td></tr>
    <tr><td>Purchases and payments (financial data)</td><td>Works purchased, amounts, payment method chosen, PayPal transaction identifier, your bank transfer tracking key or reference, order and shipping status. <strong>We do not process card numbers or banking credentials.</strong></td><td>When you place and pay for an order.</td></tr>
    <tr><td>Auctions</td><td>Registration for each auction, paddle number assigned, each bid (amount, date and time) and the result.</td><td>When you register and bid.</td></tr>
    <tr><td>Consents and requests</td><td>Which documents you accepted, in which version and when; your communication preferences; the rights requests you send us and our reply.</td><td>When you accept, change a preference or send a request.</td></tr>
    <tr><td>Technical and security</td><td>IP address, browser and device type, date and time of sign-ins and of relevant actions (for example a bid or a password change).</td><td>Automatically, when you use your account.</td></tr>
  </tbody>
</table></div>
<p><strong>Sensitive data.</strong> We do not request or process special categories of personal data (such as racial or ethnic origin, health, beliefs, political opinions, biometric data or sexual orientation). Please do not include them in free-text fields or messages.</p>
<p><strong>Official identification.</strong> Only where the law requires it (for example Mexican anti-money-laundering legislation, which treats the sale of works of art above certain amounts as a regulated activity) or where it is necessary to confirm your identity when you exercise your rights, we may ask you for an official identity document and, where relevant, tax details. We will ask individually, explain why, and obtain your explicit consent where the law requires it.</p>
<p><strong>Sources.</strong> We obtain your data directly from you. From PayPal we receive only the confirmation and identifier of your payment.</p>
<p><strong>Do you have to provide it?</strong> The data marked as required on each form is necessary to create your account, to enter into and perform the sale contract, or to accept your bids; without it we cannot provide those services. You can browse the gallery and verify certificates without giving us any data.</p>

<h2 id="purposes">3. Why we use your data and on what legal basis</h2>
<h3>Primary (necessary) purposes</h3>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Purpose</th><th>Data</th><th>Legal basis (GDPR / LGPD)</th></tr></thead>
  <tbody>
    <tr><td>Creating and managing your account; verifying your e-mail; authenticating you.</td><td>Identity and contact; access.</td><td>Performance of a contract or pre-contractual steps at your request (Art. 6(1)(b) GDPR).</td></tr>
    <tr><td>Handling your orders: reserving the work, taking payment, shipping, delivering, issuing the certificate of authenticity and dealing with returns or guarantees.</td><td>Identity and contact; delivery; purchases and payments.</td><td>Performance of a contract (Art. 6(1)(b)).</td></tr>
    <tr><td>Running auctions: registering you, receiving and ranking bids, determining the winner and enforcing the winning bid.</td><td>Identity and contact; auctions.</td><td>Performance of a contract (Art. 6(1)(b)).</td></tr>
    <tr><td>Sending service messages: confirmations, payment and shipping notices, outbid notices, important changes to these documents.</td><td>Identity and contact.</td><td>Performance of a contract (Art. 6(1)(b)).</td></tr>
    <tr><td>Complying with legal obligations: tax and accounting, consumer protection, anti-money-laundering, and requests from competent authorities.</td><td>Identity; purchases and payments; where applicable, official identification and tax details.</td><td>Compliance with a legal obligation (Art. 6(1)(c)).</td></tr>
    <tr><td>Protecting the site and its users: preventing fraud, fake bids, unauthorised access and abuse; keeping evidence of consents and transactions.</td><td>Technical and security; consents.</td><td>Legitimate interests in the security of the service and in defending legal claims (Art. 6(1)(f)). You may object at any time (section 8).</td></tr>
    <tr><td>Answering your requests and questions and the exercise of your rights.</td><td>Identity and contact; requests.</td><td>Legal obligation (Art. 6(1)(c)) and legitimate interests in assisting you (Art. 6(1)(f)).</td></tr>
  </tbody>
</table></div>
<h3>Secondary (optional) purposes</h3>
<p>Only if you expressly agree, and refusing has no effect whatsoever on your account, purchases or bids:</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Purpose</th><th>Data</th><th>Legal basis</th></tr></thead>
  <tbody>
    <tr><td>E-mailing you news of new works, exhibitions and upcoming auctions.</td><td>Name and e-mail.</td><td>Your consent (Art. 6(1)(a) GDPR), given by ticking a box that is unticked by default.</td></tr>
    <tr><td>Showing your name as owner on the public certificate of authenticity of a work you acquire.</td><td>Name.</td><td>Your consent (Art. 6(1)(a)), given by ticking an unticked box at checkout. Without it, the certificate reads “Private collection”.</td></tr>
  </tbody>
</table></div>
<p><strong>How to refuse or withdraw consent for secondary purposes:</strong> leave the box unticked; if you already ticked it, change it at any time under <a class="link" href="/cuenta/privacidad">My account → Security and privacy</a> or write to ${mail}. Withdrawal takes effect immediately and does not affect the lawfulness of earlier processing. For a name on a certificate already signed, we will issue and publish a new version of the certificate without your name.</p>
<p>We do not use your data for purposes other than or incompatible with those described here. If we ever need to, we will tell you beforehand and, where the law requires, ask for your consent.</p>

<h2 id="auctions">4. What is public in an auction</h2>
<p>Auctions are open and run in real time. So that every participant can trust the process, for each bid we publicly show <strong>only</strong> the paddle number (a numeric pseudonym that is different in every auction), the amount and the order. <strong>We never publish your name, e-mail or anything else that identifies you</strong>, during the auction or once the work is awarded. The Controller does know the identity behind each paddle, in order to take payment from and deliver the work to the winner and to prevent fraud.</p>

<h2 id="recipients">5. Who we share your data with</h2>
<p><strong>We do not sell, rent or hand over your personal data to third parties for their own commercial or advertising purposes.</strong> We disclose it only as follows:</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Recipient</th><th>Why</th><th>Role</th></tr></thead>
  <tbody>
    <tr><td>Website and database hosting provider, located in ${ph(l.hostingLocation, 'hosting country and provider')}.</td><td>Hosting the site and storing the information.</td><td>Processor (acts only on our instructions, under contract).</td></tr>
    <tr><td>E-mail delivery provider${l.emailProvider ? html` (${l.emailProvider})` : html`: ${ph('', 'e-mail provider and country')}`}.</td><td>Delivering service e-mails and, if you opted in, news.</td><td>Processor.</td></tr>
    <tr><td>PayPal (PayPal Pte. Ltd., PayPal (Europe) S.à r.l. et Cie, S.C.A. or the PayPal entity for your country).</td><td>Processing your payment when you choose PayPal. We send the amount, the description of the work and the order number; PayPal collects your payment details directly from you.</td><td>Independent controller; its own privacy policy applies.</td></tr>
    <tr><td>Banks.</td><td>Receiving and identifying your bank transfer (SPEI).</td><td>Independent controller.</td></tr>
    <tr><td>Couriers, fine-art shippers and shipping insurers.</td><td>Delivering the work to you: recipient's name, address and telephone.</td><td>Recipient necessary to perform the contract.</td></tr>
    <tr><td>Accounting, tax and legal advisers bound by confidentiality.</td><td>Meeting tax obligations and defending our rights.</td><td>Processor or recipient under professional secrecy.</td></tr>
    <tr><td>Competent authorities.</td><td>Where a law or a duly reasoned order from an authority requires it.</td><td>Legal obligation.</td></tr>
  </tbody>
</table></div>
<p>Under the LFPDPPP these disclosures do not require your consent, since they are either communications to processors or transfers necessary to perform the contract with you or required by law. Any other transfer would require your prior consent, which we would request expressly. If the business were merged, assigned or succeeded, your data could pass to the new controller, who would be bound by this Notice, and we would notify you beforehand.</p>

<h2 id="international">6. International transfers</h2>
<p>The Controller is established in Mexico. If you live in another country, when you use the site your data is sent to Mexico and to the countries where the providers listed in section 5 are located, whose data protection laws may differ from those of your country. Neither the European Commission nor the United Kingdom has issued an adequacy decision for Mexico.</p>
<p>If you live in the European Economic Area, the United Kingdom or Switzerland: you provide your data to us directly in order to enter into and perform a contract you request (Art. 49(1)(b) GDPR). Where we entrust processing to providers in countries without an adequacy decision, we do so with appropriate safeguards, such as the standard contractual clauses approved by the European Commission (Art. 46(2)(c) GDPR) or equivalent mechanisms. You can ask us about those safeguards at ${mail}.</p>

<h2 id="retention">7. How long we keep your data</h2>
<p>We keep your data only for as long as needed for the purposes described and for the periods required by law. It is then deleted or irreversibly anonymised. Where the law obliges us to keep data after you ask for deletion, it is <strong>blocked</strong>: used for nothing other than meeting that obligation, and erased when the period ends.</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Data</th><th>Period</th></tr></thead>
  <tbody>
    <tr><td>Account (name, e-mail, telephone, country, saved address)</td><td>For as long as your account exists. Deleted immediately when you delete it. Accounts whose e-mail was never confirmed are deleted after 30 days.</td></tr>
    <tr><td>Orders, payments and delivery details</td><td>6 years from the closing of the order (Mexican tax law requires accounting records and supporting documents to be kept for at least 5 years). The order's delivery and payment details are then erased.</td></tr>
    <tr><td>Bid records</td><td>Part of the history of each auction. When you delete your account they become anonymous (paddle number and amount only).</td></tr>
    <tr><td>IP address and device in security logs and bids</td><td>12 months.</td></tr>
    <tr><td>Signed-in sessions</td><td>Up to 30 days without activity, or until you sign out.</td></tr>
    <tr><td>Verification and password-reset links</td><td>48 hours and 1 hour respectively.</td></tr>
    <tr><td>Records of consent</td><td>For as long as your account exists plus 5 years, to be able to demonstrate them.</td></tr>
    <tr><td>Rights requests and our reply</td><td>3 years after they are resolved.</td></tr>
    <tr><td>Official identification and anti-money-laundering file, where the law requires them</td><td>5 years from the transaction, or the period set by the applicable law.</td></tr>
  </tbody>
</table></div>

<h2 id="rights">8. Your rights and how to exercise them</h2>
<p>Exercising your rights is <strong>free of charge</strong>. Wherever you live, you may:</p>
<ul>
  <li><strong>Access</strong> your data, obtain a copy and learn how we process it.</li>
  <li><strong>Rectify</strong> it if it is inaccurate or incomplete.</li>
  <li><strong>Erase</strong> it (“right to be forgotten”) when it is no longer needed or you withdraw consent, subject to the exceptions set by law.</li>
  <li><strong>Object</strong> to its processing for specific purposes, in particular processing based on our legitimate interests and, always and unconditionally, to receiving promotional communications.</li>
  <li><strong>Restrict</strong> its use or disclosure.</li>
  <li><strong>Port</strong> it: receive it in a structured, commonly used, machine-readable format, or ask for it to be sent to another controller where technically feasible.</li>
  <li><strong>Withdraw your consent</strong> at any time, without retroactive effect.</li>
  <li><strong>Not be subject to automated decisions</strong> with legal effects. We make no such decisions and do no profiling (section 11).</li>
  <li><strong>Lodge a complaint</strong> with a data protection authority (section 16).</li>
</ul>
<h3>How to exercise them</h3>
<ol>
  <li><strong>Yourself, instantly:</strong> under <a class="link" href="/cuenta/privacidad">My account → Security and privacy</a> you can download all your data, correct it, change your consents and delete your account.</li>
  <li><strong>By request:</strong> through the <a class="link" href="/privacidad/solicitud">rights request form</a>, by e-mail to ${mail}, or in writing to our address.</li>
</ol>
<p><strong>Your request must include:</strong> (i) your name and an e-mail or postal address for our reply; (ii) documents proving your identity or, where relevant, the authority of the person acting on your behalf; (iii) a clear and precise description of the data and the right you wish to exercise; (iv) anything that helps us locate the data; and (v) for rectification, the correction requested and supporting documentation. If the request comes from the e-mail address registered on your account, that is normally enough to confirm your identity; we will ask for more only if we have reasonable doubts, and will use it solely for that purpose.</p>
<p><strong>Time limits.</strong> If a request is incomplete we will ask you to complete it within 5 working days, and you will have 10 working days to do so. We will give you our decision within <strong>20 working days</strong> of receiving the request and, where it is granted, give effect to it within the following <strong>15 working days</strong>; these periods may be extended once for an equal period where justified, and we will tell you. If the law of your country sets a shorter limit we will meet it (for example: one month under the GDPR, extendable by two months for complex cases; 15 days under the LGPD; 45 days under Californian law). We reply through the channel you used; copies of your data are provided electronically.</p>
<p><strong>Limits.</strong> We may refuse a request, in whole or in part, only in the cases the law allows; for example, we cannot erase data we must keep for tax purposes, data needed to perform an ongoing contract (an undelivered order or a standing bid), or data needed to establish, exercise or defend legal claims. If so, we will explain why.</p>
<p><strong>Limiting use or disclosure.</strong> You may also ask to be placed on our exclusion list so as not to receive promotional messages and, if you live in Mexico, register with PROFECO's public registry against advertising (REPEP). We do no telephone marketing.</p>
<h3>If you live in the European Economic Area, the United Kingdom or Switzerland</h3>
<p>You have the rights in Articles 15 to 22 GDPR (access, rectification, erasure, restriction, portability and objection), the right to withdraw consent and the right to lodge a complaint with the supervisory authority of your country of residence, of your place of work or of the place of the alleged infringement.${l.euRepresentative ? '' : ' Because we are an artist\'s studio that only occasionally sells works to people in the European Union, does not process special categories of data, and whose processing is unlikely to result in a risk to your rights, we have not appointed a representative in the Union (Art. 27(2) GDPR); you may contact us directly in English or Spanish.'}</p>
<h3>If you live in the United States of America</h3>
<p>Depending on your state (for example California, under the CCPA/CPRA), you may have the right to know the categories and specific pieces of personal information we collect, to delete it, to correct it, to limit the use of sensitive information, and not to be discriminated against for exercising your rights. The categories we collect, their purposes, sources and recipients are described in sections 2 to 5. <strong>We do not sell or share your personal information</strong> (including for cross-context behavioural advertising), have not done so in the past 12 months, and do not use or disclose sensitive personal information to infer characteristics about you. You may exercise your rights, yourself or through an authorised agent, by the means described in this section. As there is no cross-site tracking, there is no “Do Not Track” or “Global Privacy Control” signal for us to act on.</p>
<h3>If you live in Brazil</h3>
<p>You have the rights in Article 18 LGPD, including confirmation that processing exists, access, correction, anonymisation, blocking or deletion of unnecessary data, portability, information on whom your data is shared with and withdrawal of consent, and the right to petition the Autoridade Nacional de Proteção de Dados (ANPD).</p>
<h3>If you live elsewhere</h3>
<p>We will handle your request under this Notice and will also respect any mandatory rights given to you by the data protection law of your country (for example those of Canada, Argentina, Colombia, Chile, Peru, Australia or Japan).</p>

<h2 id="cookies">9. Cookies and tracking technologies</h2>
<p>This site uses <strong>a single, strictly necessary cookie</strong> to keep you signed in. We use no advertising, analytics or third-party cookies, no web beacons, pixels, browser fingerprinting or other tracking technology, and fonts are served from our own server. That is why there is no cookie banner: there is nothing optional to accept. Details are on the <a class="link" href="/legal/cookies">cookies page</a>. If you choose to pay with PayPal you will be redirected to PayPal's website, which uses its own cookies under its own policy.</p>

<h2 id="security">10. How we protect your data</h2>
<p>We apply administrative, technical and physical security measures proportionate to the risk, including: encrypted communications (HTTPS/TLS); passwords stored only as salted cryptographic hashes (scrypt); sessions with random identifiers that are not stored in clear; restricted administrative access recorded in an audit log; limits against automated attempts; backups; and collecting as little data as possible. No system is infallible: if a security breach significantly affects your rights we will inform you without delay, with the steps you can take, and will notify the authority where the law requires (under the GDPR, within 72 hours of becoming aware of it).</p>

<h2 id="automated">11. Automated decisions and profiling</h2>
<p>We make no decisions based solely on automated processing of your data that produce legal effects or significantly affect you, and we do no profiling. The outcome of an auction is determined by an objective, public rule (the highest valid bid at closing), and any incident is reviewed by a person.</p>

<h2 id="children">12. Children</h2>
<p>The site is intended for people aged 18 or over, and only they may create an account. We do not knowingly collect data from minors. If you are a parent or guardian and believe a minor gave us data, write to ${mail} and we will delete it.</p>

<h2 id="third-parties">13. Third-party sites</h2>
<p>The site may link to third-party sites (for example PayPal or a courier's tracking page). We are not responsible for their privacy practices; please read their notices.</p>

<h2 id="consent">14. Your consent</h2>
<p>By creating your account and ticking the relevant box you state that you have read this Notice and give your <strong>express consent</strong>, as required by Mexican law, to the processing of your personal data, including financial data relating to your purchases and payments, for the primary purposes described. We keep a record of the version you accepted and the date and time. Where the GDPR or a similar law applies, the legal bases for each purpose are those set out in section 3. Secondary purposes additionally require your specific opt-in (section 3).</p>

<h2 id="changes">15. Changes to this Notice</h2>
<p>We may update this Notice because of changes in the law, in our services or in our providers. The current version will always be at ${config.baseUrl}/legal/privacy with its effective date. If a change is material (for example new purposes or new recipients), we will notify you by e-mail before it takes effect and, where the law requires, ask for your consent again.</p>

<h2 id="authority">16. Data protection authorities</h2>
<p>If you believe your right to data protection has been infringed, please write to us first so we can try to resolve it. In any case, you have the right to turn to the competent authority:</p>
<ul>
  <li><strong>Mexico:</strong> the Secretaría Anticorrupción y Buen Gobierno, the authority that took over the functions of the INAI regarding personal data held by private parties.</li>
  <li><strong>European Union / EEA:</strong> the supervisory authority of your Member State (see the European Data Protection Board's directory).</li>
  <li><strong>United Kingdom:</strong> the Information Commissioner's Office (ICO).</li>
  <li><strong>Brazil:</strong> the Autoridade Nacional de Proteção de Dados (ANPD).</li>
  <li><strong>California:</strong> the California Privacy Protection Agency or the California Attorney General.</li>
  <li><strong>Other countries:</strong> the data protection authority of your place of residence.</li>
</ul>

<h2 id="language">17. Language</h2>
<p>This Notice is published in Spanish and in English. In case of discrepancy the Spanish version prevails, unless the law of your country of residence provides otherwise in your favour.</p>
<p class="fine">Version ${PRIVACY_VERSION}.</p>`,
  });
}

export function cookiesPage(req, config) {
  const name = config.production ? '__Host-sid' : 'sid';
  return page(req, {
    title: 'Cookies',
    body: html`<article class="sheet legal">
<h1>Cookies</h1>
<p>Este sitio usa <strong>una sola cookie</strong>, propia y estrictamente necesaria. No hay cookies de publicidad, analítica, redes sociales ni de terceros, y no usamos almacenamiento local, píxeles ni huellas del navegador para rastrearte. Por eso no hay banner de consentimiento: no existe nada opcional que aceptar o rechazar.</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Cookie</th><th>Para qué sirve</th><th>Cuándo se crea</th><th>Duración</th><th>Tipo</th></tr></thead>
  <tbody>
    <tr><td><code>${name}</code></td><td>Mantener tu sesión iniciada. Contiene un identificador aleatorio; no contiene datos personales. No es accesible para scripts (HttpOnly), solo viaja cifrada (Secure) y no se envía a otros sitios (SameSite).</td><td>Solo al iniciar sesión. Si navegas sin cuenta, no se crea ninguna cookie.</td><td>Hasta 30 días sin actividad, o hasta que cierres sesión.</td><td>Propia, estrictamente necesaria.</td></tr>
  </tbody>
</table></div>
<p>Puedes borrarla cerrando sesión o desde la configuración de tu navegador; si la bloqueas, no podrás iniciar sesión, pero sí visitar la galería y verificar certificados.</p>
<p>Si eliges pagar con PayPal, sales de este sitio hacia el de PayPal, que usa sus propias cookies conforme a su política.</p>
<p>Más información sobre cómo tratamos tus datos: <a class="link" href="/legal/privacidad">Aviso de Privacidad</a>.</p>

<hr>
<div lang="en">
<h2>Cookies (English)</h2>
<p>This site uses <strong>a single</strong> first-party, strictly necessary cookie. There are no advertising, analytics, social media or third-party cookies, and we do not use local storage, pixels or browser fingerprinting to track you. That is why there is no consent banner: there is nothing optional to accept or reject.</p>
<div class="tablewrap"><table class="tbl">
  <thead><tr><th>Cookie</th><th>Purpose</th><th>When it is set</th><th>Duration</th><th>Type</th></tr></thead>
  <tbody>
    <tr><td><code>${name}</code></td><td>Keeps you signed in. It holds a random identifier and no personal data. It is not readable by scripts (HttpOnly), is only sent over encrypted connections (Secure) and is not sent to other sites (SameSite).</td><td>Only when you sign in. If you browse without an account, no cookie is set.</td><td>Up to 30 days without activity, or until you sign out.</td><td>First-party, strictly necessary.</td></tr>
  </tbody>
</table></div>
<p>You can delete it by signing out or from your browser settings; if you block it you will not be able to sign in, but you can still browse the gallery and verify certificates.</p>
<p>If you choose to pay with PayPal you leave this site for PayPal's, which uses its own cookies under its own policy. More on how we handle your data: <a class="link" href="/legal/privacy">Privacy Notice</a>.</p>
</div>
<p class="fine">Versión / Version ${PRIVACY_VERSION}.</p>
</article>`,
  });
}
