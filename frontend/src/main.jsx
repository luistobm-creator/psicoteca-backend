import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@fontsource-variable/inter';
import App from './App.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
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
            {/* Cualquier ruta desconocida vuelve a la landing. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </FavoritesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
