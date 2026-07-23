import { Link } from 'react-router-dom';
import { ArrowLeft, Library, Mail } from '../components/icons.jsx';

const SOPORTE_EMAIL = 'luis.to.bm@gmail.com';

const FAQ = [
  {
    q: '¿Qué es Psicoteca?',
    a: 'Una biblioteca clínica digital con herramientas de estudio (Modo examen, Tarjetas de repaso, Glosario clínico) y de consulta (Agenda, Directorio de pacientes, Notas de voz, Facturación, Consentimientos) en un solo lugar.',
  },
  {
    q: '¿Cuál es la diferencia entre el plan gratuito y Pro?',
    a: 'Cualquiera puede explorar toda la biblioteca. El contenido marcado como Pro requiere el plan de pago para leerse o descargarse. Administra tu plan desde Ajustes → Suscripción y facturación.',
  },
  {
    q: '¿Cómo cancelo o cambio mi plan?',
    a: (
      <>
        Desde <Link to="/configuracion">Ajustes</Link>, en la sección de suscripción.
      </>
    ),
  },
  {
    q: '¿Mis pacientes, notas y consentimientos son privados?',
    a: 'Sí. Cada cuenta solo puede ver su propia información: pacientes, notas de voz, tareas, facturación y consentimientos están aislados a nivel de base de datos, así que nadie más tiene acceso a tus registros.',
  },
  {
    q: '¿El Consentimiento con firma tiene validez legal de firma electrónica?',
    a: 'No. Es un registro simple de que tu paciente escribió su nombre aceptando un texto, con fecha y hora — no valida identidad ni usa sello criptográfico. No sustituye asesoría legal ni una firma electrónica certificada.',
  },
  {
    q: '¿Cómo reporto un error o sugiero una mejora?',
    a: (
      <>
        Desde el <Link to="/app/sugerencias">Buzón de sugerencias</Link> — leemos cada envío.
      </>
    ),
  },
  {
    q: 'Olvidé mi contraseña o no puedo iniciar sesión',
    a: (
      <>
        Por ahora no hay recuperación automática en la app: escríbenos a{' '}
        <a href={`mailto:${SOPORTE_EMAIL}`}>{SOPORTE_EMAIL}</a> y te ayudamos a recuperar el acceso.
      </>
    ),
  },
  {
    q: '¿Por dónde empiezo?',
    a: (
      <>
        Explora la biblioteca desde <Link to="/app">tu explorador</Link> y, si llevas consulta, agrega tu primer
        paciente en <Link to="/app/pacientes">Directorio de pacientes</Link>.
      </>
    ),
  },
];

// Ayuda y soporte: contenido mayormente estático (FAQ + contacto). No hay
// tabla ni endpoint -- es la única pantalla del menú Perfil que no necesita
// datos del usuario para tener sentido.
export default function AyudaSoporte() {
  return (
    <div className="settings">
      <div className="settings__panel fade-in">
        <div className="settings__topbar">
          <Link to="/app" className="settings__brand" title="Ir a la biblioteca">
            <span className="settings__logo">
              <Library width={20} height={20} />
            </span>
            Psicoteca
          </Link>
          <Link to="/app/perfil" className="settings__back">
            <ArrowLeft width={15} height={15} />
            Volver al menú
          </Link>
        </div>

        <header className="settings__head">
          <div>
            <h1 className="settings__title">Ayuda y soporte</h1>
            <p className="settings__subtitle">Preguntas frecuentes y cómo contactarnos.</p>
          </div>
        </header>

        <div className="faq__list">
          {FAQ.map((item) => (
            <details key={item.q} className="faq__item">
              <summary className="faq__question">{item.q}</summary>
              <p className="faq__answer">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="referidos__card" style={{ marginTop: 20 }}>
          <div className="referidos__icon">
            <Mail width={20} height={20} />
          </div>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <p className="settings__label" style={{ marginBottom: 4 }}>
              ¿No encontraste lo que buscabas?
            </p>
            <p className="settings__muted">
              Escríbenos directamente a <a href={`mailto:${SOPORTE_EMAIL}`}>{SOPORTE_EMAIL}</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
