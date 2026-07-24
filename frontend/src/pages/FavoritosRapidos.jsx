import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Heart, Library, Lock } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';
import FavoriteButton from '../components/FavoriteButton.jsx';
import { fileType, timeAgo } from '../lib/fileType.js';

const CARD =
  'group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-sm ' +
  'transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-lift dark:hover:shadow-lift-dark';

function parentPathOf(path) {
  return (path || '').split('/').slice(0, -1).join(' › ');
}

// Favoritos rápidos: la misma lista «Mis Favoritos» que ya vive en el
// explorador principal (FavoritesContext -> /api/playlists, con RLS real en
// Supabase — no hace falta tabla ni endpoint nuevo), en su propia ruta y con
// el mismo lenguaje visual Tailwind del resto de herramientas del menú
// Perfil. Un favorito cuyo documento ya no está en el catálogo (borrado, o a
// mitad de sincronización) se muestra atenuado con el nombre guardado, igual
// que en FavoritesView.jsx — solo se puede quitar, no abrir.
export default function FavoritosRapidos() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { items, loading, ready, error } = useFavorites();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="settings">
      <div className="settings__panel fade-in max-w-[900px]">
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
            <h1 className="settings__title">Favoritos rápidos</h1>
            <p className="settings__subtitle">
              Los documentos que guardaste con el corazón, listos para retomar.
              {ready && !loading && items.length > 0 && ` · ${items.length} ${items.length === 1 ? 'favorito' : 'favoritos'}`}
            </p>
          </div>
        </header>

        {(!ready || loading) && <p className="settings__muted">Cargando…</p>}
        {ready && !loading && error && <p className="settings__error">{error}</p>}

        {ready && !loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2/40 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-sm">
              <Heart width={24} height={24} />
            </span>
            <p className="mt-2 text-base font-bold text-ink">Aún no tienes favoritos</p>
            <p className="max-w-xs text-sm text-ink-muted">
              Pulsa el corazón en cualquier documento de la biblioteca para guardarlo aquí.
            </p>
            <Link
              to="/app"
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-gradient px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-soft)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_var(--accent-soft)]"
            >
              Ir a la biblioteca
            </Link>
          </div>
        )}

        {ready && !loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((fav) => {
              if (!fav.item) {
                return (
                  <div key={fav.item_id} className="relative">
                    <div className={'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 opacity-60 shadow-sm'}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink-soft shadow-sm">
                        <FileText width={20} height={20} />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-bold text-ink-muted">{fav.item_name || 'Documento'}</div>
                        <div className="mt-0.5 text-xs text-danger">Ya no está disponible</div>
                      </div>
                    </div>
                    <FavoriteButton
                      item={{ id: fav.item_id, name: fav.item_name, is_folder: false }}
                      className="absolute right-3 top-3"
                    />
                  </div>
                );
              }

              const { label, color } = fileType(fav.item);
              const parent = parentPathOf(fav.item.path);

              return (
                <div key={fav.item_id} className="relative">
                  <Link to="/app" state={{ openFile: fav.item }} className={CARD + ' flex flex-col gap-3 p-4'}>
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[10px] font-black text-white shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {label}
                      </span>
                      {fav.item.is_premium && (
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--pro-weak)] text-[var(--pro-strong)]"
                          title="Contenido Pro"
                        >
                          <Lock width={12} height={12} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-bold text-ink" title={fav.item.name}>
                        {fav.item.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink-muted">{parent || 'PSICOTECA'}</div>
                    </div>
                    <div className="mt-auto text-xs text-ink-soft">Agregado {timeAgo(new Date(fav.added_at))}</div>
                  </Link>
                  <FavoriteButton item={fav.item} className="absolute right-3 top-3" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
