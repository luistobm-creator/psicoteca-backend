import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { timeAgo } from '../lib/fileType.js';
import * as api from '../api.js';

// Activa/edita el perfil de Comunidad. Mismo componente para ambos casos:
// si `perfil.activo` es false actúa como formulario de activación (botón
// "Activar"); si ya está activo, es el editor + el puntaje publicado.
export default function PerfilComunidadForm({ perfil, onSaved }) {
  const { user } = useAuth();
  const [nombre, setNombre] = useState(perfil.nombre_publico || user?.name || '');
  const [especialidad, setEspecialidad] = useState(perfil.especialidad || '');
  const [bio, setBio] = useState(perfil.bio || '');
  const [saving, setSaving] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState(null);

  const activo = !!perfil.activo;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const guardado = await api.saveMiPerfilComunidad({
        nombre_publico: nombre.trim(),
        especialidad: especialidad.trim() || null,
        bio: bio.trim() || null,
        activo: true,
      });
      onSaved(guardado);
    } catch (err) {
      setError(err.message || 'No se pudo guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalcular = async () => {
    setRecalculando(true);
    try {
      const actualizado = await api.actualizarPuntosComunidad();
      onSaved(actualizado);
    } catch {
      /* si falla, el puntaje simplemente queda igual que antes */
    } finally {
      setRecalculando(false);
    }
  };

  const handleSalir = async () => {
    if (!window.confirm('¿Salir de la comunidad? Tu perfil dejará de ser visible para otros.')) return;
    try {
      const actualizado = await api.saveMiPerfilComunidad({ activo: false });
      onSaved(actualizado);
    } catch {
      /* red intermitente: el usuario puede reintentar */
    }
  };

  return (
    <div className="comunidad__perfilcard">
      {!activo && (
        <p className="settings__muted" style={{ marginBottom: 12 }}>
          Activa tu perfil para aparecer en el directorio, unirte a grupos y enviar mensajes. Solo se muestra lo que
          escribas aquí — nunca tus pacientes, notas ni facturación.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="modal__row">
          <div className="modal__field">
            <label className="settings__label">Nombre público</label>
            <input className="settings__input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="modal__field">
            <label className="settings__label">Especialidad (opcional)</label>
            <input
              className="settings__input"
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              placeholder="p. ej. Terapia cognitivo-conductual"
            />
          </div>
        </div>
        <div className="modal__field">
          <label className="settings__label">Bio (opcional)</label>
          <textarea
            className="modal__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={600}
          />
        </div>

        {error && <div className="modal__error">{error}</div>}

        <div className="modal__actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" className="settings__btn settings__btn--accent" disabled={!nombre.trim() || saving}>
            {saving ? 'Guardando…' : activo ? 'Guardar cambios' : 'Activar mi perfil en la comunidad'}
          </button>
          {activo && (
            <button type="button" className="settings__btn" onClick={handleRecalcular} disabled={recalculando}>
              {recalculando ? 'Calculando…' : 'Recalcular mi puntaje'}
            </button>
          )}
        </div>
      </form>

      {activo && (
        <div className="comunidad__perfilfoot">
          <span>
            <strong>{perfil.puntos ?? 0} puntos</strong>
            {perfil.puntos_actualizado_en && ` · actualizado ${timeAgo(new Date(perfil.puntos_actualizado_en))}`}
          </span>
          <button type="button" className="comunidad__salir" onClick={handleSalir}>
            Salir de la comunidad
          </button>
        </div>
      )}
    </div>
  );
}
