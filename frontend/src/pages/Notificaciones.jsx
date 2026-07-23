import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

// Cada fila: llave del backend, etiqueta y descripción breve.
const PREFERENCIAS = [
  { key: 'recordatorio_citas', label: 'Recordatorio de citas', desc: 'Antes de cada cita agendada.' },
  { key: 'tareas_pendientes', label: 'Tareas pendientes', desc: 'Cuando una tarea terapéutica esté por vencer.' },
  { key: 'resumen_semanal', label: 'Resumen semanal', desc: 'Un resumen de tu actividad del consultorio.' },
  { key: 'novedades_producto', label: 'Novedades de Psicoteca', desc: 'Nuevas herramientas y mejoras de la app.' },
];

// Preferencias de notificación. Guardan la elección del usuario (fuente de
// verdad para cuando exista envío por correo/push); todavía no disparan un
// aviso real, así que el subtítulo lo dice de frente en vez de simular una
// función que no existe.
export default function Notificaciones() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getNotificaciones()
      .then((data) => {
        setPrefs(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar tus preferencias.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleToggle = async (key) => {
    const prev = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSavingKey(key);
    try {
      await api.saveNotificaciones({ [key]: next[key] });
    } catch (err) {
      setPrefs(prev);
      setError(err.message || 'No se pudo guardar el cambio.');
    } finally {
      setSavingKey(null);
    }
  };

  if (authLoading || !isAuthenticated) return null;

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
            <h1 className="settings__title">Notificaciones</h1>
            <p className="settings__subtitle">
              Elige qué quieres que te avisemos. Por ahora guardamos tu preferencia; el envío por correo llega pronto.
            </p>
          </div>
        </header>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}

        {!loading && prefs && (
          <div className="notif__list">
            {PREFERENCIAS.map((p) => (
              <div key={p.key} className="notif__row">
                <span className="notif__rowbody">
                  <span className="settings__value">{p.label}</span>
                  <span className="settings__muted">{p.desc}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!prefs[p.key]}
                  aria-label={p.label}
                  className={'toggle' + (prefs[p.key] ? ' is-on' : '')}
                  disabled={savingKey === p.key}
                  onClick={() => handleToggle(p.key)}
                >
                  <span className="toggle__thumb" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
