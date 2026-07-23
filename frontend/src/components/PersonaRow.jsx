// Fila de persona: avatar (iniciales) + nombre + especialidad, con un slot
// `right` para la acción (botón "Mensaje", "Unirse", etc.). Reutilizada por
// el directorio de Mensajes y la lista de miembros de un Grupo.
export default function PersonaRow({ nombre, especialidad, right }) {
  const iniciales = (nombre || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="persona__row">
      <div className="persona__avatar">{iniciales}</div>
      <div className="persona__body">
        <div className="persona__nombre">{nombre || 'Sin nombre'}</div>
        {especialidad && <div className="persona__especialidad">{especialidad}</div>}
      </div>
      {right}
    </div>
  );
}
