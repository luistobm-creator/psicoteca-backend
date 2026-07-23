import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Library } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const MONEDAS = ['MXN', 'USD', 'EUR', 'ARS', 'COP', 'CLP', 'PEN'];

// Configurar consultorio: datos generales (nombre, dirección, teléfono,
// duración de sesión y moneda por defecto). Una sola fila por usuario —
// se guarda con upsert, sin distinguir "crear" de "editar" en la UI.
export default function ConfigurarConsultorio() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [duracion, setDuracion] = useState(50);
  const [moneda, setMoneda] = useState('MXN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getConsultorioConfig()
      .then((data) => {
        setNombre(data.nombre_consultorio || '');
        setDireccion(data.direccion || '');
        setTelefono(data.telefono || '');
        setDuracion(data.duracion_sesion_default ?? 50);
        setMoneda(data.moneda || 'MXN');
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar la configuración.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.saveConsultorioConfig({
        nombre_consultorio: nombre.trim() || null,
        direccion: direccion.trim() || null,
        telefono: telefono.trim() || null,
        duracion_sesion_default: Number(duracion) || 50,
        moneda,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
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
          <h1 className="settings__title">Configurar consultorio</h1>
          <p className="settings__subtitle">Estos datos se usan como valores por defecto en Agenda y Facturación.</p>
        </header>

        {loading && <p className="settings__muted">Cargando…</p>}

        {!loading && (
          <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
            <div className="modal__field">
              <label className="settings__label">Nombre del consultorio</label>
              <input
                className="settings__input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="p. ej. Consultorio Dra. López"
              />
            </div>

            <div className="modal__field">
              <label className="settings__label">Dirección</label>
              <input
                className="settings__input"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="modal__row">
              <div className="modal__field">
                <label className="settings__label">Teléfono</label>
                <input
                  className="settings__input"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div className="modal__field">
                <label className="settings__label">Duración de sesión (min)</label>
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  className="settings__input"
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                />
              </div>
            </div>

            <div className="modal__field">
              <label className="settings__label">Moneda</label>
              <select className="settings__input" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {error && <div className="modal__error">{error}</div>}

            <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="settings__btn settings__btn--accent" disabled={saving}>
                {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
