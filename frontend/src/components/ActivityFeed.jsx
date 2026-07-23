import { Link } from 'react-router-dom';
import { Activity } from './icons.jsx';
import { timeAgo } from '../lib/fileType.js';

// "Actividad reciente": timeline unificado de altas/eventos reales (pacientes,
// tareas, glosario, exámenes) ya combinado y ordenado por Dashboard.jsx. Este
// componente es puramente presentacional, igual que QuickAccess.
export default function ActivityFeed({ events = [], loading = false }) {
  return (
    <section className="dash-section fade-in">
      <header className="dash-section__head">
        <h2 className="dash-section__title">
          <Activity width={17} height={17} />
          Actividad reciente
        </h2>
      </header>

      {loading && <p className="muted">Cargando…</p>}

      {!loading && events.length === 0 && (
        <p className="muted activity__empty">
          Aún no hay actividad reciente — empieza agregando un paciente, una tarea o un término del glosario.
        </p>
      )}

      {!loading && events.length > 0 && (
        <div className="activity">
          {events.map((e) => (
            <Link key={e.id} to={e.to} className="activity__row">
              <span className="activity__icon">{e.icon}</span>
              <span className="activity__body">
                <span className="activity__label">{e.label}</span>
                {e.sublabel && <span className="activity__sublabel">{e.sublabel}</span>}
              </span>
              <span className="activity__time">{timeAgo(e.at)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
