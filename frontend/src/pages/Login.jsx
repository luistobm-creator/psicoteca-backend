import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';
import { Mail, Eye, EyeOff } from '../components/icons.jsx';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión, no tiene sentido ver el login.
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Bienvenido de vuelta"
      subtitle="Inicia sesión para acceder a tu biblioteca clínica."
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link className="link" to="/register">
            Crear cuenta
          </Link>
        </>
      }
    >
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        {error && (
          <div className="auth__alert" role="alert">
            {error}
          </div>
        )}

        <label className="field">
          <span className="field__label">Correo electrónico</span>
          <span className="field__control">
            <Mail className="field__icon" width={17} height={17} />
            <input
              className="field__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              autoFocus
              required
            />
          </span>
        </label>

        <label className="field">
          <span className="field__label">Contraseña</span>
          <span className="field__control">
            <input
              className="field__input"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="field__toggle"
              onClick={() => setShowPass((v) => !v)}
              title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPass ? <EyeOff width={17} height={17} /> : <Eye width={17} height={17} />}
            </button>
          </span>
        </label>

        <button className="auth__submit" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  );
}
