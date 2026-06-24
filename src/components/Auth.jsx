import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from './ui/Dialog';

// --- HELPER COMPONENTS (ICONS) ---

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const GlassInputWrapper = ({ children }) => (
  <div className="glass-input-wrapper">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }) => (
  <div className={`signin-testimonial-card animate-element ${delay}`}>
    <img src={testimonial.avatarSrc} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }} alt="avatar" />
    <div style={{ fontSize: '0.85rem', lineHeight: '1.3' }}>
      <p style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>{testimonial.name}</p>
      <p style={{ color: 'var(--text-tertiary)', margin: '2px 0 0 0', fontSize: '0.75rem' }}>{testimonial.handle}</p>
      <p style={{ marginTop: '8px', color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>{testimonial.text}</p>
    </div>
  </div>
);

export default function Auth({ onAuthSuccess }) {
  const isSignUp = false;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // MFA / 2FA states
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');

  const defaultHeroImage = "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80";
  const defaultTestimonials = [
    {
      avatarSrc: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
      name: "Sofía Rodríguez",
      handle: "@sofia_fba",
      text: "Esta plataforma transformó la gestión de inventario y pedidos de nuestra tienda de Amazon. Imprescindible para escalar."
    },
    {
      avatarSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
      name: "Alejandro Gómez",
      handle: "@alegomez_dev",
      text: "El tablero Kanban y la automatización de lotes/llegadas nos ahorran más de 10 horas de trabajo manual a la semana."
    }
  ];

  const handleAuth = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    setLoading(true);
    console.log("handleAuth started. isSignUp:", isSignUp, "email:", email);

    try {
      if (isSignUp) {
        console.log("Attempting signUp...");
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
        console.log("signUp success:", data);
        setMessage('¡Registro exitoso! Por favor verifica tu correo electrónico o inicia sesión.');
      } else {
        console.log("Attempting signInWithPassword...");
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        console.log("signInWithPassword resolved. Data:", !!data, "Error:", signInError);
        if (signInError) throw signInError;
        
        if (data && data.session) {
          console.log("Session exists in signIn response. Checking MFA...");
          const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          console.log("MFA assurance level checked. Data:", assurance, "Error:", assuranceError);
          if (assuranceError) throw assuranceError;

          if (assurance && assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
            console.log("MFA is required (aal2 next, not currently aal2). Listing factors...");
            const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
            console.log("Factors listed. Data:", factors, "Error:", factorsError);
            if (factorsError) throw factorsError;

            const verifiedFactor = factors && factors.all ? factors.all.find(f => f.status === 'verified') : null;
            console.log("Verified factor found:", verifiedFactor);
            if (verifiedFactor) {
              console.log("Setting MFA state and showing MFA screen...");
              setMfaFactorId(verifiedFactor.id);
              setShowMfa(true);
              setLoading(false);
              return;
            } else {
              console.log("MFA nextLevel is aal2 but no verified factors found!");
            }
          } else {
            console.log("MFA is not required. Session assurance level:", assurance);
          }

          console.log("Calling onAuthSuccess with session...");
          onAuthSuccess(data.session);
        } else {
          console.log("signInWithPassword succeeded but data.session is null.");
        }
      }
    } catch (err) {
      console.error("Error inside handleAuth:", err);
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      console.log("handleAuth finally block. Setting loading to false...");
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create verification challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId
      });
      if (challengeError) throw challengeError;

      // 2. Verify challenge using the 6-digit code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code: mfaCode
      });
      if (verifyError) throw verifyError;

      // 3. Retrieve elevated session (AAL2)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      onAuthSuccess(session);
    } catch (err) {
      setError(err.message || 'Código 2FA inválido. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (googleError) throw googleError;
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión con Google');
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor introduce tu correo electrónico primero para restablecer la contraseña.');
      return;
    }
    setError(null);
    setMessage('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setMessage('Se ha enviado un correo para restablecer tu contraseña.');
    } catch (err) {
      setError(err.message || 'Error al solicitar restablecimiento de contraseña');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="signin-container">
      {/* Left column: sign-in/sign-up form */}
      <section className="signin-left">
        <div className="signin-form-wrapper">
          <div className="signin-form-inner">
            <div>
              <h1 className="animate-element animate-delay-100 signin-title">
                {isSignUp ? (
                  <span className="font-light tracking-tighter">Crear Cuenta</span>
                ) : (
                  <span className="font-light tracking-tighter">FBA Portal</span>
                )}
              </h1>
              <p className="animate-element animate-delay-200 signin-desc">
                {isSignUp 
                  ? "Registra una nueva cuenta de administrador para tu negocio Amazon FBA" 
                  : "Accede a tu cuenta de administración y gestiona tu catálogo FBA"
                }
              </p>
            </div>

            {error && (
              <div className="animate-element alert-banner alert-banner-danger" style={{ margin: 0 }}>
                {error}
              </div>
            )}

            {message && (
              <div className="animate-element alert-banner alert-banner-success" style={{ margin: 0 }}>
                {message}
              </div>
            )}

            <form className="signin-form-inner" onSubmit={handleAuth} style={{ gap: '16px' }}>
              {isSignUp && (
                <div className="animate-element animate-delay-250">
                  <label className="signin-label">Nombre Completo</label>
                  <GlassInputWrapper>
                    <input 
                      name="fullName" 
                      type="text" 
                      placeholder="Introduce tu nombre completo" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="glass-input" 
                      required 
                    />
                  </GlassInputWrapper>
                </div>
              )}

              <div className="animate-element animate-delay-300">
                <label className="signin-label">Correo Electrónico</label>
                <GlassInputWrapper>
                  <input 
                    name="email" 
                    type="email" 
                    placeholder="usuario@empresa.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="glass-input" 
                    required 
                  />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="signin-label">Contraseña</label>
                <GlassInputWrapper>
                  <div style={{ position: 'relative' }}>
                    <input 
                      name="password" 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="glass-input" 
                      style={{ paddingRight: '48px' }}
                      required 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)} 
                      style={{ 
                        position: 'absolute', 
                        right: '12px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-tertiary)'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                  <span style={{ color: 'var(--text-secondary)' }}>Recordarme</span>
                </label>
                {!isSignUp && (
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); handleResetPassword(); }} 
                    className="signin-link"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                )}
              </div>

              <button 
                type="submit" 
                className="animate-element animate-delay-600 signin-btn-primary"
                disabled={loading}
              >
                {loading ? 'Procesando...' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="animate-element animate-delay-700 signin-divider">
              <span className="signin-divider-line"></span>
              <span className="signin-divider-text">O continuar con</span>
            </div>

            <button 
              type="button" 
              onClick={handleGoogleSignIn} 
              className="animate-element animate-delay-800 signin-btn-google"
              disabled={loading}
            >
              <GoogleIcon />
              {loading ? 'Redirigiendo...' : 'Continuar con Google'}
            </button>

            <p className="animate-element animate-delay-900" style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Acceso restringido únicamente a administradores autorizados.
            </p>
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      <section className="signin-right">
        <div className="signin-hero-image" style={{ backgroundImage: `url(${defaultHeroImage})` }}></div>
        <div className="signin-testimonials">
          <TestimonialCard testimonial={defaultTestimonials[0]} delay="animate-delay-1000" />
          <div style={{ display: 'flex' }} className="hidden xl:flex">
            <TestimonialCard testimonial={defaultTestimonials[1]} delay="animate-delay-1200" />
          </div>
        </div>
      </section>

      <Dialog open={showMfa} onOpenChange={async (open) => {
        if (!open) {
          await supabase.auth.signOut();
          setShowMfa(false);
          setMfaCode('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <div style={{ 
              display: 'inline-flex', 
              padding: '12px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--warning-light)',
              color: 'var(--warning-color)',
              marginBottom: '8px',
              width: 'max-content',
              margin: '0 auto'
            }}>
              <ShieldAlert size={28} />
            </div>
            <DialogTitle style={{ textAlign: 'center' }}>Verificación 2FA</DialogTitle>
            <DialogDescription style={{ textAlign: 'center' }}>
              Introduce el código de seguridad de 6 dígitos generado por tu aplicación autenticadora.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="alert-banner alert-banner-danger" style={{ margin: 0 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleMfaVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Código de 6 dígitos</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="000000" 
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                style={{ 
                  textAlign: 'center', 
                  fontSize: '1.6rem', 
                  letterSpacing: '0.4em', 
                  fontWeight: 700,
                  paddingLeft: '0.4em'
                }}
                required
                autoFocus
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '10px', marginTop: '8px' }}
              disabled={loading || mfaCode.length !== 6}
            >
              {loading ? 'Verificando...' : 'Verificar y Acceder'}
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ width: '100%', padding: '8px' }}
              onClick={async () => {
                await supabase.auth.signOut();
                setShowMfa(false);
                setMfaCode('');
              }}
            >
              Cancelar
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
