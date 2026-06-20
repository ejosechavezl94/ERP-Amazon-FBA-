import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Inventory from './components/Inventory';
import Suppliers from './components/Suppliers';
import PurchaseOrders from './components/PurchaseOrders';
import Documents from './components/Documents';
import Tasks from './components/Tasks';
import GlobalSearch from './components/GlobalSearch';

import { 
  LayoutDashboard, Package, TrendingUp, Users, ShoppingCart, 
  FileText, CheckSquare, Settings, LogOut, Sun, Moon, Search 
} from 'lucide-react';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 1. Session and Auth State management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
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
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)', display: 'flex', alignItems: 'center' }}>
            <TrendingUp size={20} />
          </div>
          <span className="logo-text">EPR Manager</span>
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`menu-item ${currentTab === 'products' ? 'active' : ''}`}
            onClick={() => setCurrentTab('products')}
          >
            <Package size={18} />
            <span>Productos</span>
          </button>

          <button 
            className={`menu-item ${currentTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setCurrentTab('inventory')}
          >
            <TrendingUp size={18} />
            <span>Inventario</span>
          </button>

          <button 
            className={`menu-item ${currentTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setCurrentTab('suppliers')}
          >
            <Users size={18} />
            <span>Proveedores</span>
          </button>

          <button 
            className={`menu-item ${currentTab === 'orders' ? 'active' : ''}`}
            onClick={() => setCurrentTab('orders')}
          >
            <ShoppingCart size={18} />
            <span>Pedidos PO</span>
          </button>

          <button 
            className={`menu-item ${currentTab === 'documents' ? 'active' : ''}`}
            onClick={() => setCurrentTab('documents')}
          >
            <FileText size={18} />
            <span>Documentos</span>
          </button>

          <button 
            className={`menu-item ${currentTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setCurrentTab('tasks')}
          >
            <CheckSquare size={18} />
            <span>Tareas Kanban</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {/* User Info Card */}
          <div className="user-profile">
            <div className="user-avatar">
              {getUserInitials()}
            </div>
            <div className="user-info">
              <div className="user-name">{profile?.full_name || 'Mi Perfil'}</div>
              <div className="user-email">{session.user.email}</div>
            </div>
          </div>

          {/* Theme & Logout Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={toggleTheme}>
              {theme === 'light' ? (
                <><Moon size={14} /> <span>Oscuro</span></>
              ) : (
                <><Sun size={14} /> <span>Claro</span></>
              )}
            </button>
            <button className="btn btn-danger btn-sm btn-icon-only" onClick={handleSignOut} title="Cerrar sesión">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

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
          {currentTab === 'suppliers' && <Suppliers />}
          {currentTab === 'orders' && <PurchaseOrders />}
          {currentTab === 'documents' && <Documents />}
          {currentTab === 'tasks' && <Tasks />}
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
