import React, { useState, useEffect, useRef } from 'react';
import { supabase, isConfigured } from './supabaseClient';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Inventory from './components/Inventory';
import Batches from './components/Batches';
import Suppliers from './components/Suppliers';
import PurchaseOrders from './components/PurchaseOrders';
import Documents from './components/Documents';
import Tasks from './components/Tasks';
import Settings from './components/Settings';
import GastosPage from './components/GastosPage';
import GlobalSearch from './components/GlobalSearch';
import SalesPage from './components/SalesPage';
import SessionNavBar from './components/SessionNavBar';
import InternalChat from './components/InternalChat';

import { Search, Bell, Check } from 'lucide-react';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_stock_alerts')) || {};
    } catch {
      return {};
    }
  });
  const [seenAlerts, setSeenAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('seen_stock_alerts')) || [];
    } catch {
      return [];
    }
  });

  async function fetchUserProfile(userId) {
    if (!isConfigured) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }

  // 1. Session and Auth State management with 2FA check
  useEffect(() => {
    if (!isConfigured) return;
    console.log("App mounted. Checking session...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("App getSession resolved. Session:", session ? "Exists" : "Null");
      if (session) {
        setSession(session);
        fetchUserProfile(session.user.id);
        
        // MFA check in background
        supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: assurance }) => {
          if (assurance && assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
            console.log("App getSession: MFA required but only AAL1. Forcing re-auth...");
            setSession(null);
            setProfile(null);
          }
        }).catch(err => {
          console.error("Error checking MFA in background on session load:", err);
        });
      }
    }).catch(err => {
      console.error("Error getting session on load:", err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("onAuthStateChange fired! Event:", event, "Session user:", session?.user?.email || "Null");
      if (session) {
        setSession(session);
        fetchUserProfile(session.user.id);

        // MFA check in background
        supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data: assurance }) => {
          if (assurance && assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
            console.log("onAuthStateChange: MFA required but only AAL1. Setting session to null in UI...");
            setSession(null);
            setProfile(null);
          }
        }).catch(err => {
          console.error("Error checking MFA in background on auth state change:", err);
        });
      } else {
        console.log("onAuthStateChange: No session, clearing state in UI...");
        setSession(null);
        setProfile(null);
      }
    });

    return () => {
      console.log("App unmounting. Unsubscribing from auth state changes...");
      subscription.unsubscribe();
    };
  }, []);

  // 2. Light / Dark Mode Toggle
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // 3. Listen to Cmd+K or Ctrl+K shortcut for Global Search
  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Listen to clicks outside the notifications popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchLowStockAlerts = async () => {
    if (!isConfigured) return;
    try {
      const { data, error } = await supabase
        .from('view_inventory_details')
        .select('id, product_name, stock_available, stock_min');
      if (error) throw error;
      
      const rawAlerts = data.filter(item => item.stock_available < item.stock_min);
      
      // Sync dismissed alerts map
      setDismissedAlerts(prev => {
        const updated = { ...prev };
        let changed = false;
        
        // Remove items that are no longer low-stock or have changed their stock level
        Object.keys(updated).forEach(id => {
          const matching = rawAlerts.find(a => a.id === id);
          if (!matching || matching.stock_available !== updated[id]) {
            delete updated[id];
            changed = true;
          }
        });
        
        if (changed) {
          localStorage.setItem('dismissed_stock_alerts', JSON.stringify(updated));
        }
        return updated;
      });

      // Filter based on currently active dismissed map
      const storedDismissedStr = localStorage.getItem('dismissed_stock_alerts');
      const storedDismissed = storedDismissedStr ? JSON.parse(storedDismissedStr) : {};
      
      const activeAlerts = rawAlerts.filter(item => storedDismissed[item.id] !== item.stock_available);
      setLowStockAlerts(activeAlerts);

      // Clean up seenAlerts for items no longer in activeAlerts
      setSeenAlerts(prev => {
        const activeIds = activeAlerts.map(a => a.id);
        const updatedSeen = prev.filter(id => activeIds.includes(id));
        if (updatedSeen.length !== prev.length) {
          localStorage.setItem('seen_stock_alerts', JSON.stringify(updatedSeen));
          return updatedSeen;
        }
        return prev;
      });
      
      // Trigger native notification if stock is low
      const storedSeenStr = localStorage.getItem('seen_stock_alerts');
      const storedSeen = storedSeenStr ? JSON.parse(storedSeenStr) : [];
      const unseenActiveAlerts = activeAlerts.filter(a => !storedSeen.includes(a.id));

      if (unseenActiveAlerts.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Alerta de Stock Bajo FBA', {
          body: `Atención: Tienes ${unseenActiveAlerts.length} productos con stock por debajo del límite mínimo.`,
          icon: '/amazon-logo.png'
        });
      }
    } catch (err) {
      console.error('Error fetching low stock alerts:', err);
    }
  };

  const dismissAlert = (id, stockAvailable) => {
    const updated = { ...dismissedAlerts, [id]: stockAvailable };
    setDismissedAlerts(updated);
    localStorage.setItem('dismissed_stock_alerts', JSON.stringify(updated));
    setLowStockAlerts(prev => prev.filter(item => item.id !== id));
    
    // Also remove from seenAlerts
    setSeenAlerts(prev => {
      const filtered = prev.filter(x => x !== id);
      localStorage.setItem('seen_stock_alerts', JSON.stringify(filtered));
      return filtered;
    });
  };

  const handleBellClick = () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);
    if (nextState && lowStockAlerts.length > 0) {
      const currentIds = lowStockAlerts.map(a => a.id);
      setSeenAlerts(currentIds);
      localStorage.setItem('seen_stock_alerts', JSON.stringify(currentIds));
    }
  };

  useEffect(() => {
    if (!session) return;

    fetchLowStockAlerts();

    const interval = setInterval(() => {
      fetchLowStockAlerts();
    }, 15000);

    return () => clearInterval(interval);
  }, [session, currentTab]);
  // 4. Ask for Web Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 5. Listen to new chat messages for notifications & badge increment
  useEffect(() => {
    if (!isConfigured || !session) return;

    let profilesMap = {};
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .then(({ data }) => {
        if (data) {
          data.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      });

    const channel = supabase
      .channel('realtime-chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages'
        },
        (payload) => {
          const newMsg = payload.new;
          if (newMsg.user_id !== session.user.id) {
            setCurrentTab(prevTab => {
              if (prevTab !== 'chat') {
                setUnreadChatCount(prevCount => prevCount + 1);
                
                if ('Notification' in window && Notification.permission === 'granted') {
                  const sender = profilesMap[newMsg.user_id];
                  const senderName = sender?.full_name || sender?.email || 'Socio';
                  
                  new Notification('Nuevo mensaje en el Chat Interno', {
                    body: `${senderName}: ${newMsg.message}`,
                    icon: '/amazon-logo.png'
                  });
                }
              }
              return prevTab;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // 6. Reset unread count when switching to chat tab
  useEffect(() => {
    if (currentTab === 'chat') {
      setUnreadChatCount(0);
    }
  }, [currentTab]);
  const handleSignOut = async () => {
    if (!isConfigured) return;
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await supabase.auth.signOut();
    }
  };

  if (!isConfigured) {
    return (
      <div className="auth-wrapper" style={{ padding: '20px' }}>
        <div className="auth-card" style={{ maxWidth: '520px' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h1 className="auth-title" style={{ color: 'var(--danger-color)' }}>Falta Configuración</h1>
            <p className="auth-subtitle" style={{ marginTop: '12px', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Las credenciales de conexión con Supabase no están configuradas en el entorno del servidor de Vercel.
            </p>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            <p>Para solucionar este problema y ver tu aplicación en Vercel, sigue estos pasos:</p>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>Entra a tu panel del proyecto en <strong>Vercel</strong>.</li>
              <li>Ve a la pestaña de <strong>Settings</strong> y luego a <strong>Environment Variables</strong>.</li>
              <li>Añade las siguientes dos variables:
                <ul style={{ paddingLeft: '20px', marginTop: '6px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Nombre: <code>VITE_SUPABASE_URL</code> <br/> Valor: <code>https://oxstzslugnzoknzlqiyh.supabase.co</code></li>
                  <li>Nombre: <code>VITE_SUPABASE_ANON_KEY</code> <br/> Valor: (Copia la clave larga de tu archivo <code>.env</code> local)</li>
                </ul>
              </li>
              <li>Haz clic en <strong>Save</strong> para guardar las variables.</li>
              <li>Ve a la pestaña de <strong>Deployments</strong> en Vercel, selecciona tu último despliegue, pulsa en los tres puntos y selecciona <strong>Redeploy</strong> (con la opción "rebuild" activa) para aplicar la configuración.</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onAuthSuccess={(sess) => {
      setSession(sess);
      fetchUserProfile(sess.user.id);
    }} />;
  }

  return (
    <div className="app-container">
      <style>{`
        .icon-btn-hover:hover {
          background-color: var(--bg-secondary);
          color: var(--text-primary);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Sidebar navigation */}
      <SessionNavBar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        session={session} 
        profile={profile} 
        handleSignOut={handleSignOut} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        unreadChatCount={unreadChatCount}
      />

      {/* Main viewport */}
      <main className="main-content">
        {/* Top Header */}
        <header className="top-bar">
          <button className="search-trigger" onClick={() => setIsSearchOpen(true)}>
            <Search size={14} />
            <span>Buscar...</span>
            <span className="search-shortcut">⌘K</span>
          </button>

          <div className="top-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
            {/* Notification Bell */}
            {isConfigured && session && (
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button 
                  onClick={handleBellClick}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    borderRadius: '50%',
                    position: 'relative',
                    transition: 'background-color 0.2s'
                  }}
                  className="icon-btn-hover"
                  title="Alertas de Stock"
                >
                  <Bell size={18} />
                  {lowStockAlerts.filter(a => !seenAlerts.includes(a.id)).length > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      backgroundColor: 'var(--danger-color)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 0 2px var(--bg-primary)'
                    }}>
                      {lowStockAlerts.filter(a => !seenAlerts.includes(a.id)).length}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    marginTop: '8px',
                    width: '320px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    padding: '16px',
                    animation: 'fadeIn 0.2s ease'
                  }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      Alertas de Inventario Bajo ({lowStockAlerts.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                      {lowStockAlerts.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
                          ¡Todo al día! No hay alertas de stock bajo.
                        </p>
                      ) : (
                        lowStockAlerts.map(alert => (
                          <div 
                            key={alert.id} 
                            style={{ 
                              padding: '8px 12px', 
                              backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                              border: '1px solid rgba(239, 68, 68, 0.2)', 
                              borderRadius: 'var(--border-radius-sm)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {alert.product_name}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                Stock: <strong style={{ color: 'var(--danger-color)' }}>{alert.stock_available}</strong> / Mínimo: {alert.stock_min}
                              </span>
                            </div>
                            <button
                              onClick={() => dismissAlert(alert.id, alert.stock_available)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              className="icon-btn-hover"
                              title="Marcar como leído"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {profile?.full_name && (
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Bienvenido, {profile.full_name}
              </span>
            )}
          </div>
        </header>

        {/* Tab body content */}
        <div className="page-body">
          {currentTab === 'dashboard' && <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />}
          {currentTab === 'products' && <Products />}
          {currentTab === 'inventory' && <Inventory />}
          {currentTab === 'batches' && <Batches />}
          {currentTab === 'suppliers' && <Suppliers />}
          {currentTab === 'orders' && <PurchaseOrders />}
          {currentTab === 'documents' && <Documents />}
          {currentTab === 'tasks' && <Tasks />}
          {currentTab === 'sales' && <SalesPage />}
          {currentTab === 'gastos' && <GastosPage />}
          {currentTab === 'chat' && <InternalChat session={session} profile={profile} />}
          {currentTab === 'settings' && (
            <Settings 
              profile={profile} 
              onProfileUpdate={() => fetchUserProfile(session.user.id)} 
            />
          )}
        </div>
      </main>

      {/* Global Search Overlay */}
      <GlobalSearch 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onNavigate={(tab) => setCurrentTab(tab)} 
      />
    </div>
  );
}

export default App;
