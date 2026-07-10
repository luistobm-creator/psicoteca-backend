import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El frontend siempre llama a rutas relativas '/api/...'. En desarrollo, Vite
// actúa de proxy hacia el backend FastAPI, así se evita CORS y se unifica el
// origen (el navegador cree que todo viene de http://localhost:5173).
//
// Para producción se puede definir VITE_API_BASE, o servir el build detrás del
// mismo origen que la API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
