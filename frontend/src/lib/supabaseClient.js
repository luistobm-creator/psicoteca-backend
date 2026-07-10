// Cliente único de Supabase para toda la app.
//
// Las credenciales llegan por variables de entorno de Vite (prefijo VITE_),
// definidas en frontend/.env. La ANON KEY es pública (publishable): se puede
// incrustar en el bundle; la seguridad la dan las políticas RLS del proyecto.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Aviso claro en consola si faltan las variables (p. ej. build sin .env).
  console.error(
    '[Supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
      'Revisa el archivo frontend/.env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // guarda la sesión en localStorage
    autoRefreshToken: true, // renueva el token de acceso automáticamente
    detectSessionInUrl: true, // procesa enlaces de confirmación / OAuth
  },
});
