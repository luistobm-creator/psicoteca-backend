import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabaseClient.js';

// ============================================================================
// AuthContext · sesión de usuario con Supabase Auth
// ============================================================================
// La sesión se restaura con supabase.auth.getSession() al cargar y se mantiene
// sincronizada con onAuthStateChange (login, logout, refresh de token y otras
// pestañas). La persistencia la gestiona el propio cliente de Supabase
// (localStorage), no este componente.
//
// Nota sobre el plan (free/pro): el plan de PAGO lo fija el webhook de Stripe en
// app_metadata (controlado por el servidor, NO editable por el usuario). El
// toggle de desarrollo (setPlan/togglePlan) sigue escribiendo en user_metadata;
// mapSupabaseUser considera Pro si cualquiera de los dos lo indica.
// ============================================================================

export const AuthContext = createContext(null);

// Iniciales para el avatar a partir del nombre (o del email si no hay nombre).
function initialsFrom(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]).join('');
  return (chars || String(name || '?').slice(0, 2)).toUpperCase();
}

// Traduce el objeto `user` de Supabase a la forma que consume la UI.
function mapSupabaseUser(u) {
  if (!u) return null;
  const meta = u.user_metadata || {};
  const appMeta = u.app_metadata || {};
  const name =
    meta.name || meta.full_name || (u.email ? u.email.split('@')[0] : 'Usuario');
  // Fuente de verdad del plan de PAGO: app_metadata, que solo puede escribir el
  // servidor (el webhook de Stripe). Se mantiene el respaldo en user_metadata
  // para el toggle de desarrollo (togglePlan/setPlan).
  const isPro = appMeta.plan === 'pro' || meta.plan === 'pro';
  return {
    id: u.id,
    name,
    email: u.email || '',
    initials: initialsFrom(name),
    plan: isPro ? 'pro' : 'free',
  };
}

// Mensajes de error de Supabase (en inglés) -> español para la UI.
function translateAuthError(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Ya existe una cuenta con este correo.';
  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Introduce un correo electrónico válido.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'No se pudo conectar con el servidor de autenticación.';
  return message || 'Ha ocurrido un error. Inténtalo de nuevo.';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // restaurando sesión inicial

  useEffect(() => {
    let active = true;

    // 1) Restaurar la sesión actual al cargar (persistencia de sesión).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUser(mapSupabaseUser(data.session?.user ?? null));
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    // 2) Mantener el estado sincronizado con cualquier cambio de sesión.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUser(session?.user ?? null));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: (email || '').trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(translateAuthError(error.message));
    // onAuthStateChange también actualizará el estado; lo hacemos aquí para
    // que el efecto de redirección de la vista de login reaccione de inmediato.
    setUser(mapSupabaseUser(data.user));
    return data.user;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email: (email || '').trim().toLowerCase(),
      password,
      options: { data: { name: (name || '').trim() } },
    });
    if (error) throw new Error(translateAuthError(error.message));

    // Si el proyecto exige confirmación por email, signUp devuelve el usuario
    // pero SIN sesión: aún no está autenticado hasta que confirme el correo.
    const needsConfirmation = !data.session;
    if (data.session) setUser(mapSupabaseUser(data.user));
    return { user: data.user, needsConfirmation };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Refresca la sesión desde el servidor para reflejar cambios de plan hechos por
  // el webhook de Stripe (app_metadata viaja dentro del JWT: una sesión ya activa
  // no "ve" el cambio hasta renovar el token). Se usa al volver de Checkout.
  const refreshUser = useCallback(async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return;
    setUser(mapSupabaseUser(data.user ?? data.session?.user ?? null));
  }, []);

  // Cambia el plan y lo persiste en Supabase (user_metadata). Simulación de
  // upgrade hasta integrar Stripe (ver nota de cabecera).
  const setPlan = useCallback(async (plan) => {
    const normalized = plan === 'pro' ? 'pro' : 'free';
    const { data, error } = await supabase.auth.updateUser({
      data: { plan: normalized },
    });
    if (error) throw new Error(translateAuthError(error.message));
    setUser(mapSupabaseUser(data.user));
  }, []);

  const togglePlan = useCallback(async () => {
    if (!user) return;
    await setPlan(user.plan === 'pro' ? 'free' : 'pro');
  }, [user, setPlan]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      plan: user?.plan ?? 'free',
      loading,
      login,
      register,
      logout,
      refreshUser,
      setPlan,
      togglePlan,
    }),
    [user, loading, login, register, logout, refreshUser, setPlan, togglePlan]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return ctx;
}
