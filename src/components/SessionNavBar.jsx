import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, Package, TrendingUp, ShoppingCart, 
  CheckSquare, Settings as SettingsIcon, LogOut, Sun, Moon, 
  ChevronsUpDown, Layers, Wallet, DollarSign
} from 'lucide-react';

export default function SessionNavBar({ 
  currentTab, 
  setCurrentTab, 
  session, 
  profile, 
  handleSignOut, 
  theme, 
  toggleTheme
}) {
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setAccountDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get initials for profile badge
  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return session?.user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  // Grouped navigation per e-commerce operational workflow
  const menuGroups = [
    {
      title: 'RESUMEN',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'CATÁLOGO E INVENTARIO',
      items: [
        { id: 'products', label: 'Productos', icon: Package },
        { id: 'inventory', label: 'Inventario', icon: TrendingUp },
        { id: 'batches', label: 'Lotes de Producción', icon: Layers }
      ]
    },
    {
      title: 'COMPRAS',
      items: [
        { id: 'orders', label: 'Pedidos PO', icon: ShoppingCart }
      ]
    },
    {
      title: 'FINANZAS Y VENTAS',
      items: [
        { id: 'sales', label: 'Ventas', icon: DollarSign },
        { id: 'gastos', label: 'Gastos', icon: Wallet }
      ]
    },
    {
      title: 'GESTIÓN',
      items: [
        { id: 'tasks', label: 'Tareas', icon: CheckSquare }
      ]
    }
  ];

  return (
    <aside
      className="sidebar"
      style={{ overflow: 'visible' }} // Allow dropdowns to float outside
    >
      {/* Header / App Name & Logo */}
      <div 
        className="sidebar-header" 
        style={{ 
          padding: '12px 14px', 
          height: '60px', 
          display: 'flex', 
          alignItems: 'center', 
          position: 'relative'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <div style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '9px', 
            background: 'linear-gradient(135deg, #181c26 0%, #0f1219 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
            border: '1px solid rgba(245, 158, 11, 0.35)'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3.5 6.5V17.5L12 22L20.5 17.5V6.5L12 2Z" fill="url(#fbaGradDesktop)" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M3.5 6.5L12 11L20.5 6.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 11V22" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.75 4.25L16.25 8.75" stroke="#fde68a" strokeWidth="1.3" strokeLinecap="round"/>
              <defs>
                <linearGradient id="fbaGradDesktop" x1="3.5" y1="2" x2="20.5" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f59e0b" stopOpacity="0.28"/>
                  <stop offset="1" stopColor="#b45309" stopOpacity="0.45"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          
          <div className="sidebar-text-container" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Portal FBA
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>
              Amazon.es
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar Menu Items Grouped */}
      <nav className="sidebar-menu" style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
        {menuGroups.map((group, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ 
              fontSize: '0.62rem', 
              fontWeight: 700, 
              color: 'var(--text-tertiary)', 
              letterSpacing: '0.08em', 
              padding: '4px 10px 2px 10px', 
              textTransform: 'uppercase' 
            }}>
              {group.title}
            </span>
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button 
                  key={item.id}
                  className={`menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => setCurrentTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 10px',
                    width: '100%',
                    border: 'none',
                    background: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: 'var(--border-radius-sm)',
                    color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                    boxShadow: isActive ? 'inset 3px 0 0 var(--accent-color)' : 'none',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={17} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.8 }} />
                  </div>
                  <span className="sidebar-text-container" style={{ display: 'inline', fontSize: '0.86rem', fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer" style={{ padding: '12px 8px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        {/* Settings button */}
        <button 
          className={`menu-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            width: '100%',
            border: 'none',
            background: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: 'var(--border-radius)',
            color: currentTab === 'settings' ? 'var(--accent-color)' : 'var(--text-secondary)',
            backgroundColor: currentTab === 'settings' ? 'var(--accent-light)' : 'transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <SettingsIcon size={18} style={{ flexShrink: 0 }} />
          <span className="sidebar-text-container" style={{ display: 'inline', fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Configuración
          </span>
        </button>

        {/* Profile Card / Dropdown */}
        <div style={{ position: 'relative' }} ref={accountRef}>
          <button 
            onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px',
              width: '100%',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: 'var(--border-radius)',
              textAlign: 'left'
            }}
            className="user-profile-trigger"
          >
            <div className="user-avatar" style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--accent-color)', 
              color: '#fff', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 600, 
              fontSize: '0.75rem',
              flexShrink: 0
            }}>
              {getUserInitials()}
            </div>
            
            <div className="sidebar-text-container" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile?.full_name || 'Mi Perfil'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session?.user?.email}
                </span>
              </div>
              <ChevronsUpDown size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '6px' }} />
            </div>
          </button>

          {/* Account Dropdown Menu */}
          {accountDropdownOpen && (
            <div className="sidebar-dropdown" style={{ bottom: '48px', left: '8px', width: '224px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
                <div className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                  {getUserInitials()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {profile?.full_name || 'Mi Perfil'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {session?.user?.email}
                  </span>
                </div>
              </div>
              
              <div className="sidebar-dropdown-separator" />
              
              {/* Theme toggle */}
              <button 
                className="sidebar-dropdown-item" 
                onClick={() => { setAccountDropdownOpen(false); toggleTheme(); }}
              >
                {theme === 'light' ? (
                  <><Moon size={14} /> <span>Modo Oscuro</span></>
                ) : (
                  <><Sun size={14} /> <span>Modo Claro</span></>
                )}
              </button>

              <button 
                className="sidebar-dropdown-item" 
                onClick={() => { setAccountDropdownOpen(false); setCurrentTab('settings'); }}
              >
                <SettingsIcon size={14} /> <span>Ver Perfil</span>
              </button>
              
              <div className="sidebar-dropdown-separator" />
              
              <button 
                className="sidebar-dropdown-item" 
                onClick={() => { setAccountDropdownOpen(false); handleSignOut(); }}
                style={{ color: 'var(--danger-color)' }}
              >
                <LogOut size={14} /> <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
