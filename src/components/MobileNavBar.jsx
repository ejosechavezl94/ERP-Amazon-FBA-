import React, { useState } from 'react';
import { 
  LayoutDashboard, TrendingUp, DollarSign, Wallet, MoreHorizontal, 
  Package, ShoppingCart, Users, Layers, CheckSquare, Settings as SettingsIcon,
  Sun, Moon, LogOut, X, Zap, ChevronRight
} from 'lucide-react';

export default function MobileNavBar({
  currentTab,
  setCurrentTab,
  session,
  profile,
  handleSignOut,
  theme,
  toggleTheme,
  onOpenTasks
}) {
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const primaryTabs = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventario', icon: TrendingUp },
    { id: 'sales', label: 'Ventas', icon: DollarSign },
    { id: 'gastos', label: 'Gastos', icon: Wallet },
  ];

  const secondaryMenu = [
    { id: 'products', label: 'Catálogo de Productos', icon: Package, desc: 'SKUs, ASINs y precios' },
    { id: 'orders', label: 'Pedidos de Compra (PO)', icon: ShoppingCart, desc: 'Órdenes a fábrica' },
    { id: 'suppliers', label: 'Proveedores', icon: Users, desc: 'Directorio y contactos' },
    { id: 'batches', label: 'Lotes de Producción', icon: Layers, desc: 'Seguimiento de lotes' },
    { id: 'tasks', label: 'Tareas Operativas', icon: CheckSquare, desc: 'Kanban y pendientes' },
    { id: 'settings', label: 'Conexión SP-API & Ajustes', icon: SettingsIcon, desc: 'OAuth Amazon y 2FA', badge: 'SP-API' },
  ];

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    setIsMoreSheetOpen(false);
  };

  const isSecondaryActive = secondaryMenu.some(item => item.id === currentTab);

  return (
    <>
      {/* iOS Translucent Glass Bottom Tab Bar */}
      <nav className="mobile-bottom-bar" aria-label="Navegación móvil">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`mobile-tab-btn ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="tab-icon-wrapper">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              </div>
              <span className="tab-label">{tab.label}</span>
              {isActive && <div className="tab-active-dot" />}
            </button>
          );
        })}

        {/* More Tab Button */}
        <button
          type="button"
          onClick={() => setIsMoreSheetOpen(true)}
          className={`mobile-tab-btn ${isSecondaryActive ? 'active' : ''}`}
        >
          <div className="tab-icon-wrapper">
            <MoreHorizontal size={20} strokeWidth={isSecondaryActive ? 2.4 : 1.8} />
          </div>
          <span className="tab-label">Más</span>
          {isSecondaryActive && <div className="tab-active-dot" />}
        </button>
      </nav>

      {/* iOS Bottom Sheet (More Menu) */}
      {isMoreSheetOpen && (
        <div className="mobile-sheet-overlay" onClick={() => setIsMoreSheetOpen(false)}>
          <div 
            className="mobile-sheet-container" 
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Grabber handle */}
            <div className="sheet-handle-bar" />

            <div className="sheet-header">
              <div className="sheet-user-info">
                <div className="sheet-avatar">
                  {profile?.full_name?.slice(0, 2).toUpperCase() || session?.user?.email?.slice(0, 2).toUpperCase() || 'AM'}
                </div>
                <div className="sheet-user-text">
                  <div className="sheet-user-name">{profile?.full_name || 'Vendedor Amazon FBA'}</div>
                  <div className="sheet-user-email">{session?.user?.email}</div>
                </div>
              </div>
              <button 
                type="button"
                className="sheet-close-btn" 
                onClick={() => setIsMoreSheetOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu List */}
            <div className="sheet-menu-list">
              <div className="sheet-section-title">MÓDULOS DE GESTIÓN</div>
              {secondaryMenu.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabClick(item.id)}
                    className={`sheet-menu-item ${isActive ? 'active' : ''}`}
                  >
                    <div className="sheet-item-icon">
                      <Icon size={18} />
                    </div>
                    <div className="sheet-item-text">
                      <div className="sheet-item-title">
                        {item.label}
                        {item.badge && <span className="sheet-badge">{item.badge}</span>}
                      </div>
                      <div className="sheet-item-desc">{item.desc}</div>
                    </div>
                    <ChevronRight size={16} className="sheet-chevron" />
                  </button>
                );
              })}

              <div className="sheet-section-title" style={{ marginTop: '16px' }}>PREFERENCIAS</div>
              
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                className="sheet-menu-item"
              >
                <div className="sheet-item-icon">
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </div>
                <div className="sheet-item-text">
                  <div className="sheet-item-title">Apariencia</div>
                  <div className="sheet-item-desc">
                    {theme === 'dark' ? 'Modo Oscuro (Activo)' : 'Modo Claro (Activo)'}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                  Cambiar
                </span>
              </button>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreSheetOpen(false);
                  handleSignOut();
                }}
                className="sheet-menu-item sheet-logout-item"
              >
                <div className="sheet-item-icon" style={{ color: 'var(--danger-color)' }}>
                  <LogOut size={18} />
                </div>
                <div className="sheet-item-text">
                  <div className="sheet-item-title" style={{ color: 'var(--danger-color)' }}>Cerrar Sesión</div>
                  <div className="sheet-item-desc">Desconectar cuenta en este iPhone</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
