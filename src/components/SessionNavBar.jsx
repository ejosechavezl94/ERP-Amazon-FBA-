import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, Package, TrendingUp, Users, ShoppingCart, 
  FileText, CheckSquare, Settings as SettingsIcon, LogOut, Sun, Moon, 
  ChevronsUpDown, Plus, Layers, Wallet, DollarSign
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
  const [isCollapsed, setIsCollapsed] = useState(true);
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
      title: 'COMPRAS Y PROVEEDORES',
      items: [
        { id: 'suppliers', label: 'Proveedores', icon: Users },
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
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      onMouseEnter={() => setIsCollapsed(false)}
      onMouseLeave={() => setIsCollapsed(true)}
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
            width: '30px', 
            height: '30px', 
            borderRadius: '8px', 
            backgroundColor: '#ffffff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            border: '1px solid var(--border-color)'
          }}>
            <img 
              src="/amazon-logo.png" 
              alt="Amazon FBA Logo" 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'contain',
                padding: '2px'
              }} 
            />
          </div>
          
          <div className="sidebar-text-container" style={{ flex: 1, minWidth: 0, display: isCollapsed ? 'none' : 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Amazon FBA ERP
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-color)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Console v2.0
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar Menu Items Grouped */}
      <nav className="sidebar-menu" style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
        {menuGroups.map((group, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {!isCollapsed && (
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
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button 
                  key={item.id}
                  className={`menu-item ${isActive ? 'active' : ''}`}
                  onClick={() => setCurrentTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
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
                  <span className="sidebar-text-container" style={{ display: isCollapsed ? 'none' : 'inline', fontSize: '0.86rem', fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap' }}>
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
          <span className="sidebar-text-container" style={{ display: isCollapsed ? 'none' : 'inline', fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Configuración
          </span>
        </button>

        {/* Profile Card / Dropdown */}
        <div style={{ position: 'relative' }} ref={accountRef}>
          <button 
            onClick={() => !isCollapsed && setAccountDropdownOpen(!accountDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px',
              width: '100%',
              border: 'none',
              background: 'none',
              cursor: !isCollapsed ? 'pointer' : 'default',
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
            
            <div className="sidebar-text-container" style={{ flex: 1, minWidth: 0, display: isCollapsed ? 'none' : 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          {accountDropdownOpen && !isCollapsed && (
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
      
      {/* Liquid Glass SVG Filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <filter
            id="container-glass"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02 0.02"
              numOctaves="1"
              seed="1"
              result="turbulence"
            />
            <feGaussianBlur in="turbulence" stdDeviation="1" result="blurredNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurredNoise"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="B"
              result="displaced"
            />
            <feGaussianBlur in="displaced" stdDeviation="0" result="finalBlur" />
            <feComposite in="SourceGraphic" in2="finalBlur" operator="over" />
          </filter>
        </defs>
      </svg>
    </aside>
  );
}
