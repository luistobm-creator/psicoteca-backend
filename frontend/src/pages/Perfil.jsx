import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Crown, Library } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PROFILE_MENU } from '../lib/profileMenu.js';

// Hub de navegación "Perfil": agrupa Estudio / Progreso / Consultorio /
// Comunidad / Biblioteca / Cuenta, tal como el diseño fuente (Psicoteca App
// iOS). Fase de solo UI: las filas sin herramienta real todavía caen en la
// página "Próximamente" (ver main.jsx); las que ya existen (Ajustes,
// Suscripción) van a sus rutas reales. Mismo patrón de página protegida que
// Settings.jsx (redirige a /login sin sesión).
export default function Perfil() {
  const { user, plan, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const isPro = plan === 'pro';

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  if (loading || !user) return null;

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
          <Link to="/app" className="settings__back">
            <ArrowLeft width={15} height={15} />
            Volver a la biblioteca
          </Link>
        </div>

        <header className="settings__head">
          <h1 className="settings__title">Perfil</h1>
          <p className="settings__subtitle">Tu cuenta y todas tus herramientas, en un lugar.</p>
        </header>

        <div className="profile-menu__head">
          <span className="profile-menu__avatar">{user.initials}</span>
          <div className="profile-menu__id">
            <div className="profile-menu__name">{user.name}</div>
            <div className="profile-menu__email">{user.email}</div>
          </div>
          <Link to="/app/editar-perfil" className="profile-menu__edit">
            Editar
          </Link>
        </div>

        <Link to="/configuracion" className={'profile-menu__plan profile-menu__plan--' + (isPro ? 'pro' : 'free')}>
          <div className="profile-menu__plan-head">
            {isPro && <Crown width={15} height={15} />}
            <span>{isPro ? 'Psicoteca Pro activo' : 'Plan gratuito'}</span>
          </div>
          <div className="profile-menu__plan-note">
            {isPro ? 'Gestiona tu plan y facturación' : 'Desbloquea la biblioteca clínica completa →'}
          </div>
        </Link>

        <Link to="/app/perfil-publico" className="profile-menu__row profile-menu__row--standalone">
          <Library width={18} height={18} />
          <span className="profile-menu__rowlabel">Ver perfil público</span>
          <ChevronRight width={16} height={16} />
        </Link>

        {PROFILE_MENU.map((section) => (
          <div key={section.title} className="profile-menu__section">
            <div className="profile-menu__sectiontitle">{section.title}</div>
            <div className="profile-menu__card">
              {section.rows.map((row) => (
                <Link key={row.to + row.label} to={row.to} className="profile-menu__row">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={row.iconPath} />
                  </svg>
                  <span className="profile-menu__rowlabel">{row.label}</span>
                  <ChevronRight width={16} height={16} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
