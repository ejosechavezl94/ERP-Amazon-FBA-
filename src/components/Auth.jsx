import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { KeyRound, Mail, User, LogIn, UserPlus } from 'lucide-react';

export default function Auth({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });
        if (signUpError) throw signUpError;
        setMessage('¡Registro exitoso! Por favor verifica tu correo electrónico o inicia sesión.');
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;
        if (data.session) {
          onAuthSuccess(data.session);
        }
      }
    } catch (err) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ 
            display: 'inline-flex', 
            padding: '12px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent-color)',
            marginBottom: '16px'
          }}>
            <KeyRound size={28} />
          </div>
          <h1 className="auth-title">FBA Portal</h1>
          <p className="auth-subtitle">
            {isSignUp ? 'Crea tu cuenta de administrador' : 'Ingresa a la consola corporativa'}
          </p>
        </div>

        {error && (
          <div className="alert-banner alert-banner-danger">
            {error}
          </div>
        )}

        {message && (
          <div className="alert-banner alert-banner-success">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Nombre Completo</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Juan Pérez" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ paddingLeft: '36px' }}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
              <input 
                type="email" 
                className="form-input" 
                placeholder="usuario@empresa.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '36px' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '36px' }}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '10px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Procesando...' : isSignUp ? (
              <>
                <UserPlus size={16} /> Crear cuenta
              </>
            ) : (
              <>
                <LogIn size={16} /> Iniciar Sesión
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {isSignUp ? '¿Ya tienes una cuenta?' : '¿No tienes cuenta?'}
          </span>{' '}
          <button 
            type="button" 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--accent-color)', 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage('');
            }}
          >
            {isSignUp ? 'Inicia sesión aquí' : 'Regístrate aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}
