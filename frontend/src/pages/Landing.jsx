import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Library,
  Search,
  BookOpen,
  Download,
  Moon,
  Sun,
  Check,
  Crown,
  Sparkles,
  GraduationCap,
  FlaskConical,
  ChevronRight,
} from '../components/icons.jsx';

// Misma clave de tema que usa App.jsx (index.html la aplica antes de pintar).
const THEME_KEY = 'psicoteca-theme-v2';

// Contenido declarativo (facilita editar los textos sin tocar el maquetado).
const FEATURES = [
  {
    icon: Library,
    title: 'Biblioteca curada',
    text: 'Cientos de colecciones de libros y material clínico, organizadas por tema para que encuentres lo que buscas.',
  },
  {
    icon: Search,
    title: 'Buscador instantáneo',
    text: 'Escribe una palabra y aparece el documento — busca por nombre y por ruta, con resultados mientras escribes.',
  },
  {
    icon: BookOpen,
    title: 'Visor integrado',
    text: 'Lee los PDFs sin salir de la página, en la compu o en el celular. Sin descargas ni saltos a Drive.',
  },
  {
    icon: Download,
    title: 'Online y offline',
    text: 'Léelo al instante en el visor; con Pro, descarga sin límite los PDFs a tu dispositivo para estudiar sin conexión.',
  },
  {
    icon: Moon,
    title: 'Claro u oscuro',
    text: 'Cambia de tema y se recuerda. Cómodo para sesiones largas de estudio, de día o de noche.',
  },
  {
    icon: GraduationCap,
    title: 'Pensada para estudiar',
    text: 'Un espacio sereno y sin distracciones, hecho para estudiantes y futuros profesionales de la psicología.',
  },
];

