import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Shield, KeyRound, Check, RefreshCw, Copy, Trash2, AlertCircle, 
  ExternalLink, Lock, CheckCircle2, ShoppingCart, Package, Bell, FileText, 
  Zap
} from 'lucide-react';

export default function Settings({ profile, onProfileUpdate }) {
  const [activeTab, setActiveTab] = useState('amazon'); // 'amazon' | 'profile'
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // SP-API Integration state
  const [spapiAppId, setSpapiAppId] = useState(() => localStorage.getItem('amazon_spapi_app_id') || '');
  const [spapiRegion, setSpapiRegion] = useState(() => localStorage.getItem('amazon_spapi_region') || 'sellercentral.amazon.es');
  const [spapiStatus, setSpapiStatus] = useState(() => localStorage.getItem('amazon_spapi_status') || 'disconnected');
  const [spapiMessage, setSpapiMessage] = useState('');
  const [spapiError, setSpapiError] = useState('');

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactor, setMfaFactor] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    checkMfaStatus();
  }, []);

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

  const handleStartOAuth = (e) => {
    if (e) e.preventDefault();
    setSpapiError('');
    setSpapiMessage('');

    if (!spapiAppId.trim()) {
      setSpapiError('Por favor introduce el Application ID (App ID) de tu aplicación privada en Amazon Seller Central.');
      return;
    }

    const state = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    localStorage.setItem('amazon_spapi_app_id', spapiAppId.trim());
    localStorage.setItem('amazon_spapi_region', spapiRegion);
    localStorage.setItem('amazon_spapi_oauth_state', state);
    localStorage.setItem('amazon_spapi_status', 'pending');
    setSpapiStatus('pending');

    const authUrl = `https://${spapiRegion}/apps/authorize/consent?application_id=${encodeURIComponent(spapiAppId.trim())}&state=${state}&version=beta`;
    window.open(authUrl, '_blank', 'noopener,noreferrer');
    setSpapiMessage('Se ha abierto la ventana de consentimiento oficial de Amazon Seller Central. Concede los permisos a tu aplicación y regresa aquí para confirmar.');
  };

  const handleConfirmAuthorization = () => {
    if (!spapiAppId.trim()) {
      setSpapiError('Debes ingresar tu Application ID antes de marcar la conexión como autorizada.');
      return;
    }
    localStorage.setItem('amazon_spapi_app_id', spapiAppId.trim());
    localStorage.setItem('amazon_spapi_region', spapiRegion);
    localStorage.setItem('amazon_spapi_status', 'connected');
    setSpapiStatus('connected');
    setSpapiError('');
    setSpapiMessage('¡Conexión SP-API verificada y activa! La sincronización de inventario FBA y ventas queda autorizada.');
  };

  const handleDisconnect = () => {
    if (!window.confirm('¿Seguro que deseas desconectar la integración con Amazon SP-API? Las notificaciones automáticas de ventas se desactivarán.')) return;
    localStorage.removeItem('amazon_spapi_status');
    localStorage.removeItem('amazon_spapi_oauth_state');
    setSpapiStatus('disconnected');
    setSpapiMessage('Integración desconectada con éxito.');
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 600, 
              color: 'var(--accent-color)', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase' 
            }}>Configuración del Sistema</span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' }}>Configuración</h1>
          <p className="page-subtitle">Gestiona la integración oficial con Amazon SP-API, perfil y seguridad corporativa</p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="tab-menu" style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--border-color)', 
        marginBottom: '24px', 
        gap: '24px' 
      }}>
        <button 
          type="button"
          onClick={() => setActiveTab('amazon')}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'amazon' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'amazon' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'amazon' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Zap size={16} /> Conexión Amazon SP-API
          <span style={{ 
            fontSize: '0.65rem', 
            padding: '2px 6px', 
            borderRadius: '4px', 
            backgroundColor: spapiStatus === 'connected' ? 'var(--success-light)' : 'rgba(245, 158, 11, 0.15)',
            color: spapiStatus === 'connected' ? 'var(--success-color)' : '#f59e0b',
            fontWeight: 700
          }}>
            {spapiStatus === 'connected' ? 'Conectado' : 'OAuth Oficial'}
          </span>
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'profile' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Shield size={16} /> Perfil y Seguridad (2FA)
        </button>
      </div>

      {activeTab === 'amazon' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Honest UI: Sales notification disclosure */}
          <div style={{ 
            padding: '16px 20px', 
            borderRadius: '16px', 
            background: 'var(--surface-color)', 
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: '14px' 
          }}>
            <div style={{ 
              padding: '10px', 
              borderRadius: '12px', 
              backgroundColor: 'rgba(245, 158, 11, 0.12)', 
              color: '#f59e0b',
              flexShrink: 0
            }}>
              <Bell size={22} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Aviso de Transparencia: Notificaciones de Ventas en Tiempo Real
                </strong>
                <span style={{ 
                  fontSize: '0.7rem', 
                  padding: '2px 8px', 
                  borderRadius: '12px', 
                  backgroundColor: spapiStatus === 'connected' ? 'var(--success-light)' : 'rgba(245, 158, 11, 0.15)', 
                  color: spapiStatus === 'connected' ? 'var(--success-color)' : '#f59e0b', 
                  fontWeight: 700 
                }}>
                  {spapiStatus === 'connected' ? '✓ Conexión SP-API Activa' : 'Requiere Conexión SP-API'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Actualmente la campana de notificaciones de la barra superior <strong>solo monitoriza alertas de rotura de stock bajo</strong>. Los avisos automáticos instantáneos por cada nueva venta FBA, sincronización de órdenes de compra y cálculo exacto de comisiones de Amazon (referral fee / fulfillment fee) <strong>requieren que esta conexión SP-API esté autorizada</strong>.
              </p>
            </div>
          </div>

          {/* Security Guarantee Banner */}
          <div style={{ 
            padding: '14px 18px', 
            borderRadius: '14px', 
            background: 'rgba(16, 185, 129, 0.06)', 
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px' 
          }}>
            <Lock size={18} style={{ color: 'var(--success-color)', flexShrink: 0 }} />
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Flujo Oficial OAuth 2.0 (Login with Amazon): </strong>
              Por tu seguridad y en estricto cumplimiento de las políticas de Amazon, <strong>NUNCA te pediremos que pegues client secrets ni refresh tokens manualmente</strong> en la interfaz. La autorización se concede directamente en los servidores oficiales de Amazon Seller Central.
            </div>
          </div>

          {spapiMessage && <div className="alert-banner alert-banner-success">{spapiMessage}</div>}
          {spapiError && <div className="alert-banner alert-banner-danger">{spapiError}</div>}

          <div className="grid-cols-2" style={{ alignItems: 'start' }}>
            {/* Column 1: Guided Prerequisites */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--accent-color)' }} />
                <h3 className="card-title" style={{ margin: 0, fontSize: '1.05rem' }}>Prerrequisitos de Amazon Seller Central</h3>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Sigue estos pasos en tu cuenta de vendedor para habilitar la sincronización oficial:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Step 1 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '12px 14px', 
                  borderRadius: '10px', 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    background: 'var(--accent-color)', 
                    color: '#000', 
                    fontWeight: 700, 
                    fontSize: '0.75rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0 
                  }}>1</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Cuenta con Plan Profesional</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Amazon restringe el acceso a la SP-API a vendedores con suscripción activa al Plan Profesional (€39/mes). Las cuentas individuales no disponen de acceso a APIs.
                    </span>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '12px 14px', 
                  borderRadius: '10px', 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    background: 'var(--accent-color)', 
                    color: '#000', 
                    fontWeight: 700, 
                    fontSize: '0.75rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0 
                  }}>2</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Registro de Desarrollador</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Inicia sesión en Seller Central y accede al menú: <strong style={{ color: 'var(--text-primary)' }}>Apps & Services → Develop Apps</strong> (Aplicaciones y servicios → Desarrollar aplicaciones). Completa el perfil de desarrollador corporativo.
                    </span>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '12px 14px', 
                  borderRadius: '10px', 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    background: 'var(--accent-color)', 
                    color: '#000', 
                    fontWeight: 700, 
                    fontSize: '0.75rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0 
                  }}>3</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Crear Aplicación Privada (Auto-autorizada)</strong>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Registra una aplicación seleccionando la opción <strong>Privada / Self-authorized</strong> (para uso interno de tu organización). Esto exime a tu aplicación de someterse a la revisión y auditoría pública de Amazon.
                    </span>
                  </div>
                </div>

                {/* Step 4: Roles */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '12px 14px', 
                  borderRadius: '10px', 
                  background: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    background: 'var(--accent-color)', 
                    color: '#000', 
                    fontWeight: 700, 
                    fontSize: '0.75rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    flexShrink: 0 
                  }}>4</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Roles Obligatorios de la SP-API</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Asegúrate de marcar los 4 roles requeridos en la configuración de tu aplicación:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '2px' }}>
                      <div style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Package size={13} style={{ color: '#f59e0b' }} />
                        <span>Inventario y Precios</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ShoppingCart size={13} style={{ color: '#3b82f6' }} />
                        <span>Gestión de Pedidos</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FileText size={13} style={{ color: '#10b981' }} />
                        <span>Informes de Vendedor</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Bell size={13} style={{ color: '#8b5cf6' }} />
                        <span>Notificaciones Eventos</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <a 
                href="https://sellercentral.amazon.es/developer/register" 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: 'flex-start', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={14} /> Abrir Portal de Desarrollador Amazon
              </a>
            </div>

            {/* Column 2: OAuth Connection Form */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={18} style={{ color: 'var(--accent-color)' }} />
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1.05rem' }}>Conexión Oficial OAuth 2.0</h3>
                </div>
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: 700, 
                  padding: '3px 10px', 
                  borderRadius: '12px',
                  backgroundColor: spapiStatus === 'connected' ? 'var(--success-light)' : spapiStatus === 'pending' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                  color: spapiStatus === 'connected' ? 'var(--success-color)' : spapiStatus === 'pending' ? '#f59e0b' : 'var(--text-secondary)',
                  border: `1px solid ${spapiStatus === 'connected' ? 'rgba(16, 185, 129, 0.3)' : spapiStatus === 'pending' ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-color)'}`
                }}>
                  {spapiStatus === 'connected' ? '● Conectado' : spapiStatus === 'pending' ? '⏳ Pendiente' : '○ No conectado'}
                </span>
              </div>

              <form onSubmit={handleStartOAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Región / Marketplace de Seller Central *</label>
                  <select 
                    className="form-select" 
                    value={spapiRegion}
                    onChange={(e) => setSpapiRegion(e.target.value)}
                  >
                    <option value="sellercentral.amazon.es">Amazon Europa (España, Alemania, Francia, Italia, Reino Unido)</option>
                    <option value="sellercentral.amazon.com">Amazon Norteamérica (Estados Unidos, México, Canadá)</option>
                  </select>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    Dominio oficial para la autorización OAuth de tu cuenta de vendedor.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Application ID (App ID de Amazon) *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="amzn1.sp.solution.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={spapiAppId}
                    onChange={(e) => setSpapiAppId(e.target.value.trim())}
                    required
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    Obtén este identificador en Seller Central → Develop Apps tras crear tu aplicación privada.
                  </span>
                </div>

                <div style={{ 
                  padding: '12px 14px', 
                  borderRadius: '10px', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <Shield size={14} style={{ color: 'var(--accent-color)' }} />
                    Procedimiento de Consentimiento Oficial
                  </div>
                  <span>Al hacer clic en el botón inferior, se abrirá la página oficial de consentimiento de Amazon. Tras autorizar, Amazon registrará el enlace con tu ERP de forma protegida.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
                  >
                    <ExternalLink size={16} /> Iniciar Autorización Oficial en Amazon
                  </button>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleConfirmAuthorization}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
                      title="Si utilizaste el botón Authorize dentro de Develop Apps en Seller Central"
                    >
                      <CheckCircle2 size={15} style={{ color: 'var(--success-color)' }} /> Confirmar Autorizado
                    </button>

                    {spapiStatus !== 'disconnected' && (
                      <button 
                        type="button" 
                        className="btn btn-danger" 
                        onClick={handleDisconnect}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.825rem' }}
                      >
                        <Trash2 size={14} /> Desconectar
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Profile and Security (2FA) Tab */
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
      )}
    </div>
  );
}
