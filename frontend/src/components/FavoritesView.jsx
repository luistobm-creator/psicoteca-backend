import ItemCard from './ItemCard.jsx';
import FavoriteButton from './FavoriteButton.jsx';
import { Heart } from './icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';

// Vista «Mis Favoritos»: la lista por defecto del usuario. Reutiliza ItemCard
// (mismo aspecto que el resto de la biblioteca; el corazón permite quitar desde
// aquí). Un favorito cuyo PDF ya no está en el catálogo (borrado, o a mitad de
// una sincronización en Render) se muestra atenuado con el nombre guardado, y
// aun así se puede quitar.
export default function FavoritesView({ activeId, plan = 'free', compact = false, onOpenFile }) {
  const { isAuthenticated } = useAuth();
  const { items, loading, ready, error } = useFavorites();

  if (!isAuthenticated) {
    return (
      <div className="grid-state muted">
        Inicia sesión para guardar y ver tus favoritos.
      </div>
    );
  }
  if (!ready || loading) return <div className="grid-state muted">Cargando…</div>;
  if (error) return <div className="grid-state error">Error: {error}</div>;
  if (!items.length) {
    return (
      <div className="favempty">
        <span className="favempty__icon" aria-hidden="true">
          <Heart width={26} height={26} />
        </span>
        <p className="favempty__title">Aún no tienes favoritos</p>
        <p className="muted">
          Pulsa el corazón en cualquier documento para guardarlo aquí.
        </p>
      </div>
    );
  }

  const noop = () => {};
  return (
    <div className={'grid fade-in' + (compact ? ' grid--compact' : '')}>
      {items.map((fav) =>
        fav.item ? (
          <ItemCard
            key={fav.item_id}
            item={fav.item}
            activeId={activeId}
            plan={plan}
            onOpenFolder={noop}
            onOpenFile={onOpenFile}
          />
        ) : (
          <div className="card-wrap" key={fav.item_id}>
            <div
              className="card card--file is-missing"
              title="Este documento ya no está disponible en la biblioteca"
            >
              <div className="card__icon card__icon--file" style={{ '--chip': '#94a3b8' }}>
                <span className="card__ext">—</span>
              </div>
              <div className="card__body">
                <div className="card__name">{fav.item_name || 'Documento'}</div>
                <div className="card__meta">No disponible</div>
              </div>
            </div>
            <FavoriteButton
              item={{ id: fav.item_id, name: fav.item_name, is_folder: false }}
            />
          </div>
        )
      )}
    </div>
  );
}
