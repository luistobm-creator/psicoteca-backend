import React, { Suspense, lazy } from 'react';
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
import AgendaDeCitas from './pages/AgendaDeCitas.jsx';
import DirectorioPacientes from './pages/DirectorioPacientes.jsx';
import NotasDeVoz from './pages/NotasDeVoz.jsx';
import TareasTerapeuticas from './pages/TareasTerapeuticas.jsx';
import ModoExamen from './pages/ModoExamen.jsx';
import TarjetasRepaso from './pages/TarjetasRepaso.jsx';
import FacturacionPagos from './pages/FacturacionPagos.jsx';
import ConfigurarConsultorio from './pages/ConfigurarConsultorio.jsx';
import PlantillasFormato from './pages/PlantillasFormato.jsx';
import ActividadBiblioteca from './pages/ActividadBiblioteca.jsx';
import SugerenciasBuzon from './pages/SugerenciasBuzon.jsx';
import Notificaciones from './pages/Notificaciones.jsx';
import ReferirColegas from './pages/ReferirColegas.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
// Recharts (~400 KB) solo se necesita en esta página — se carga aparte, no en
// el bundle principal, mismo criterio que PdfViewer.jsx con pdfjs-dist.
const EstadisticasConsultorio = lazy(() => import('./pages/EstadisticasConsultorio.jsx'));
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
            <Route path="/app/agenda" element={<AgendaDeCitas />} />
            <Route path="/app/pacientes" element={<DirectorioPacientes />} />
            <Route path="/app/notas-voz" element={<NotasDeVoz />} />
            <Route path="/app/tareas" element={<TareasTerapeuticas />} />
            <Route path="/app/modo-examen" element={<ModoExamen />} />
            <Route path="/app/tarjetas-repaso" element={<TarjetasRepaso />} />
            <Route path="/app/facturacion-consulta" element={<FacturacionPagos />} />
            <Route path="/app/consultorio/configurar" element={<ConfigurarConsultorio />} />
            <Route path="/app/plantillas" element={<PlantillasFormato />} />
            <Route path="/app/historial" element={<ActividadBiblioteca accion="vista" />} />
            <Route path="/app/descargas" element={<ActividadBiblioteca accion="descarga" />} />
            <Route path="/app/sugerencias" element={<SugerenciasBuzon />} />
            <Route path="/app/notificaciones" element={<Notificaciones />} />
            <Route path="/app/referidos" element={<ReferirColegas />} />
            <Route
              path="/app/consultorio/estadisticas"
              element={
                <Suspense fallback={null}>
                  <EstadisticasConsultorio />
                </Suspense>
              }
            />
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
