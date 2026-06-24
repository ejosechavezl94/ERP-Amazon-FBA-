import React, { useState, useEffect } from 'react';
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

import { 
  LayoutDashboard, Package, TrendingUp, Users, ShoppingCart, 
  FileText, CheckSquare, Settings as SettingsIcon, LogOut, Sun, Moon, Search 
} from 'lucide-react';

function App() {
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

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // 1. Session and Auth State management with 2FA check
  useEffect(() => {
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

  const fetchUserProfile = async (userId) => {
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
  };

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
  // 4. Ask for Web Notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 5. Listen to new chat messages for notifications & badge increment
  useEffect(() => {
    if (!session) return;

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
    if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      await supabase.auth.signOut();
    }
  };

  if (!session) {
    return <Auth onAuthSuccess={(sess) => {
      setSession(sess);
      fetchUserProfile(sess.user.id);
    }} />;
  }

  // Get initials for profile badge
  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return session.user.email?.slice(0, 2).toUpperCase() || 'U';
  };

  return (
    <div className="app-container">
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

          <div className="top-bar-actions">
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
