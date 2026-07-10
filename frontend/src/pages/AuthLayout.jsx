import { Link } from 'react-router-dom';
import { Library, ArrowLeft } from '../components/icons.jsx';

// Marco visual compartido por Login y Register: fondo sereno, tarjeta central
// con la marca Psicoteca y un enlace para volver a la biblioteca. Mantiene la
// estética limpia y minimalista del resto de la app.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__panel fade-in">
        <div className="auth__card">
          <Link to="/" className="auth__brand" title="Ir a la biblioteca">
            <span className="auth__logo">
              <Library width={22} height={22} />
            </span>
            <span className="auth__brandtext">Psicoteca</span>
          </Link>

          <h1 className="auth__title">{title}</h1>
          {subtitle && <p className="auth__subtitle">{subtitle}</p>}

          {children}
        </div>

        {footer && <div className="auth__footer">{footer}</div>}

        <Link to="/" className="auth__back">
          <ArrowLeft width={15} height={15} />
          Volver a la biblioteca
        </Link>
      </div>
    </div>
  );
}
