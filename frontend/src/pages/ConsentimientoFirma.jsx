import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Library } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

const TEXTO_BASE = `CONSENTIMIENTO INFORMADO

Yo, el/la paciente abajo firmante, declaro que he sido informado/a sobre la naturaleza, objetivos y modalidad del proceso terapéutico que voy a iniciar, incluyendo la confidencialidad de la información compartida y sus límites legales. Entiendo que puedo hacer preguntas en cualquier momento y que soy libre de suspender el proceso cuando lo decida.

Doy mi consentimiento para participar en este proceso terapéutico.`;

function formatWhen(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

// Consentimiento con firma: el paciente "firma" escribiendo su nombre
// completo, que queda registrado junto con el texto EXACTO que aceptó y la
// fecha/hora. No es una firma electrónica certificada -- no hay validación
// de identidad ni sello criptográfico -- así que el aviso queda visible,
// no solo en un rincón.
export default function ConsentimientoFirma() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [pacientes, setPacientes] = useState([]);
  const [pacientesError, setPacientesError] = useState(null);
  const [pacienteId, setPacienteId] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .getPacientes()
      .then((data) => {
        setPacientes(data);
        setPacientesError(null);
        setPacienteId((cur) => cur || data[0]?.id || '');
      })
      .catch((err) => setPacientesError(err.message || 'No se pudo cargar el directorio.'));
  }, [isAuthenticated]);

  const [historial, setHistorial] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState(null);

  const loadHistorial = (pid) => {
    if (!pid) {
      setHistorial([]);
      return;
    }
    setHistLoading(true);
    api
      .getConsentimientos(pid)
      .then((data) => {
        setHistorial(data);
        setHistError(null);
      })
      .catch((err) => setHistError(err.message || 'No se pudo cargar el historial.'))
      .finally(() => setHistLoading(false));
  };

  useEffect(() => {
    loadHistorial(pacienteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const [texto, setTexto] = useState(TEXTO_BASE);
  const [nombreFirma, setNombreFirma] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleFirmar = async (e) => {
    e.preventDefault();
    if (!pacienteId || !texto.trim() || !nombreFirma.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const creado = await api.createConsentimiento({
        paciente_id: pacienteId,
        texto: texto.trim(),
        nombre_firma: nombreFirma.trim(),
      });
      setHistorial((cur) => [creado, ...cur]);
      setNombreFirma('');
    } catch (err) {
      setError(err.message || 'No se pudo registrar el consentimiento.');
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
          <div>
            <h1 className="settings__title">Consentimiento con firma</h1>
            <p className="settings__subtitle">Registra la aceptación de tu paciente, con nombre y fecha.</p>
          </div>
        </header>

        <div className="consentimiento__notice">
          <AlertTriangle width={17} height={17} />
          <span>
            Esto <strong>no es una firma electrónica certificada</strong>: no valida identidad ni usa sello
            criptográfico. Es un registro simple de que el paciente escribió su nombre aceptando el texto de abajo, con
            fecha y hora. Adapta el texto a tu marco legal — esto no sustituye asesoría legal.
          </span>
        </div>

        {pacientesError && <p className="settings__error">{pacientesError}</p>}
        {!pacientesError && pacientes.length === 0 && (
          <p className="settings__muted">
            Todavía no tienes pacientes en tu directorio. <Link to="/app/pacientes">Agrega uno</Link> para poder
            registrar un consentimiento.
          </p>
        )}

        {pacientes.length > 0 && (
          <>
            <div className="notasvoz__patientsel">
              <label className="settings__label" htmlFor="consent-paciente">
                Paciente
              </label>
              <select
                id="consent-paciente"
                className="settings__input"
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
              >
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleFirmar}>
              <div className="modal__field">
                <label className="settings__label">Texto del consentimiento</label>
                <textarea
                  className="modal__textarea"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={9}
                  maxLength={8000}
                />
              </div>

              <div className="modal__field">
                <label className="settings__label">Nombre completo (firma)</label>
                <input
                  className="settings__input"
                  value={nombreFirma}
                  onChange={(e) => setNombreFirma(e.target.value)}
                  placeholder="Escribe tu nombre completo para firmar"
                />
              </div>

              {error && <div className="modal__error">{error}</div>}

              <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
                <button
                  type="submit"
                  className="settings__btn settings__btn--accent"
                  disabled={!texto.trim() || !nombreFirma.trim() || saving}
                >
                  {saving ? 'Guardando…' : 'Firmar y guardar'}
                </button>
              </div>
            </form>

            <h2 className="dash-section__title" style={{ marginTop: 28, marginBottom: 12 }}>
              Historial de este paciente
            </h2>

            {histLoading && <p className="settings__muted">Cargando…</p>}
            {!histLoading && histError && <p className="settings__error">{histError}</p>}
            {!histLoading && !histError && historial.length === 0 && (
              <p className="settings__muted">Este paciente aún no tiene un consentimiento registrado.</p>
            )}
            {!histLoading && !histError && historial.length > 0 && (
              <div className="notasvoz__list">
                {historial.map((c) => (
                  <div key={c.id} className="notasvoz__item">
                    <div className="notasvoz__itemhead">
                      <span className="notasvoz__iteminfo">
                        <span className="notasvoz__itemtitle">{c.nombre_firma}</span>
                        <span className="settings__muted">Firmado el {formatWhen(c.firmado_en)}</span>
                      </span>
                    </div>
                    <details>
                      <summary className="settings__muted" style={{ cursor: 'pointer' }}>
                        Ver texto aceptado
                      </summary>
                      <p className="sugerencia__msg" style={{ marginTop: 8 }}>
                        {c.texto}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
