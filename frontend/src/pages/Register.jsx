import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';
import { User, Mail, Eye, EyeOff } from '../components/icons.jsx';

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/app', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!accepted) {
      setError('Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para crear tu cuenta.');
      return;
    }
    setSubmitting(true);
    try {
      const { needsConfirmation } = await register({ name, email, password });
      if (needsConfirmation) {
        // El proyecto exige confirmar el correo: informamos y no navegamos.
        setNotice(
          `Te enviamos un correo a ${email.trim()} para confirmar tu cuenta. ` +
            'Ábrelo y luego inicia sesión.'
        );
        setSubmitting(false);
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'No se pudo crear la cuenta.');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Únete a Psicoteca y organiza tu biblioteca clínica."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link className="link" to="/login">
            Iniciar sesión
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
        {notice && (
          <div className="auth__notice" role="status">
            {notice}
          </div>
        )}

        <label className="field">
          <span className="field__label">Nombre</span>
          <span className="field__control">
            <User className="field__icon" width={17} height={17} />
            <input
              className="field__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dra. Ana Herrera"
              autoComplete="name"
              autoFocus
              required
            />
          </span>
        </label>

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
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
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

        <label className="auth__consent">
          <input
            type="checkbox"
            className="auth__consent-check"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            He leído y acepto los{' '}
            <Link className="link" to="/terminos" target="_blank" rel="noreferrer">
              Términos y Condiciones
            </Link>{' '}
            y el{' '}
            <Link className="link" to="/privacidad" target="_blank" rel="noreferrer">
              Aviso de Privacidad
            </Link>
            .
          </span>
        </label>

        <button
          className="auth__submit"
          type="submit"
          disabled={submitting || !accepted}
        >
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}
