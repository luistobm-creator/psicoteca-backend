import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowLeft, Library, Maximize, Quote } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { readLastOpened } from '../lib/recents.js';

const PANEL = 'rounded-2xl border border-border bg-surface p-8 shadow-sm sm:p-10';
const PRIMARY_BTN =
  'inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-5 py-3 text-sm font-bold text-white ' +
  'shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 ' +
  'hover:shadow-[0_6px_18px_-4px_var(--accent-soft)] active:translate-y-0';
const SECONDARY_BTN =
  'inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-ink-muted ' +
  'transition-colors duration-150 hover:border-accent/40 hover:text-accent';

function truncar(name, max = 42) {
  if (!name) return 'tu documento';
  return name.length > max ? `${name.slice(0, max - 1).trim()}…` : name;
}

// Modo enfoque y Citas APA no son pantallas propias: viven DENTRO del lector
// de documentos (ver ReaderPanel.jsx), porque ambas necesitan un documento
// abierto para tener sentido — no hay "modo enfoque en abstracto" ni una cita
// APA sin un documento del que citar. En vez de dejar el enlace del menú
// Perfil cayendo en un callejón sin salida, esta pantalla explica la
// herramienta y, si hay un documento reciente (accesos rápidos, ya
// persistidos en localStorage por App.jsx), ofrece continuar directo con él
// y activar la herramienta al llegar — mismo mecanismo de `location.state`
// que ya usan Historial de lectura / Mis descargas para reabrir un archivo.
const CONFIG = {
  enfoque: {
    title: 'Modo enfoque',
    Icon: Maximize,
    lead: 'Lectura sin distracciones: oculta el menú y la barra superior para que solo quede el documento en pantalla.',
    detail:
      'Vive dentro del lector de documentos. Abre cualquier archivo de tu biblioteca y busca el ícono de pantalla completa en la barra superior del lector — o sal en cualquier momento con Esc.',
    continueLabel: (name) => `Continuar leyendo "${truncar(name)}"`,
    stateFor: (file) => ({ openFile: file, activateFocus: true }),
  },
  apa: {
    title: 'Citas y referencias APA',
    Icon: Quote,
    lead: 'Genera una referencia en formato APA (7ma edición) a partir de cualquier documento que estés leyendo.',
    detail:
      'Vive dentro del lector de documentos. Abre cualquier archivo de tu biblioteca y busca el ícono de comillas en la barra superior del lector para completar autor, año y editorial.',
    continueLabel: (name) => `Generar cita de "${truncar(name)}"`,
    stateFor: (file) => ({ openFile: file, openCitar: true }),
  },
};

export default function HerramientaLector({ tool }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || !isAuthenticated) return null;

  const cfg = CONFIG[tool];
  const Icon = cfg.Icon;
  const ultimo = readLastOpened();

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
            <h1 className="settings__title">{cfg.title}</h1>
            <p className="settings__subtitle">{cfg.lead}</p>
          </div>
        </header>

        <div className={PANEL + ' flex flex-col items-center gap-5 text-center'}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-lg">
            <Icon width={28} height={28} />
          </span>
          <p className="max-w-md text-sm leading-relaxed text-ink-muted">{cfg.detail}</p>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            {ultimo && (
              <Link to="/app" state={cfg.stateFor(ultimo)} className={PRIMARY_BTN}>
                {cfg.continueLabel(ultimo.name)}
              </Link>
            )}
            <Link to="/app" className={ultimo ? SECONDARY_BTN : PRIMARY_BTN}>
              Ir a la biblioteca
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
