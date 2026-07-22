import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@fontsource-variable/inter';
import App from './App.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Settings from './pages/Settings.jsx';
import Terminos from './pages/Terminos.jsx';
import Privacidad from './pages/Privacidad.jsx';
import Perfil from './pages/Perfil.jsx';
import GlosarioClinico from './pages/GlosarioClinico.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import { COMING_SOON_ROUTES } from './lib/profileMenu.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FavoritesProvider>
          <Routes>
            {/* `/` = landing (marketing); el explorador vive en `/app`. */}
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<App />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/configuracion" element={<Settings />} />
            {/* Páginas legales (contenido estático, mismo marco que la landing). */}
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            {/* Menú de Perfil (Estudio/Progreso/Consultorio/Comunidad/Biblioteca/Cuenta). */}
            <Route path="/app/perfil" element={<Perfil />} />
            <Route path="/app/glosario" element={<GlosarioClinico />} />
            {/* Herramientas del menú que todavía no están construidas: solo UI. */}
            {COMING_SOON_ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={<ComingSoon title={r.title} />} />
            ))}
            {/* Cualquier ruta desconocida vuelve a la landing. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
