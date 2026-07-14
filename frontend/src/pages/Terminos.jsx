import LegalLayout from './LegalLayout.jsx';
import { FileText } from '../components/icons.jsx';

// Términos y Condiciones de Psicoteca. Estructura: naturaleza del servicio
// (buscador/no autor), uso educativo, notice & takedown y exención de
// responsabilidad clínica. Datos del titular concretados para México (LFPDPPP);
// conviene una revisión de abogado antes de publicar en firme.
export default function Terminos() {
  return (
    <LegalLayout
      title="Términos y Condiciones de Uso"
      eyebrow="Documento legal"
      icon={FileText}
      updated="15 de julio de 2026"
    >
      {/* Ficha de datos del titular */}
      <dl className="lp-legal__facts">
        <div>
          <dt>Titular del servicio</dt>
          <dd>Luis Alberto Bautista</dd>
        </div>
        <div>
          <dt>Domicilio</dt>
          <dd>Iztapalapa, Ciudad de México, México</dd>
        </div>
        <div>
          <dt>Sitio</dt>
          <dd>psicoteca.miceliocreate.com</dd>
        </div>
        <div>
          <dt>Contacto</dt>
          <dd>
            <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a>
          </dd>
        </div>
      </dl>

      <p className="lp-legal__lead">
        Al acceder o utilizar Psicoteca (en adelante, «la Plataforma»), usted (en
        adelante, «el Usuario») acepta quedar vinculado por los presentes Términos y
        Condiciones. Si no está de acuerdo con ellos, le rogamos que no utilice la
        Plataforma.
      </p>

      {/* Índice */}
      <nav className="lp-legal__toc" aria-label="Índice">
        <p className="lp-legal__toc-title">Contenido</p>
        <ol>
          <li><a href="#s1">Objeto y naturaleza del servicio</a></li>
          <li><a href="#s2">Uso educativo y académico</a></li>
          <li><a href="#s3">Registro, planes y pagos</a></li>
          <li><a href="#s4">Propiedad intelectual y Política de Notificación y Retirada</a></li>
          <li><a href="#s5">Exención de responsabilidad sobre el uso clínico y diagnóstico</a></li>
          <li><a href="#s6">Limitación de responsabilidad general</a></li>
          <li><a href="#s7">Modificaciones</a></li>
          <li><a href="#s8">Ley aplicable y jurisdicción</a></li>
          <li><a href="#s9">Contacto</a></li>
        </ol>
      </nav>

      {/* 1 */}
      <section className="lp-legal__section" id="s1">
        <h2>1. Objeto y naturaleza del servicio</h2>
        <p>
          1.1. Psicoteca es una <strong>herramienta de búsqueda, indexación y
          organización</strong> de archivos y documentos de interés para el ámbito de
          la psicología. Su función es equivalente a la de un <strong>motor de
          búsqueda o catálogo</strong>: localizar, ordenar y facilitar el acceso a
          materiales, permitiendo al Usuario encontrarlos de forma estructurada.
        </p>
        <p>
          1.2. Psicoteca <strong>no es autor, editor ni propietario</strong> de los
          documentos que indexa u organiza. La Plataforma <strong>no reclama la
          autoría ni la titularidad</strong> de los derechos de propiedad intelectual
          sobre dichos materiales, cuyos derechos corresponden a sus respectivos
          autores, editoriales o titulares.
        </p>
        <p>
          1.3. La inclusión de un documento en el índice de Psicoteca <strong>no
          implica</strong> que el titular lo haya suministrado, respaldado o
          autorizado su distribución, ni constituye una afirmación de la Plataforma
          sobre la situación legal de dicho material.
        </p>
        <p>
          1.4. Psicoteca actúa como <strong>intermediario técnico</strong> que enlaza
          y presenta contenido. En la medida en que aloje o sirva copias de un
          material, lo hace en su condición de prestador de servicios de la sociedad
          de la información, y se acoge al procedimiento de <strong>notificación y
          retirada</strong> descrito en la Cláusula 4.
        </p>
      </section>

      {/* 2 */}
      <section className="lp-legal__section" id="s2">
        <h2>2. Uso educativo y académico</h2>
        <p>
          2.1. Psicoteca se ofrece con una finalidad <strong>exclusivamente educativa,
          académica, formativa y de investigación</strong>, dirigida principalmente a
          estudiantes, docentes, investigadores y profesionales de la psicología y
          disciplinas afines.
        </p>
        <p>
          2.2. Los materiales accesibles a través de la Plataforma se ponen a
          disposición para <strong>estudio, consulta y referencia personal</strong>.
          El Usuario se compromete a respetar los derechos de propiedad intelectual de
          los titulares y a hacer un uso leal (cita académica) conforme a la
          legislación aplicable.
        </p>
        <p>
          2.3. Queda <strong>prohibida</strong> la reproducción masiva, la
          redistribución comercial, la reventa o cualquier explotación del contenido
          que exceda el uso personal, académico o de investigación aquí previsto.
        </p>
        <p>
          2.4. El Usuario es el <strong>único responsable</strong> del uso que haga de
          los materiales, incluido el cumplimiento de las licencias, permisos y
          restricciones que cada titular imponga sobre su obra.
        </p>
      </section>

      {/* 3 */}
      <section className="lp-legal__section" id="s3">
        <h2>3. Registro, planes y pagos</h2>
        <p>
          3.1. Algunas funciones requieren la creación de una cuenta. El Usuario es
          responsable de la veracidad de sus datos y de la custodia de sus
          credenciales.
        </p>
        <p>
          3.2. Psicoteca ofrece un modelo <strong>freemium</strong>: un nivel gratuito
          y un nivel de pago («Pro») con funcionalidades ampliadas. <strong>El pago
          del plan Pro corresponde al acceso a las funcionalidades y al servicio de
          organización, indexación y lectura que presta la Plataforma, y no a la
          compra de los documentos ni de derechos sobre ellos.</strong>
        </p>
        <p>
          3.3. Los pagos se procesan a través de un proveedor externo (Stripe). Las
          condiciones de suscripción, renovación y cancelación se detallan en el
          proceso de contratación.
        </p>
      </section>

      {/* 4 */}
      <section className="lp-legal__section" id="s4">
        <h2>4. Propiedad intelectual y Política de Notificación y Retirada (Notice &amp; Takedown)</h2>
        <p>
          4.1. Psicoteca <strong>respeta los derechos de propiedad intelectual</strong>{' '}
          y colabora de forma diligente con sus titulares. Si usted es autor, editorial
          o titular de derechos (o su representante autorizado) y considera que un
          material accesible a través de la Plataforma <strong>infringe</strong> sus
          derechos, puede solicitar su retirada mediante el procedimiento aquí descrito.
        </p>
        <p>
          4.2. <strong>Cómo enviar una reclamación.</strong> Envíe una comunicación a{' '}
          <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a> con el asunto «Retirada de contenido — Derechos de
          autor», incluyendo:
        </p>
        <ol className="lp-legal__alpha">
          <li>
            <strong>Identificación de la obra</strong> presuntamente infringida
            (título, autor, editorial, ISBN o descripción suficiente).
          </li>
          <li>
            <strong>Localización exacta</strong> del material en la Plataforma: URL(s),
            nombre del archivo o cualquier dato que permita identificarlo sin
            ambigüedad.
          </li>
          <li>
            <strong>Sus datos de contacto:</strong> nombre completo, entidad, dirección
            postal, correo electrónico y teléfono.
          </li>
          <li>
            <strong>Declaración de titularidad</strong> o de estar autorizado para
            actuar en nombre del titular.
          </li>
          <li>
            <strong>Declaración de buena fe</strong> de que el uso del material no está
            autorizado por el titular, su representante o la ley.
          </li>
          <li>
            <strong>Firma</strong> física o electrónica del titular o de la persona
            autorizada.
          </li>
        </ol>
        <p>
          4.3. <strong>Nuestro compromiso.</strong> Una vez recibida una notificación
          válida, Psicoteca procederá a <strong>retirar o bloquear el acceso al
          material de forma expedita</strong> (nuestro objetivo es actuar en un plazo
          máximo de 48 a 72 horas hábiles), sin necesidad de que el reclamante
          inicie acción legal alguna. No es necesaria una orden judicial para que
          retiremos el contenido: <strong>basta una solicitud fundada del
          titular.</strong>
        </p>
        <p>
          4.4. <strong>Retirada preventiva.</strong> Psicoteca podrá retirar cualquier
          material por iniciativa propia, en cualquier momento y sin previo aviso,
          cuando existan indicios razonables de que pueda vulnerar derechos de terceros
          o estos Términos.
        </p>
        <p>
          4.5. <strong>Contranotificación.</strong> Si un Usuario considera que un
          material fue retirado por error, podrá comunicarlo a la misma dirección
          aportando la justificación correspondiente, que será valorada.
        </p>
        <p>
          4.6. <strong>Reincidencia.</strong> Psicoteca podrá suspender o cancelar las
          cuentas de Usuarios que incurran de forma reiterada en la subida o difusión
          de material infractor.
        </p>
      </section>

      {/* 5 */}
      <section className="lp-legal__section" id="s5">
        <h2>5. Exención de responsabilidad sobre el uso clínico y diagnóstico</h2>
        <p>
          5.1. Los materiales disponibles en la Plataforma, <strong>incluidas pruebas,
          test, escalas, cuestionarios e instrumentos psicométricos</strong>, se
          ofrecen únicamente con fines <strong>informativos, educativos y de
          estudio</strong>.
        </p>
        <p>
          5.2. Psicoteca <strong>no presta servicios clínicos, sanitarios,
          diagnósticos ni terapéuticos</strong>, y <strong>no sustituye</strong> el
          juicio de un profesional cualificado ni una relación clínica.
        </p>
        <p>
          5.3. La correcta aplicación, corrección e interpretación de los instrumentos
          psicométricos requiere <strong>formación especializada, autorización
          profesional y, en muchos casos, licencias específicas</strong> de sus
          titulares. <strong>El Usuario es el único responsable</strong> de contar con
          la cualificación y las autorizaciones necesarias para su uso.
        </p>
        <p>
          5.4. Psicoteca <strong>declina toda responsabilidad</strong> por daños,
          perjuicios o consecuencias de cualquier índole derivados del <strong>uso
          indebido, no autorizado, negligente o profesionalmente incorrecto</strong>{' '}
          que el Usuario haga de los materiales, en particular de su aplicación clínica
          o diagnóstica. Todo uso se realiza <strong>bajo la exclusiva responsabilidad
          del Usuario</strong>.
        </p>
      </section>

      {/* 6 */}
      <section className="lp-legal__section" id="s6">
        <h2>6. Limitación de responsabilidad general</h2>
        <p>
          6.1. La Plataforma se ofrece <strong>«tal cual» y «según
          disponibilidad»</strong>, sin garantías de exactitud, integridad, vigencia o
          adecuación a un fin concreto de los materiales indexados.
        </p>
        <p>
          6.2. En la máxima medida permitida por la ley, Psicoteca no será responsable
          de daños directos o indirectos derivados del uso o de la imposibilidad de uso
          de la Plataforma, ni de interrupciones, errores o pérdida de datos.
        </p>
      </section>

      {/* 7 */}
      <section className="lp-legal__section" id="s7">
        <h2>7. Modificaciones</h2>
        <p>
          7.1. Psicoteca podrá modificar estos Términos en cualquier momento. Los
          cambios se publicarán en esta página con su fecha de actualización. El uso
          continuado de la Plataforma tras la publicación implica la aceptación de los
          nuevos Términos.
        </p>
      </section>

      {/* 8 */}
      <section className="lp-legal__section" id="s8">
        <h2>8. Ley aplicable y jurisdicción</h2>
        <p>
          8.1. Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.
          Para la interpretación y cumplimiento de estos Términos, las partes se someten
          a la jurisdicción de los tribunales competentes de la Ciudad de México, salvo
          que la normativa de protección al consumidor aplicable disponga otro fuero.
        </p>
      </section>

      {/* 9 */}
      <section className="lp-legal__section" id="s9">
        <h2>9. Contacto</h2>
        <p>
          Para cualquier consulta sobre estos Términos, o para ejercer el procedimiento
          de retirada de la Cláusula 4, escriba a:{' '}
          <a href="mailto:luis.to.bm@gmail.com">luis.to.bm@gmail.com</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
