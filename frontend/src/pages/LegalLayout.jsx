import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Library, Moon, Sun, ArrowLeft } from '../components/icons.jsx';

// Misma clave de tema que Landing/App (index.html la aplica antes de pintar).
const THEME_KEY = 'psicoteca-theme-v2';

// Resalta un dato pendiente de rellenar. Uso: <Ph>[CORREO_CONTACTO]</Ph>.
// Se pinta con un fondo de acento y borde punteado para que «salte a la vista»
// mientras el documento es un borrador.
export function Ph({ children }) {
  return <mark className="lp-ph">{children}</mark>;
}

// Marco visual compartido por las páginas legales (Términos, Privacidad…).
// Reutiliza el nav/footer y los tokens de la landing para que se sientan parte
// del producto. `title` fija además el <title> de la pestaña (la SPA no lo
// cambia solo al navegar entre rutas). `eyebrow` + `icon` es la etiqueta que va
// sobre el título; `updated` es la fecha de última actualización.
export default function LegalLayout({ title, updated, eyebrow, icon: Icon, children }) {
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

  useEffect(() => {
    const prev = document.title;
    if (title) document.title = `${title} · Psicoteca`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  return (
    <div className="lp">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="lp-nav">
        <div className="lp-container lp-nav__inner">
          <Link to="/" className="lp-brand" aria-label="Psicoteca, inicio">
            <span className="lp-brand__logo">
              <Library width={22} height={22} />
            </span>
            <span className="lp-brand__text">Psicoteca</span>
          </Link>

          <div className="lp-nav__actions">
            <button
              type="button"
              className="lp-iconbtn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun width={18} height={18} /> : <Moon width={18} height={18} />}
            </button>
            <Link to="/" className="lp-btn lp-btn--ghost">
              <ArrowLeft width={16} height={16} />
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ Contenido */}
      <main className="lp-legal">
        <article className="lp-legal__wrap">
          <header className="lp-legal__head">
            {eyebrow && (
              <span className="lp-legal__eyebrow">
                {Icon && <Icon width={14} height={14} />}
                {eyebrow}
              </span>
            )}
            <h1 className="lp-legal__title">{title}</h1>
            {updated && (
              <p className="lp-legal__meta">Última actualización: {updated}</p>
            )}
          </header>

          {children}
        </article>
      </main>

      {/* ------------------------------------------------------------- Footer */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__inner">
          <div className="lp-footer__brand">
            <span className="lp-brand__logo">
              <Library width={20} height={20} />
            </span>
            <div>
              <div className="lp-footer__name">Psicoteca</div>
              <div className="lp-footer__tag">Espacio de estudio clínico</div>
            </div>
          </div>
          <nav className="lp-footer__links" aria-label="Enlaces">
            <Link to="/app">Explorar la biblioteca</Link>
            <Link to="/terminos">Términos y Condiciones</Link>
            <Link to="/privacidad">Aviso de Privacidad</Link>
          </nav>
        </div>
        <div className="lp-footer__legal">
          © {new Date().getFullYear()} Psicoteca · Hecho para estudiantes de psicología
        </div>
      </footer>
    </div>
  );
}
