import { Link } from 'react-router-dom';
import { ArrowLeft, Layers, Library } from '../components/icons.jsx';

// Placeholder para herramientas del menú de Perfil que todavía no están
// construidas (agenda, mensajería, facturación de consulta, etc.). Puramente
// visual: sin datos ni lógica detrás, solo el aviso y el regreso al menú.
// Mismo marco de página que Settings.jsx/Perfil.jsx.
export default function ComingSoon({ title }) {
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

        <section className="settings__card comingsoon__card">
          <span className="comingsoon__icon">
            <Layers width={24} height={24} />
          </span>
          <h1 className="settings__title">{title}</h1>
          <p className="settings__subtitle">Estamos construyendo esta herramienta. Próximamente.</p>
        </section>
      </div>
    </div>
  );
}
