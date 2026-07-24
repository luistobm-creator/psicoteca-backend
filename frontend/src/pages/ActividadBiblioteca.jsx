import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Library, Lock } from '../components/icons.jsx';
import { fileType, timeAgo } from '../lib/fileType.js';
import FavoriteButton from '../components/FavoriteButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

// Copys por variante. Historial de lectura y Mis descargas son la MISMA
// pantalla (misma tabla `actividad_biblioteca`, filtrada por `accion`) — solo
// cambia el texto y el icono de fila, ver `main.jsx`.
const COPY = {
  vista: {
    title: 'Historial de lectura',
    subtitle: 'Documentos que has abierto recientemente.',
    empty: 'Aún no has abierto ningún documento. Explora la biblioteca para empezar.',
    RowIcon: Eye,
  },
  descarga: {
    title: 'Mis descargas',
    subtitle: 'Documentos que has descargado.',
    empty: 'Aún no has descargado ningún documento. Los que descargues aparecerán aquí.',
    RowIcon: Download,
  },
};

// Reconstruye el objeto "file" que espera el visor a partir de una fila de
// actividad (que ya guarda nombre/ruta/mime/premium en el momento del evento).
function rowToFile(row) {
  return {
    id: row.item_id,
    name: row.item_name,
    path: row.item_path,
    mime_type: row.item_mime,
    is_premium: row.item_is_premium,
  };
}

function Row({ row }) {
  const file = rowToFile(row);
  const { label, color } = fileType(file);
  const parentPath = (row.item_path || '').split('/').slice(0, -1).join(' › ');
  const copy = COPY[row.accion] || COPY.vista;
  const RowIcon = copy.RowIcon;

  return (
    <div className="result-wrap">
      <Link to="/app" state={{ openFile: file }} className="result" title={row.item_name}>
        <div className="result__icon" style={{ '--chip': color }}>
          <span className="result__ext">{label}</span>
        </div>
        <div className="result__body">
          <div className="result__name">{row.item_name}</div>
          <div className="result__path">{parentPath || 'PSICOTECA'}</div>
        </div>
        <div className="result__meta">{timeAgo(new Date(row.created_at))}</div>
        <span className="result__open" aria-hidden="true">
          {row.item_is_premium ? <Lock width={15} height={15} /> : <RowIcon width={15} height={15} />}
        </span>
      </Link>
      <FavoriteButton item={file} />
    </div>
  );
}

export default function ActividadBiblioteca({ accion }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const copy = COPY[accion];

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    api
      .getActividadBiblioteca(accion)
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) => setError(err.message || 'No se pudo cargar el historial.'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, accion]);

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
            <h1 className="settings__title">{copy.title}</h1>
            <p className="settings__subtitle">
              {copy.subtitle}
              {!loading && rows.length > 0 && ` · ${rows.length} ${rows.length === 1 ? 'documento' : 'documentos'}`}
            </p>
          </div>
        </header>

        {loading && <p className="settings__muted">Cargando…</p>}
        {!loading && error && <p className="settings__error">{error}</p>}
        {!loading && !error && rows.length === 0 && <p className="settings__muted">{copy.empty}</p>}

        {!loading && !error && rows.length > 0 && (
          <div className="results">
            {rows.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
