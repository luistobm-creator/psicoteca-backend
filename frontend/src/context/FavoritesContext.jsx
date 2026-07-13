import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as api from '../api.js';
import { useAuth } from './AuthContext.jsx';

// ============================================================================
// FavoritesContext · «Mis Favoritos» de un toque
// ============================================================================
// El backend es de PLAYLISTS (varias listas con nombre). En esta primera versión
// exponemos UNA sola lista por defecto llamada DEFAULT_LIST_NAME: el corazón la
// alterna al instante. La lista se AUTOCREA en el primer guardado (no antes, para
// no crear listas vacías a usuarios que nunca guardan nada).
//
// Los favoritos son por-usuario (RLS en Supabase): al cambiar de sesión se
// recargan; al cerrar sesión se vacían. `ids` (Set de item_id) alimenta el
// estado del corazón; `items` (con metadata del catálogo) alimenta la vista.
// ============================================================================

const DEFAULT_LIST_NAME = 'Mis Favoritos';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { isAuthenticated, user } = useAuth();

  const [playlistId, setPlaylistId] = useState(null);
  const [ids, setIds] = useState(() => new Set()); // item_id guardados (para el corazón)
  const [items, setItems] = useState([]); // items con metadata (para la vista)
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // Descarta respuestas viejas si la sesión cambia a mitad de una carga.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (!isAuthenticated) {
      setPlaylistId(null);
      setIds(new Set());
      setItems([]);
      setError(null);
      setLoading(false);
      setReady(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lists = await api.getPlaylists();
      if (seq !== loadSeq.current) return;
      // Lista por defecto: la que se llama DEFAULT_LIST_NAME (o la primera que
      // exista). Si el usuario no tiene ninguna, se creará al primer guardado.
      const def =
        (lists || []).find((p) => p.name === DEFAULT_LIST_NAME) ||
        (lists || [])[0] ||
        null;
      if (!def) {
        setPlaylistId(null);
        setIds(new Set());
        setItems([]);
        return;
      }
      const detail = await api.getPlaylist(def.id);
      if (seq !== loadSeq.current) return;
      setPlaylistId(def.id);
      setItems(detail.items || []);
      setIds(new Set((detail.items || []).map((it) => it.item_id)));
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(e.message || 'No se pudieron cargar los favoritos.');
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
        setReady(true);
      }
    }
  }, [isAuthenticated]);

  // (Re)carga al montar y cada vez que cambia la sesión/usuario.
  useEffect(() => {
    load();
  }, [load, user?.id]);

  const isFavorite = useCallback((id) => ids.has(id), [ids]);

  // Asegura que existe la lista por defecto; la crea si hace falta y devuelve su id.
  const ensureList = useCallback(async () => {
    if (playlistId) return playlistId;
    const created = await api.createPlaylist(DEFAULT_LIST_NAME);
    setPlaylistId(created.id);
    return created.id;
  }, [playlistId]);

  // Convierte un item de la biblioteca al shape que usa la vista (PlaylistItemRead).
  const toSlim = (item) => ({
    item_id: item.id,
    position: 0,
    added_at: new Date().toISOString(),
    item: {
      id: item.id,
      name: item.name,
      mime_type: item.mime_type,
      is_folder: false,
      size: item.size ?? null,
      modified_time: item.modified_time ?? null,
      path: item.path ?? null,
      is_premium: !!item.is_premium,
    },
    item_name: item.name,
  });

  // Alterna un documento en «Mis Favoritos» con actualización OPTIMISTA: la UI
  // cambia al instante y, si el servidor falla, se reconcilia recargando.
  const toggle = useCallback(
    async (item) => {
      if (!isAuthenticated || !item || item.is_folder) return;
      const id = item.id;
      const wasFav = ids.has(id);

      setIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(id);
        else next.add(id);
        return next;
      });
      setItems((prev) =>
        wasFav ? prev.filter((it) => it.item_id !== id) : [toSlim(item), ...prev]
      );

      try {
        if (wasFav) {
          if (playlistId) await api.removeFromPlaylist(playlistId, id);
        } else {
          const pid = await ensureList();
          await api.addToPlaylist(pid, id);
        }
      } catch (e) {
        // 409 al añadir = ya estaba en la lista: se considera éxito.
        if (e && e.status === 409 && !wasFav) return;
        // Cualquier otro error: reconciliar con el servidor y propagar.
        load();
        throw e;
      }
    },
    [isAuthenticated, ids, playlistId, ensureList, load]
  );

  const value = useMemo(
    () => ({
      ready,
      loading,
      error,
      count: ids.size,
      ids,
      items,
      isFavorite,
      toggle,
      reload: load,
    }),
    [ready, loading, error, ids, items, isFavorite, toggle, load]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites debe usarse dentro de <FavoritesProvider>.');
  }
  return ctx;
}
