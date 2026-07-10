import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api.js';
import Sidebar from './components/Sidebar.jsx';
import Breadcrumb from './components/Breadcrumb.jsx';
import FileGrid from './components/FileGrid.jsx';
import SearchResults from './components/SearchResults.jsx';
import Pagination from './components/Pagination.jsx';
import Dashboard from './components/Dashboard.jsx';
import ReaderPanel from './components/ReaderPanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import UserMenu from './components/UserMenu.jsx';
import UpgradeModal from './components/UpgradeModal.jsx';
import { Sun, Moon, Library } from './components/icons.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

const PAGE_SIZE = 60;
const SEARCH_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;
const THEME_KEY = 'psicoteca-theme-v2';
const RECENTS_KEY = 'psicoteca-recents-v1';
const RECENTS_MAX = 6;

// Recorre el árbol una vez y devuelve índices por id: el nodo y su padre.
function indexTree(roots) {
  const byId = {};
  const parentOf = {};
  const walk = (node, parentId) => {
    byId[node.id] = node;
    parentOf[node.id] = parentId;
    (node.children || []).forEach((child) => walk(child, node.id));
  };
  (roots || []).forEach((root) => walk(root, null));
  return { byId, parentOf };
}

export default function App() {
  // --- Tema (claro por defecto) ---
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [theme]);

  // --- Sesión de usuario (estado global vía AuthContext) ---
  const { isAuthenticated, plan, loading: authLoading, refreshUser } = useAuth();

  // Al volver de Stripe Checkout (?checkout=success) refrescamos la sesión para
  // reflejar el plan Pro que el webhook acaba de activar, y limpiamos la URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;
    if (checkout === 'success') refreshUser();
    params.delete('checkout');
    const qs = params.toString();
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (qs ? `?${qs}` : '')
    );
  }, [refreshUser]);

  // --- Documentos recientes (accesos rápidos), persistidos en el navegador ---
  const [recents, setRecents] = useState(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  // --- Árbol y estadísticas ---
  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const { byId, parentOf } = useMemo(() => indexTree(tree), [tree]);

  // --- Navegación / selección ---
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  // --- Contenido de la carpeta ---
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState(null);

  // --- Lector (panel derecho) ---
  const [openFile, setOpenFile] = useState(null);

  // Abre un archivo en el lector y lo registra en "accesos rápidos".
  const openFileInReader = useCallback((file) => {
    setOpenFile(file);
    if (!file || file.is_folder) return;
    setRecents((prev) => {
      const slim = {
        id: file.id,
        name: file.name,
        mime_type: file.mime_type,
        size: file.size,
        modified_time: file.modified_time,
        path: file.path,
        is_premium: file.is_premium,
      };
      const next = [slim, ...prev.filter((r) => r.id !== file.id)].slice(0, RECENTS_MAX);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* almacenamiento no disponible */
      }
      return next;
    });
  }, []);

  // --- Búsqueda ---
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchSeq = useRef(0);
  const searchInputRef = useRef(null);
  const searchMode = searchValue.trim().length > 0;

  // Atajo de teclado: Ctrl/Cmd + K enfoca la búsqueda global.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cargar árbol + stats al montar. NO se autoselecciona carpeta: se muestra
  // el Dashboard. Sí se expande la raíz para ver las categorías en el árbol.
  useEffect(() => {
    let cancelled = false;
    setTreeLoading(true);
    api
      .getTree()
      .then((roots) => {
        if (cancelled) return;
        setTree(roots);
        setTreeError(null);
        if (roots.length) setExpanded(new Set([roots[0].id]));
      })
      .catch((e) => {
        if (!cancelled) setTreeError(e.message);
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });

    api
      .getStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        /* el dashboard tolera stats vacías */
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Cargar contenido cuando cambia la carpeta o la página.
  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    setItemsLoading(true);
    api
      .getFolderItems(selectedId, { page, pageSize: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setPagination(data.pagination);
        setItemsError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setItemsError(e.message);
        setItems([]);
        setPagination(null);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, page]);

  // Búsqueda con debounce + guarda contra respuestas fuera de orden.
  useEffect(() => {
    const q = searchValue.trim();
    if (!q) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchError(null);
      setSearchLoading(false);
      return undefined;
    }
    const seq = ++searchSeq.current;
    setSearchLoading(true);
    const handle = setTimeout(() => {
      api
        .search(q, { limit: SEARCH_LIMIT, offset: 0 })
        .then((data) => {
          if (seq !== searchSeq.current) return;
          setSearchResults(data.items);
          setSearchTotal(data.total);
          setSearchError(null);
        })
        .catch((e) => {
          if (seq !== searchSeq.current) return;
          setSearchError(e.message);
          setSearchResults([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearchLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchValue]);

  // --- Acciones ---
  const revealFolder = useCallback(
    (id) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        let cur = id;
        while (cur != null) {
          next.add(cur);
          cur = parentOf[cur];
        }
        return next;
      });
    },
    [parentOf]
  );

  const selectFolder = useCallback(
    (nodeOrId) => {
      const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
      setSearchValue('');
      setSelectedId(id);
      setPage(1);
      revealFolder(id);
    },
    [revealFolder]
  );

  // --- Gating visual: interceptar clics en contenido Pro (usuarios no-Pro) ---
  // El item que disparó el modal de upgrade (null = modal cerrado).
  const [upgradeItem, setUpgradeItem] = useState(null);

  const handleOpenFolder = useCallback(
    (nodeOrId) => {
      // Puede llegar un id (breadcrumb / navegación ya autorizada) o un objeto
      // (clic del usuario). Solo bloqueamos objetos Pro para usuarios no-Pro.
      if (
        nodeOrId &&
        typeof nodeOrId === 'object' &&
        nodeOrId.is_premium &&
        plan !== 'pro'
      ) {
        setUpgradeItem(nodeOrId);
        return;
      }
      selectFolder(nodeOrId);
    },
    [plan, selectFolder]
  );

  const handleOpenFile = useCallback(
    (file) => {
      if (file?.is_premium && plan !== 'pro') {
        setUpgradeItem(file);
        return;
      }
      openFileInReader(file);
    },
    [plan, openFileInReader]
  );

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const goHome = useCallback(() => {
    setSearchValue('');
    setSelectedId(null);
    setOpenFile(null);
  }, []);

  // Breadcrumb: raíz -> carpeta seleccionada.
  const trail = useMemo(() => {
    if (!selectedId) return [];
    const chain = [];
    let cur = selectedId;
    while (cur != null && byId[cur]) {
      chain.unshift(byId[cur]);
      cur = parentOf[cur];
    }
    return chain;
  }, [selectedId, byId, parentOf]);

  const selectedFolder = selectedId ? byId[selectedId] : null;
  const topFolders = tree[0]?.children || [];
  const readerOpen = !!openFile;

  // Qué se muestra en el panel central.
  const centerView = searchMode ? 'search' : selectedId ? 'folder' : 'dashboard';

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="topbar__brand" onClick={goHome} title="Ir al inicio">
          <span className="topbar__logo">
            <Library width={22} height={22} />
          </span>
          <span className="topbar__brandtext">
            <span className="topbar__title">Psicoteca</span>
            <span className="topbar__subtitle">Espacio de estudio clínico</span>
          </span>
        </button>

        <div className="topbar__search">
          <SearchBar
            value={searchValue}
            onChange={setSearchValue}
            onClear={() => setSearchValue('')}
            inputRef={searchInputRef}
            className="searchbar--hero"
            placeholder="Buscar documentos, carpetas o temas…"
            showHint
          />
        </div>

        <div className="topbar__actions">
          <button
            type="button"
            className="iconbtn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? <Sun width={18} height={18} /> : <Moon width={18} height={18} />}
          </button>
          {authLoading ? (
            <span className="topbar__authskel skeleton" aria-hidden="true" />
          ) : isAuthenticated ? (
            <UserMenu />
          ) : (
            <nav className="topbar__auth" aria-label="Cuenta">
              <Link to="/login" className="authbtn">
                Iniciar sesión
              </Link>
              <Link to="/register" className="authbtn authbtn--primary">
                Crear cuenta
              </Link>
            </nav>
          )}
        </div>
      </header>

      <div className="workspace" data-reader={readerOpen ? 'open' : 'closed'}>
        <Sidebar
          tree={tree}
          loading={treeLoading}
          error={treeError}
          selectedId={selectedId}
          expanded={expanded}
          plan={plan}
          onToggle={toggleExpand}
          onSelect={handleOpenFolder}
        />

        <section className="center">
          {centerView === 'dashboard' && (
            <div className="center__scroll">
              <Dashboard
                stats={stats}
                statsLoading={statsLoading}
                treeLoading={treeLoading}
                topFolders={topFolders}
                recents={recents}
                plan={plan}
                onOpenFolder={handleOpenFolder}
                onOpenFile={handleOpenFile}
              />
            </div>
          )}

          {centerView === 'search' && (
            <>
              <div className="center__header">
                <div className="center__title">
                  Resultados
                  {!searchLoading && (
                    <span className="center__count">
                      {searchTotal} coincidencia{searchTotal === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="center__hint">para «{searchValue.trim()}»</div>
              </div>
              <div className="center__scroll">
                <SearchResults
                  results={searchResults}
                  total={searchTotal}
                  loading={searchLoading}
                  error={searchError}
                  activeId={openFile?.id}
                  plan={plan}
                  onOpenFolder={handleOpenFolder}
                  onOpenFile={handleOpenFile}
                />
              </div>
            </>
          )}

          {centerView === 'folder' && (
            <>
              <div className="center__header">
                <Breadcrumb trail={trail} onNavigate={selectFolder} />
                {pagination && (
                  <span className="center__count">
                    {pagination.total} elemento{pagination.total === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="center__scroll">
                <FileGrid
                  items={items}
                  loading={itemsLoading}
                  error={itemsError}
                  activeId={openFile?.id}
                  compact={readerOpen}
                  plan={plan}
                  emptyText={
                    selectedFolder ? 'Esta carpeta está vacía.' : 'Selecciona una carpeta.'
                  }
                  onOpenFolder={handleOpenFolder}
                  onOpenFile={handleOpenFile}
                />
              </div>
              {pagination && pagination.total_pages > 1 && (
                <div className="center__footer">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.total_pages}
                    total={pagination.total}
                    onPage={setPage}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {readerOpen && <ReaderPanel file={openFile} onClose={() => setOpenFile(null)} />}
      </div>

      {upgradeItem && (
        <UpgradeModal item={upgradeItem} onClose={() => setUpgradeItem(null)} />
      )}
    </div>
  );
}
