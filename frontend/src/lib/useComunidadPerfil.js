import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import * as api from '../api.js';

// Mi propio perfil de Comunidad (opt-in). Compartido por Mensajes, Grupos y
// Ranking — las 3 pantallas necesitan saber si ya está activo antes de
// dejar participar.
export function useComunidadPerfil() {
  const { isAuthenticated } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    api
      .getMiPerfilComunidad()
      .then(setPerfil)
      .catch(() => setPerfil(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { perfil, loading, refresh };
}
