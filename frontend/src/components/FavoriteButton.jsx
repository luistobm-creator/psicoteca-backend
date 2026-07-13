import { Heart } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';

// Botón de corazón para guardar/quitar un documento de «Mis Favoritos».
//
// - Se muestra SOLO a usuarios autenticados y SOLO para archivos (los favoritos
//   son documentos, no carpetas; el backend además rechaza carpetas).
// - Vive como hermano (no hijo) del botón de la card/fila y va superpuesto por
//   CSS, así que no anida botones. `stopPropagation` es una red de seguridad
//   extra para que el clic nunca dispare la apertura del documento.
// - El cambio es OPTIMISTA (ver FavoritesContext.toggle): la UI responde al
//   instante y, si el servidor falla, el contexto se reconcilia solo.
//
// `className` permite variantes de posición: `fav--corner` (superpuesto en
// cards/filas) o `fav--bar` (en la barra del visor).
export default function FavoriteButton({ item, className = '' }) {
  const { isAuthenticated } = useAuth();
  const { isFavorite, toggle } = useFavorites();

  if (!isAuthenticated || !item || item.is_folder) return null;

  const fav = isFavorite(item.id);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    // El error ya se gestiona en el contexto (rollback + recarga).
    toggle(item).catch(() => {});
  };

  const label = fav ? 'Quitar de Mis Favoritos' : 'Guardar en Mis Favoritos';

  return (
    <button
      type="button"
      className={'fav' + (fav ? ' is-active' : '') + (className ? ' ' + className : '')}
      onClick={handleClick}
      aria-pressed={fav}
      aria-label={label}
      title={label}
    >
      <Heart width={16} height={16} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}