const FAQS = [
  {
    q: '¿Qué es Psicoteca?',
    a: 'Una biblioteca digital de psicología: libros, manuales y pruebas reunidos y organizados para que estudiar sea más fácil.',
  },
  {
    q: '¿De verdad es gratis?',
    a: 'Sí. Creas tu cuenta gratis y exploras toda la biblioteca general. El plan Pro desbloquea las colecciones especializadas y las descargas.',
  },
  {
    q: '¿Qué incluye el plan Pro?',
    a: 'Más de 10,000 recursos clínicos y herramientas: el DSM-5, pruebas psicométricas y material de EMDR y Brainspotting, además de colecciones complementarias (como biodescodificación y bioneuroemoción) y descargas ilimitadas de PDFs.',
  },
  {
    q: '¿Funciona en el celular?',
    a: 'Sí, con visor integrado para leer desde donde estés, en cualquier dispositivo.',
  },
  {
    q: '¿Necesito tarjeta para empezar?',
    a: 'No. La cuenta gratis no pide tarjeta: te registras y empiezas a explorar.',
  },
  {
    q: '¿Puedo cancelar Pro cuando quiera?',
    a: 'Claro. La suscripción es sin ataduras y la cancelas cuando quieras.',
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();

  // Tema claro/oscuro (mismo comportamiento que el explorador).
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

            {isAuthenticated ? (
              <Link to="/app" className="lp-btn lp-btn--primary">
                Entrar a la biblioteca
              </Link>
            ) : (
              <>
                <Link to="/login" className="lp-btn lp-btn--ghost lp-nav__login">
                  Iniciar sesión
                </Link>
                <Link to="/register" className="lp-btn lp-btn--primary">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------------------- Hero */}
        <section className="lp-hero">
          <div className="lp-container lp-hero__inner">
            <span className="lp-eyebrow">Tu biblioteca de psicología, en un solo lugar</span>
            <h1 className="lp-hero__title">
              Estudia psicología sin perderte entre carpetas y PDFs sueltos.
            </h1>
            <p className="lp-hero__lead">
              Miles de libros, manuales y pruebas reunidos, organizados y{' '}
              <strong>buscables al instante</strong>. Encuentra lo que necesitas en
              segundos y ponte a estudiar.
            </p>

            <div className="lp-hero__cta">
              {isAuthenticated ? (
                <Link to="/app" className="lp-btn lp-btn--primary lp-btn--lg">
                  Entrar a la biblioteca <ChevronRight width={18} height={18} />
                </Link>
              ) : (
                <>
                  <Link to="/register" className="lp-btn lp-btn--primary lp-btn--lg">
                    Crear cuenta gratis <ChevronRight width={18} height={18} />
                  </Link>
                  <Link to="/app" className="lp-btn lp-btn--ghost lp-btn--lg">
                    Explorar la biblioteca
                  </Link>
                </>
              )}
            </div>

            {!isAuthenticated && (
              <p className="lp-hero__note">Gratis para empezar. Sin tarjeta.</p>
            )}

            <ul className="lp-trust" aria-label="Lo que ofrece Psicoteca">
              <li>Más de 10,000 recursos clínicos</li>
              <li>Búsqueda instantánea</li>
              <li>Lee en cualquier dispositivo</li>
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------- Features */}
        <section className="lp-section" id="caracteristicas">
          <div className="lp-container">
            <div className="lp-section__head">
              <h2 className="lp-section__title">Todo lo que necesitas para estudiar</h2>
              <p className="lp-section__sub">
                Una biblioteca pensada para que dediques tu tiempo a aprender, no a
                buscar.
              </p>
            </div>

            <div className="lp-features">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article className="lp-feature" key={title}>
                  <span className="lp-feature__icon" aria-hidden="true">
                    <Icon width={20} height={20} />
                  </span>
                  <h3 className="lp-feature__title">{title}</h3>
                  <p className="lp-feature__text">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- Pricing */}
        <section className="lp-section lp-section--muted" id="planes">
          <div className="lp-container">
            <div className="lp-section__head">
              <h2 className="lp-section__title">Empieza gratis, mejora cuando quieras</h2>
              <p className="lp-section__sub">
                El plan gratis ya te da mucho. Pro desbloquea las colecciones
                especializadas y las descargas.
              </p>
            </div>

            <div className="lp-plans">
              {/* Free */}
              <article className="lp-plan">
                <header className="lp-plan__head">
                  <h3 className="lp-plan__name">Gratis</h3>
                  <div className="lp-plan__price">
                    <span className="lp-plan__amount">$0</span>
                  </div>
                  <p className="lp-plan__tag">Para empezar a explorar</p>
                </header>
                <ul className="lp-plan__list">
                  <li><Check width={17} height={17} /> Acceso a la biblioteca general</li>
                  <li><Check width={17} height={17} /> Buscador instantáneo</li>
                  <li><Check width={17} height={17} /> Lectura online de PDFs</li>
                  <li><Check width={17} height={17} /> Tema claro y oscuro</li>
                </ul>
                <Link to="/register" className="lp-btn lp-btn--ghost lp-btn--block">
                  Crear cuenta gratis
                </Link>
              </article>

              {/* Pro */}
              <article className="lp-plan lp-plan--pro">
                <span className="lp-plan__badge">
                  <Crown width={13} height={13} /> Recomendado
                </span>
                <header className="lp-plan__head">
                  <h3 className="lp-plan__name">Pro</h3>
                  <div className="lp-plan__price">
                    <span className="lp-plan__amount">$199</span>
                    <span className="lp-plan__period">MXN / año</span>
                  </div>
                  <p className="lp-plan__tag">
                    Equivale a solo <strong>$16.50 al mes</strong> · o $39 MXN mensual
                  </p>
                </header>
                <ul className="lp-plan__list">
                  <li><Check width={17} height={17} /> Todo lo del plan gratis</li>
                  <li>
                    <Check width={17} height={17} />{' '}
                    <strong>Más de 10,000 recursos clínicos y herramientas</strong>
                  </li>
                  <li>
                    <Check width={17} height={17} /> Colecciones exclusivas: DSM-5,
                    pruebas psicométricas y EMDR
                  </li>
                  <li>
                    <Check width={17} height={17} />{' '}
                    <strong>Descargas ilimitadas de PDFs</strong> a tu dispositivo
                  </li>
                </ul>
                <Link to={isAuthenticated ? '/app' : '/register'} className="lp-btn lp-btn--pro lp-btn--block">
                  <Sparkles width={16} height={16} />
                  Mejorar a Pro
                </Link>
                <p className="lp-plan__fine">Cancela cuando quieras.</p>
              </article>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ About + FAQ */}
        <section className="lp-section" id="sobre">
          <div className="lp-container lp-about">
            <div className="lp-about__intro">
              <span className="lp-feature__icon" aria-hidden="true">
                <FlaskConical width={20} height={20} />
              </span>
              <h2 className="lp-section__title">Sobre el proyecto</h2>
              <p className="lp-about__text">
                Psicoteca nació de una idea simple: estudiar psicología no debería
                significar perder horas buscando entre carpetas desordenadas y archivos
                sueltos. Reunimos y organizamos material clínico en un espacio sereno,
                pensado para concentrarse, para que estudiantes y futuros profesionales
                tengan todo a la mano.
              </p>
            </div>

            <div className="lp-faq">
              <h3 className="lp-faq__title">Preguntas frecuentes</h3>
              {FAQS.map(({ q, a }) => (
                <details className="lp-faq__item" key={q}>
                  <summary className="lp-faq__q">
                    {q}
                    <ChevronRight className="lp-faq__chev" width={16} height={16} />
                  </summary>
                  <p className="lp-faq__a">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- CTA final */}
        {!isAuthenticated && (
          <section className="lp-final">
            <div className="lp-container lp-final__inner">
              <h2 className="lp-final__title">Tu biblioteca de psicología te espera</h2>
              <p className="lp-final__sub">Crea tu cuenta gratis y empieza a estudiar hoy.</p>
              <Link to="/register" className="lp-btn lp-btn--primary lp-btn--lg">
                Crear cuenta gratis <ChevronRight width={18} height={18} />
              </Link>
            </div>
          </section>
        )}
      </main>

      {/* -------------------------------------------------------------- Footer */}
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
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/register">Crear cuenta</Link>
          </nav>
        </div>
        <div className="lp-footer__legal">
          © {new Date().getFullYear()} Psicoteca · Hecho para estudiantes de psicología
        </div>
      </footer>
    </div>
  );
}
