import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Shield, KeyRound, Check, RefreshCw, QrCode, Copy, Trash2, AlertCircle } from 'lucide-react';

export default function Settings({ profile, onProfileUpdate }) {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactor, setMfaFactor] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      // Find any verified TOTP factor
      const verified = data.all.find(f => f.status === 'verified');
      if (verified) {
        setMfaEnabled(true);
        setMfaFactor(verified);
      } else {
        setMfaEnabled(false);
        setMfaFactor(null);
      }
    } catch (err) {
      console.error('Error listing MFA factors:', err);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setProfileMessage('');
    setProfileError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('No se encontró sesión de usuario.');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
        })
        .eq('id', userId);

      if (error) throw error;

      setProfileMessage('¡Perfil actualizado con éxito!');
      if (onProfileUpdate) onProfileUpdate();
    } catch (err) {
      setProfileError(err.message || 'Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const startMfaEnroll = async () => {
    setMfaError('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'EPR FBA Portal',
        friendlyName: profile?.email || 'Admin User'
      });

      if (error) throw error;
      setEnrollData(data);
      setEnrolling(true);
    } catch (err) {
      setMfaError(err.message || 'Error al iniciar enrolamiento de 2FA');
    }
  };

  const verifyMfaEnroll = async (e) => {
    e.preventDefault();
    setMfaError('');
    setLoading(true);

    try {
      const factorId = enrollData.id;
      
      // 1. Create verification challenge
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });
      if (challengeError) throw challengeError;

      // 2. Submit 2FA code to verify factor
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: mfaCode
      });
      if (verifyError) throw verifyError;

      setEnrolling(false);
      setEnrollData(null);
      setMfaCode('');
      await checkMfaStatus();
    } catch (err) {
      setMfaError(err.message || 'Código de verificación incorrecto. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!window.confirm('¿Estás seguro de que quieres desactivar el doble factor (2FA)? Tu cuenta quedará protegida únicamente con contraseña.')) return;

    setMfaError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: mfaFactor.id
      });
      if (error) throw error;

      await checkMfaStatus();
    } catch (err) {
      setMfaError(err.message || 'Error al desactivar el doble factor');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (enrollData?.totp?.secret) {
      navigator.clipboard.writeText(enrollData.totp.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Actualiza tu perfil y gestiona el doble factor de autenticación corporativo</p>
        </div>
      </div>

      <div className="grid-cols-2">
        {/* Profile Card */}
        <div className="card">
          <h3 className="card-title">Perfil de Administrador</h3>
          
          {profileMessage && <div className="alert-banner alert-banner-success">{profileMessage}</div>}
          {profileError && <div className="alert-banner alert-banner-danger">{profileError}</div>}

          <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Correo Electrónico (Solo Lectura)</label>
              <input 
                type="email" 
                className="form-input" 
                value={profile?.email || ''} 
                disabled 
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Nombre Completo *</label>
              <input 
                type="text" 
                className="form-input" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        </div>

        {/* Security & 2FA Card */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} style={{ color: 'var(--accent-color)' }} /> Seguridad 2FA (Doble Factor)
          </h3>

          {mfaError && <div className="alert-banner alert-banner-danger" style={{ marginTop: '12px' }}>{mfaError}</div>}

          {!enrolling ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                El doble factor de autenticación (2FA) añade una capa adicional de protección a tu cuenta, 
                impidiendo que intrusos accedan incluso si conocen tu contraseña.
              </p>

              {mfaEnabled ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '12px 16px', 
                    backgroundColor: 'var(--success-light)', 
                    color: 'var(--success-color)', 
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid rgba(52, 211, 153, 0.2)'
                  }}>
                    <Check size={20} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '0.9rem' }}>Doble factor (2FA) activo</strong>
                      <span style={{ fontSize: '0.75rem', color: 'inherit', opacity: 0.85 }}>
                        Registrado mediante: {mfaFactor?.friendly_name}
                      </span>
                    </div>
                  </div>

                  <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={handleUnenroll} disabled={loading}>
                    <Trash2 size={14} /> Desactivar 2FA
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    padding: '12px 16px', 
                    backgroundColor: 'var(--warning-light)', 
                    color: 'var(--warning-color)', 
                    borderRadius: 'var(--border-radius-sm)',
                    border: '1px solid rgba(251, 191, 36, 0.2)'
                  }}>
                    <AlertCircle size={20} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '0.9rem' }}>2FA inactivo</strong>
                      <span style={{ fontSize: '0.75rem', color: 'inherit', opacity: 0.85 }}>
                        Tu cuenta está menos protegida. Recomendamos activarlo.
                      </span>
                    </div>
                  </div>

                  <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={startMfaEnroll}>
                    <KeyRound size={14} /> Configurar 2FA
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Enrollment flow view */
            <form onSubmit={verifyMfaEnroll} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                {enrollData?.totp?.qr_code && (
                  <div style={{ 
                    padding: '10px', 
                    backgroundColor: '#fff', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '160px',
                    height: '160px'
                  }}>
                    <img 
                      src={enrollData.totp.qr_code} 
                      alt="Código QR 2FA" 
                      style={{ width: '140px', height: '140px' }} 
                    />
                  </div>
                )}
                
                <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Pasos para configurar:</span>
                  <ol style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>Escanea el QR con Google Authenticator / Authy.</li>
                    <li>Si no puedes escanear, copia la clave secreta abajo.</li>
                    <li>Introduce el código de 6 dígitos para verificar y activar.</li>
                  </ol>
                </div>
              </div>

              {/* Secret code print */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Clave secreta de respaldo</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={enrollData?.totp?.secret || ''} 
                    disabled 
                    style={{ fontSize: '0.8rem', fontFamily: 'monospace', backgroundColor: 'var(--bg-tertiary)' }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copySecret}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Código de verificación de 6 dígitos *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={mfaCode} 
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000 000"
                  maxLength={6}
                  style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.2em', fontWeight: 700 }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading || mfaCode.length !== 6}>
                  {loading ? 'Verificando...' : 'Activar Doble Factor'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setEnrolling(false);
                  setEnrollData(null);
                }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
