import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Library, Mail } from '../components/icons.jsx';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

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

        <div className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className={CARD + ' group p-4'}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  width={16}
                  height={16}
                  className="shrink-0 text-ink-soft transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted [&_a]:font-semibold [&_a]:text-accent [&_a]:hover:underline">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <div className={CARD + ' flex items-start gap-4 p-4'}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-sm">
            <Mail width={20} height={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">¿No encontraste lo que buscabas?</p>
            <p className="mt-1 text-sm text-ink-muted">
              Escríbenos directamente a{' '}
              <a href={`mailto:${SOPORTE_EMAIL}`} className="font-semibold text-accent hover:underline">
                {SOPORTE_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
