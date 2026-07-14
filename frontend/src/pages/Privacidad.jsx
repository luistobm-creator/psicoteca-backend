import LegalLayout from './LegalLayout.jsx';
import { Lock } from '../components/icons.jsx';

// Aviso de Privacidad de Psicoteca, redactado conforme a la Ley Federal de
// Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de
// México: identidad del responsable, datos y finalidades, transferencias a
// encargados (Supabase/Stripe/Render/Hostinger/Google), derechos ARCO e INAI.
// Conviene una revisión de abogado antes de publicar en firme.
export default function Privacidad() {
  return (
    <LegalLayout
      title="Aviso de Privacidad"
      eyebrow="Documento legal"
      icon={Lock}
      updated="15 de julio de 2026"
    >
      <dl className="lp-legal__facts">
        <div>
          <dt>Responsable del tratamiento</dt>
          <dd>Luis Alberto Bautista</dd>
        </div>
        <div>
          <dt>Domicilio</dt>
          <dd>Iztapalapa, Ciudad de México, México</dd>
        </div>
        <div>
          <dt>Contacto</dt>
          <dd>
            <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a>
          </dd>
        </div>
      </dl>

      <p className="lp-legal__lead">
        Este Aviso de Privacidad describe cómo Psicoteca recaba, usa, protege y comparte
        tus datos personales, en cumplimiento de la Ley Federal de Protección de Datos
        Personales en Posesión de los Particulares (LFPDPPP), su Reglamento y demás
        normativa aplicable en México.
      </p>

      <nav className="lp-legal__toc" aria-label="Índice">
        <p className="lp-legal__toc-title">Contenido</p>
        <ol>
          <li><a href="#p1">Responsable del tratamiento</a></li>
          <li><a href="#p2">Datos personales que tratamos</a></li>
          <li><a href="#p3">Finalidades del tratamiento</a></li>
          <li><a href="#p4">Transferencias y encargados</a></li>
          <li><a href="#p5">Conservación de los datos</a></li>
          <li><a href="#p6">Tus derechos ARCO</a></li>
          <li><a href="#p7">Cookies y almacenamiento local</a></li>
          <li><a href="#p8">Cambios en este Aviso</a></li>
          <li><a href="#p9">Contacto</a></li>
        </ol>
      </nav>

      {/* 1 */}
      <section className="lp-legal__section" id="p1">
        <h2>1. Responsable del tratamiento</h2>
        <p>
          El responsable del tratamiento de tus datos personales es <strong>Luis Alberto
          Bautista</strong> («Psicoteca», «nosotros»), con domicilio en Iztapalapa, Ciudad
          de México, México, y correo electrónico de contacto{' '}
          <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a>. Como responsable,
          decidimos sobre el tratamiento de tus datos y velamos por su protección conforme
          a la LFPDPPP.
        </p>
      </section>

      {/* 2 */}
      <section className="lp-legal__section" id="p2">
        <h2>2. Datos personales que tratamos</h2>
        <p>Para prestarte el servicio tratamos las siguientes categorías de datos:</p>
        <ul>
          <li>
            <strong>Datos de identificación y contacto:</strong> tu dirección de correo
            electrónico, que proporcionas al crear tu cuenta.
          </li>
          <li>
            <strong>Datos de autenticación:</strong> las credenciales de acceso, que
            gestiona de forma segura nuestro proveedor Supabase. Tu contraseña se almacena
            cifrada y <strong>nunca la conservamos en texto legible</strong>.
          </li>
          <li>
            <strong>Datos de facturación y pago:</strong> cuando contratas el plan Pro, el
            pago lo procesa directamente Stripe. <strong>Psicoteca no almacena los números
            completos de tu tarjeta</strong>; únicamente recibimos de Stripe información
            limitada para gestionar tu suscripción (por ejemplo, su estado y los últimos
            dígitos de la tarjeta).
          </li>
          <li>
            <strong>Datos de uso y técnicos:</strong> tus preferencias dentro de la
            plataforma (tema, favoritos y documentos recientes) y registros técnicos como
            la dirección IP o el tipo de navegador, necesarios para operar, asegurar y
            mejorar el servicio.
          </li>
        </ul>
        <p>
          Psicoteca <strong>no recaba datos personales sensibles</strong> (como los
          relativos a salud, creencias u orientación) para la prestación de este servicio.
        </p>
      </section>

      {/* 3 */}
      <section className="lp-legal__section" id="p3">
        <h2>3. Finalidades del tratamiento</h2>
        <p>
          <strong>Finalidades primarias</strong> (necesarias para prestarte el servicio):
        </p>
        <ul>
          <li>Crear, autenticar y administrar tu cuenta de usuario.</li>
          <li>Darte acceso a la biblioteca y a sus funciones de búsqueda y lectura.</li>
          <li>Procesar el pago, la suscripción y, en su caso, la cancelación del plan Pro.</li>
          <li>Brindarte soporte y comunicarnos contigo sobre asuntos del servicio.</li>
          <li>Prevenir fraudes y garantizar la seguridad de la plataforma.</li>
        </ul>
        <p>
          <strong>Finalidades secundarias</strong> (no necesarias para el servicio; puedes
          oponerte a ellas):
        </p>
        <ul>
          <li>Mejorar y personalizar tu experiencia en la plataforma.</li>
          <li>Informarte sobre novedades, colecciones o mejoras del servicio.</li>
        </ul>
        <p>
          Si no deseas que tus datos se utilicen para las finalidades secundarias, puedes
          manifestarlo enviando un correo a{' '}
          <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a>. Tu negativa no
          será motivo para negarte el servicio.
        </p>
      </section>

      {/* 4 */}
      <section className="lp-legal__section" id="p4">
        <h2>4. Transferencias y encargados</h2>
        <p>
          Para operar Psicoteca nos apoyamos en proveedores tecnológicos que tratan datos
          por nuestra cuenta (encargados) o que prestan servicios de infraestructura:
        </p>
        <ul>
          <li><strong>Supabase</strong> — autenticación de usuarios y base de datos.</li>
          <li><strong>Stripe</strong> — procesamiento de pagos y suscripciones.</li>
          <li><strong>Render</strong> — alojamiento del servidor y la API.</li>
          <li><strong>Hostinger</strong> — alojamiento del sitio web.</li>
          <li><strong>Google (Google Drive)</strong> — almacenamiento de los archivos de la biblioteca.</li>
        </ul>
        <p>
          Algunos de estos proveedores se encuentran fuera de México (por ejemplo, en
          Estados Unidos o la Unión Europea), por lo que tus datos pueden ser objeto de
          transferencias internacionales, sujetas a las medidas de protección que exige la
          normativa aplicable. <strong>No vendemos ni comercializamos tus datos
          personales</strong>, ni los compartimos con terceros para fines distintos de los
          descritos en este Aviso, salvo obligación legal o requerimiento de autoridad
          competente.
        </p>
      </section>

      {/* 5 */}
      <section className="lp-legal__section" id="p5">
        <h2>5. Conservación de los datos</h2>
        <p>
          Conservamos tus datos personales mientras tu cuenta permanezca activa y durante
          el tiempo necesario para cumplir con las finalidades descritas y con las
          obligaciones legales, fiscales y contables aplicables (por ejemplo, los registros
          de facturación). Cuando canceles tu cuenta, procederemos a eliminar o anonimizar
          tus datos personales, salvo aquellos que debamos conservar por disposición legal.
        </p>
      </section>

      {/* 6 */}
      <section className="lp-legal__section" id="p6">
        <h2>6. Tus derechos ARCO</h2>
        <p>
          Como titular de los datos, tienes derecho a <strong>Acceder</strong> a tus datos
          personales, <strong>Rectificarlos</strong> cuando sean inexactos o estén
          incompletos, <strong>Cancelarlos</strong> cuando consideres que no se requieren
          para las finalidades señaladas, y <strong>Oponerte</strong> a su tratamiento
          (los denominados derechos ARCO). También puedes <strong>revocar</strong> el
          consentimiento que nos hayas otorgado o limitar el uso o divulgación de tus datos.
        </p>
        <p>
          Para ejercer cualquiera de estos derechos, envía tu solicitud a{' '}
          <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a> indicando tu
          nombre, el correo asociado a tu cuenta y el derecho que deseas ejercer.
          Atenderemos tu solicitud en los plazos que establece la LFPDPPP.
        </p>
        <p>
          Si consideras que tu derecho a la protección de datos personales ha sido
          vulnerado, puedes acudir al Instituto Nacional de Transparencia, Acceso a la
          Información y Protección de Datos Personales (INAI), en{' '}
          <a href="https://home.inai.org.mx" target="_blank" rel="noreferrer">home.inai.org.mx</a>.
        </p>
      </section>

      {/* 7 */}
      <section className="lp-legal__section" id="p7">
        <h2>7. Cookies y almacenamiento local</h2>
        <p>
          Psicoteca utiliza el almacenamiento local de tu navegador (localStorage) para
          recordar tus preferencias —tema claro u oscuro, documentos recientes y
          favoritos— y para mantener tu sesión iniciada. Algunos de nuestros proveedores,
          como Stripe, pueden emplear cookies propias estrictamente necesarias para
          procesar los pagos de forma segura. Puedes borrar este almacenamiento desde la
          configuración de tu navegador, si bien algunas funciones podrían dejar de operar
          correctamente.
        </p>
      </section>

      {/* 8 */}
      <section className="lp-legal__section" id="p8">
        <h2>8. Cambios en este Aviso</h2>
        <p>
          Podemos actualizar este Aviso de Privacidad para reflejar cambios en el servicio
          o en la legislación aplicable. Publicaremos la versión vigente en esta página con
          su fecha de actualización, y te comunicaremos los cambios relevantes por los
          medios que tengamos disponibles.
        </p>
      </section>

      {/* 9 */}
      <section className="lp-legal__section" id="p9">
        <h2>9. Contacto</h2>
        <p>
          Para cualquier duda sobre este Aviso de Privacidad o sobre el tratamiento de tus
          datos personales, escribe a:{' '}
          <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
