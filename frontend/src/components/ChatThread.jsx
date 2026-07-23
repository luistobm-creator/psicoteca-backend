import { useEffect, useRef, useState } from 'react';
import { Send } from './icons.jsx';

function formatHora(iso) {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Hilo de chat compartido por Grupos de estudio y Mensajes directos: recibe
// una lista YA NORMALIZADA a {id, contenido, created_at, esMio, autor?} —
// cada página adapta su propia forma de datos (grupo o 1-a-1) antes de
// pasarla aquí, así este componente no necesita conocer ninguna de las dos.
export default function ChatThread({ mensajes, onEnviar, placeholder = 'Escribe un mensaje…', vacio = 'Todavía no hay mensajes.' }) {
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mensajes.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor || sending) return;
    setSending(true);
    try {
      await onEnviar(valor);
      setTexto('');
    } catch {
      /* el error ya lo puede mostrar la página si lo necesita */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat">
      <div className="chat__list" ref={listRef}>
        {mensajes.length === 0 && <p className="chat__empty">{vacio}</p>}
        {mensajes.map((m) => (
          <div key={m.id} className={'chat__bubble' + (m.esMio ? ' is-own' : '')}>
            {m.autor && !m.esMio && <span className="chat__author">{m.autor}</span>}
            <p>{m.contenido}</p>
            <span className="chat__time">{formatHora(m.created_at)}</span>
          </div>
        ))}
      </div>
      <form className="chat__compose" onSubmit={handleSubmit}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          maxLength={2000}
        />
        <button type="submit" className="chat__send" disabled={!texto.trim() || sending} aria-label="Enviar">
          <Send width={17} height={17} />
        </button>
      </form>
    </div>
  );
}
