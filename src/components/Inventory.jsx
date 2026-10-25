import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Edit2, Search, X, Check, RefreshCw, AlertTriangle, AlertCircle, 
  TrendingUp, ShoppingCart, History, List, User, ArrowUpRight, ArrowDownRight, Trash2,
  Package, Zap
} from 'lucide-react';
import { runSpApiSimulation } from '../services/spapiService';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'history'
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [syncingSpApi, setSyncingSpApi] = useState(false);
  const [search, setSearch] = useState('');
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isEditMovementModalOpen, setIsEditMovementModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingMovement, setEditingMovement] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit stock form states
  const [stockCurrent, setStockCurrent] = useState(0);
  const [stockReserved, setStockReserved] = useState(0);
  const [stockInTransit, setStockInTransit] = useState(0);
  const [stockUnfulfillable, setStockUnfulfillable] = useState(0);
  const [stockMin, setStockMin] = useState(0);

  // Sale form states
  const [saleProductId, setSaleProductId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleNotes, setSaleNotes] = useState('');

  // Movement edit form states
  const [movementType, setMovementType] = useState('');
  const [movementQuantity, setMovementQuantity] = useState(0);
  const [movementNotes, setMovementNotes] = useState('');

  useEffect(() => {
    fetchInventory();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchMovements();
    }
  }, [activeTab]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('view_inventory_details')
        .select('*')
        .order('sku_internal', { ascending: true });
      
      if (error) throw error;
      setInventory(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku_internal')
        .eq('status', 'Active')
        .order('name', { ascending: true });
      setProductsList(data || []);
    } catch (err) {
      console.error('Error fetching products list:', err);
    }
  };

  const fetchMovements = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          products (sku_internal, name),
          profiles (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (err) {
      console.error('Error fetching inventory history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setStockCurrent(item.stock_current);
    setStockReserved(item.stock_reserved);
    setStockInTransit(item.stock_in_transit);
    setStockUnfulfillable(item.stock_unfulfillable || 0);
    setStockMin(item.stock_min);
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleSimulateSpApi = async () => {
    setSyncingSpApi(true);
    try {
      await runSpApiSimulation(supabase);
      await fetchInventory();
      await fetchProducts();
    } catch (err) {
      alert(err.message || 'Error en sincronización de prueba SP-API');
    } finally {
      setSyncingSpApi(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const currentStock = parseInt(editingItem.stock_current) || 0;
      const targetStock = parseInt(stockCurrent) || 0;
      const delta = targetStock - currentStock;

      // 1. Update metadata in inventory (reserved, transit, unfulfillable, min)
      const { error: invError } = await supabase
        .from('inventory')
        .update({
          stock_reserved: parseInt(stockReserved) || 0,
          stock_in_transit: parseInt(stockInTransit) || 0,
          stock_unfulfillable: parseInt(stockUnfulfillable) || 0,
          stock_min: parseInt(stockMin) || 0,
          last_updated: new Date().toISOString()
        })
        .eq('id', editingItem.id);

      if (invError) throw invError;

      // 2. If stock_current has changed, insert a manual adjustment movement
      if (delta !== 0) {
        const { error: moveError } = await supabase
          .from('inventory_movements')
          .insert([{
            product_id: editingItem.product_id,
            warehouse_type: 'FBA',
            movement_type: 'Ajuste manual',
            quantity: delta,
            notes: `Ajuste manual de stock FBA desde panel (${currentStock} -> ${targetStock})`,
            user_id: (await supabase.auth.getSession()).data.session?.user?.id
          }]);

        if (moveError) throw moveError;
      }

      setIsEditModalOpen(false);
      fetchInventory();
    } catch (err) {
      setError(err.message || 'Error actualizando inventario');
    } finally {
      setSubmitting(false);
    }
  };

  const openSaleModal = (productId = '') => {
    setSaleProductId(productId);
    setSaleQuantity(1);
    setSaleDate(new Date().toISOString().split('T')[0]);
    setSaleNotes('');
    setError(null);
    setIsSaleModalOpen(true);
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!saleProductId) {
      setError('Por favor selecciona un producto.');
      setSubmitting(false);
      return;
    }

    try {
      // Get current available stock to verify
      const selectedInv = inventory.find(i => i.product_id === saleProductId);
      if (selectedInv && (selectedInv.stock_current - selectedInv.stock_reserved) < parseInt(saleQuantity)) {
        if (!window.confirm('¡Atención! La cantidad vendida excede el stock FBA disponible actual. ¿Deseas forzar el registro de la venta igualmente?')) {
          setSubmitting(false);
          return;
        }
      }

      const { error: saleError } = await supabase
        .from('sales')
        .insert([{
          product_id: saleProductId,
          sale_date: saleDate,
          quantity: parseInt(saleQuantity),
          notes: saleNotes || null,
          warehouse_type: 'FBA',
          user_id: (await supabase.auth.getSession()).data.session?.user?.id
        }]);

      if (saleError) throw saleError;

      setIsSaleModalOpen(false);
      fetchInventory();
      if (activeTab === 'history') {
        fetchMovements();
      }
    } catch (err) {
      setError(err.message || 'Error al registrar la venta');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditMovementModal = (move) => {
    setEditingMovement(move);
    setMovementType(move.movement_type);
    setMovementQuantity(move.quantity);
    setMovementNotes(move.notes || '');
    setError(null);
    setIsEditMovementModalOpen(true);
  };

  const handleEditMovementSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from('inventory_movements')
        .update({
          movement_type: movementType,
          quantity: parseInt(movementQuantity) || 0,
          notes: movementNotes || null
        })
        .eq('id', editingMovement.id);

      if (updateError) throw updateError;

      setIsEditMovementModalOpen(false);
      fetchInventory();
      fetchMovements();
    } catch (err) {
      setError(err.message || 'Error al actualizar el movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMovement = async (move) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar este movimiento de tipo "${move.movement_type}"? Esto revertirá automáticamente su efecto en el stock actual.`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('inventory_movements')
        .delete()
        .eq('id', move.id);

      if (deleteError) throw deleteError;

      fetchInventory();
      fetchMovements();
    } catch (err) {
      alert(`Error al eliminar el movimiento: ${err.message}`);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const pName = (item.product_name || 'Sin nombre').toLowerCase();
    const skuInt = (item.sku_internal || '').toLowerCase();
    const skuAmz = (item.sku_amazon || '').toLowerCase();
    const asin = (item.asin_amazon || '').toLowerCase();
    const fnsku = (item.fnsku || '').toLowerCase();
    const s = (search || '').toLowerCase();

    return pName.includes(s) || skuInt.includes(s) || skuAmz.includes(s) || asin.includes(s) || fnsku.includes(s);
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const formatDaysCoverage = (days) => {
    if (days === null || days === undefined) return 'N/A';
    if (days === Infinity) return '∞';
    return `${days} días`;
  };

  // Helper to style movement badge
  const getMovementTypeBadge = (type) => {
    switch (type) {
      case 'Entrada de inventario': return 'badge-success';
      case 'Venta': return 'badge-danger';
      case 'Ajuste manual': return 'badge-warning';
      case 'Devolución': return 'badge-info';
      case 'Daño o pérdida': return 'badge-neutral';
      default: return 'badge-neutral';
    }
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
            }}>Logística 100% Amazon FBA</span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' }}>Inventario Amazon FBA</h1>
          <p className="page-subtitle">Control en tiempo real de unidades Fulfillable, Reservadas, Inbound y No Aptas en centros logísticos de Amazon</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleSimulateSpApi} disabled={syncingSpApi} title="Simular sincronización con estructura oficial SP-API" style={{ borderRadius: '10px', borderColor: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' }}>
            <Zap size={14} /> {syncingSpApi ? 'Sincronizando...' : 'Simular Sync SP-API'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openSaleModal('')} style={{ boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)', borderRadius: '10px' }}>
            <ShoppingCart size={14} /> Registrar Venta FBA
          </button>
          <button className="btn btn-secondary btn-sm" onClick={activeTab === 'inventory' ? fetchInventory : fetchMovements} style={{ borderRadius: '10px' }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="tab-menu" style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--border-color)', 
        marginBottom: '24px', 
        gap: '24px' 
      }}>
        <button 
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'inventory' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'inventory' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease'
          }}
        >
          <List size={16} /> Catálogo de Inventario
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'history' ? 700 : 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease'
          }}
        >
          <History size={16} /> Historial de Movimientos
        </button>
      </div>

      {activeTab === 'inventory' ? (
        <>
          {/* Search, FBA Badge and Alert Indicators */}
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            marginBottom: '24px', 
            flexWrap: 'wrap', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'var(--surface-color)',
            padding: '16px 20px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Buscar por SKU, ASIN, FNSKU o nombre..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '40px', borderRadius: '10px', width: '100%' }}
                />
              </div>

              <span style={{ 
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Package size={13} /> Centros Logísticos Amazon FBA ({filteredInventory.length} SKUs)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, color: '#ef4444' }}>
                <AlertCircle size={15} />
                <span>Stock Crítico (0 uds)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, color: '#f59e0b' }}>
                <AlertTriangle size={15} />
                <span>Bajo Mínimo FBA</span>
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
              <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--accent-color)' }} />
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', borderRadius: '16px' }}>
              <TrendingUp size={48} style={{ margin: '0 auto 16px', opacity: 0.4, color: 'var(--accent-color)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>No se encontraron registros de inventario</h3>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>El inventario se crea automáticamente al registrar nuevos SKUs en el catálogo.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="table-container desktop-only-table" style={{ borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>SKU</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Producto & Almacén</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Físico</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Reservado</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>En Tránsito</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Disponible</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Mínimo</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Valor Stock</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Ventas (30d)</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Cobertura Est.</th>
                      <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map(item => {
                      const isUnderMin = item.stock_available < item.stock_min;
                      const isCritical = item.stock_available === 0 && item.stock_min > 0;

                      return (
                        <tr key={item.id} style={{ 
                          backgroundColor: isCritical ? 'rgba(239, 68, 68, 0.05)' : isUnderMin ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s ease'
                        }}>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>
                            <span style={{ 
                              background: 'rgba(245, 158, 11, 0.08)', 
                              color: 'var(--text-primary)', 
                              padding: '4px 8px', 
                              borderRadius: '6px',
                              border: '1px solid rgba(245, 158, 11, 0.2)'
                            }}>
                              {item.sku_internal}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                  {item.product_name || 'Sin nombre'}
                                </span>
                                <span 
                                  title="Stock en centro logístico de Amazon FBA"
                                  style={{ 
                                    fontSize: '0.72rem', 
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 700,
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Package size={12} /> Amazon FBA
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                                {item.asin_amazon && <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-color)' }}>ASIN: {item.asin_amazon}</span>}
                                {item.fnsku && <span style={{ fontFamily: 'var(--font-mono)' }}>FNSKU: {item.fnsku}</span>}
                                {item.stock_unfulfillable > 0 && (
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                    No apto/Dañado FBA: {item.stock_unfulfillable} uds
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.stock_current}</td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{item.stock_reserved}</td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{item.stock_in_transit}</td>
                          <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isCritical ? '#ef4444' : isUnderMin ? '#f59e0b' : 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {item.stock_available}
                              {isCritical ? (
                                <AlertCircle size={14} style={{ color: 'var(--danger-color)' }} />
                              ) : isUnderMin ? (
                                <AlertTriangle size={14} style={{ color: 'var(--warning-color)' }} />
                              ) : null}
                            </div>
                          </td>
                          <td>{item.stock_min}</td>
                          <td style={{ fontWeight: 500 }}>{formatCurrency(item.inventory_value)}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
                              <span>7d: <strong>{item.sales_7_days || 0}</strong> un.</span>
                              <span style={{ color: 'var(--text-secondary)' }}>30d: <strong>{item.sales_30_days || 0}</strong> un.</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                              <span className={`badge ${
                                item.days_coverage === null ? 'badge-neutral' :
                                item.days_coverage < 15 ? 'badge-danger' : 
                                item.days_coverage < 30 ? 'badge-warning' : 'badge-success'
                              }`}>
                                {formatDaysCoverage(item.days_coverage)}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 400, fontFamily: 'var(--font-mono)' }}>
                                {item.estimated_daily_sales || 0}/día
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openSaleModal(item.product_id)} title="Registrar Venta FBA">
                                <ShoppingCart size={14} />
                              </button>
                              <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openEditModal(item)} title="Ajustar Stock / Parámetros">
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View (iOS Native Experience) */}
              <div className="inventory-mobile-cards">
                {filteredInventory.map(item => {
                  const isUnderMin = item.stock_available < item.stock_min;
                  const isCritical = item.stock_available === 0 && item.stock_min > 0;

                  return (
                    <div 
                      key={`mob-${item.id}`} 
                      className="card inventory-mobile-card"
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        backgroundColor: isCritical ? 'rgba(239, 68, 68, 0.05)' : isUnderMin ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-secondary)',
                        border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.25)' : isUnderMin ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-color)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {/* Card Header: SKU, ASIN/FNSKU & FBA Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ 
                              fontFamily: 'var(--font-mono)', 
                              fontWeight: 700, 
                              fontSize: '0.78rem',
                              background: 'rgba(245, 158, 11, 0.1)', 
                              color: 'var(--text-primary)', 
                              padding: '2px 7px', 
                              borderRadius: '5px',
                              border: '1px solid rgba(245, 158, 11, 0.25)'
                            }}>
                              {item.sku_internal}
                            </span>
                            {item.asin_amazon && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--accent-color)', fontFamily: 'var(--font-mono)' }}>
                                {item.asin_amazon}
                              </span>
                            )}
                            {item.fnsku && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                                {item.fnsku}
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)', marginTop: '2px', lineHeight: 1.3 }}>
                            {item.product_name || 'Sin nombre'}
                          </span>
                        </div>

                        <div>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            padding: '4px 8px', 
                            borderRadius: '8px', 
                            fontWeight: 700, 
                            background: 'rgba(245, 158, 11, 0.18)', 
                            color: '#f59e0b', 
                            border: '1px solid rgba(245, 158, 11, 0.35)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            <Package size={12} /> FBA
                          </span>
                        </div>
                      </div>

                      {/* Key Stock Metrics Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '8px', 
                        padding: '10px 12px', 
                        background: 'var(--surface-color)', 
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Disponible</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <strong style={{ fontSize: '1.15rem', color: isCritical ? '#ef4444' : isUnderMin ? '#f59e0b' : 'var(--text-primary)' }}>
                              {item.stock_available}
                            </strong>
                            {isCritical && <AlertCircle size={13} style={{ color: '#ef4444' }} />}
                            {isUnderMin && !isCritical && <AlertTriangle size={13} style={{ color: '#f59e0b' }} />}
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Mín: {item.stock_min}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Físico / Tráns.</span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {item.stock_current} / {item.stock_in_transit}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Res: {item.stock_reserved}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Cobertura</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {formatDaysCoverage(item.days_coverage)}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{item.estimated_daily_sales || 0}/día</span>
                        </div>
                      </div>

                      {/* Quick Action Touch Targets (iOS 44px ergonomics) */}
                      <div style={{ display: 'flex', gap: '8px', paddingTop: '2px' }}>
                        <button 
                          type="button"
                          className="btn btn-secondary btn-sm" 
                          onClick={() => openSaleModal(item.product_id)} 
                          style={{ 
                            flex: 1, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px', 
                            fontSize: '0.82rem', 
                            fontWeight: 600, 
                            borderRadius: '10px',
                            minHeight: '38px'
                          }}
                        >
                          <ShoppingCart size={15} /> Registrar Venta
                        </button>
                        <button 
                          type="button"
                          className="btn btn-secondary btn-sm" 
                          onClick={() => openEditModal(item)} 
                          style={{ 
                            flex: 1, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '6px', 
                            fontSize: '0.82rem', 
                            fontWeight: 600, 
                            borderRadius: '10px',
                            minHeight: '38px'
                          }}
                        >
                          <Edit2 size={15} /> Ajustar Stock
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* History / Movements View */}
          {loadingHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
            </div>
          ) : movements.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <History size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h3>No hay movimientos registrados</h3>
              <p style={{ marginTop: '8px' }}>Los movimientos se registran automáticamente cuando realizas entradas, ventas o ajustes manuales.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Tipo de Movimiento</th>
                    <th>Cantidad</th>
                    <th>Usuario</th>
                    <th>Notas</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(move => {
                    const isNegative = move.quantity < 0 || move.movement_type === 'Venta' || move.movement_type === 'Daño o pérdida';
                    return (
                      <tr key={move.id}>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(move.created_at).toLocaleString('es-ES')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500 }}>{move.products?.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>SKU: {move.products?.sku_internal}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${getMovementTypeBadge(move.movement_type)}`}>
                            {move.movement_type}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: isNegative ? 'var(--danger-color)' : 'var(--success-color)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {isNegative ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                            {move.quantity}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={12} style={{ color: 'var(--text-tertiary)' }} />
                            {move.profiles?.full_name || move.profiles?.email || 'Sistema'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={move.notes}>
                          {move.notes || '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openEditMovementModal(move)} title="Editar Movimiento">
                              <Edit2 size={14} />
                            </button>
                            <button className="btn btn-danger btn-sm btn-icon-only" onClick={() => handleDeleteMovement(move)} title="Eliminar Movimiento">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Edit Inventory Modal (Manual adjustments & reserved/transit configs) */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Ajustar Stock y Parámetros: {editingItem?.sku_internal}</h3>
              <button className="action-btn" onClick={() => setIsEditModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Producto & Ubicación</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: '6px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Package size={12} /> Centro Logístico Amazon FBA
                    </span>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{editingItem?.product_name || 'Sin nombre'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    SKU: {editingItem?.sku_internal} {editingItem?.fnsku ? `| FNSKU: ${editingItem.fnsku}` : ''}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Stock Físico en FBA *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={stockCurrent} 
                      onChange={(e) => setStockCurrent(e.target.value)} 
                      min="0"
                      required 
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                      Creará un movimiento de "Ajuste manual"
                    </span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Mínimo Alerta FBA *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={stockMin} 
                      onChange={(e) => setStockMin(e.target.value)} 
                      min="0"
                      required 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Reservado FBA *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={stockReserved} 
                      onChange={(e) => setStockReserved(e.target.value)} 
                      min="0"
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Inbound (Tránsito) *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={stockInTransit} 
                      onChange={(e) => setStockInTransit(e.target.value)} 
                      min="0"
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">No Apto / Dañado</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={stockUnfulfillable} 
                      onChange={(e) => setStockUnfulfillable(e.target.value)} 
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Disponible Estimado:</span>
                    <span style={{ fontWeight: 600 }}>{parseInt(stockCurrent || 0) - parseInt(stockReserved || 0) + parseInt(stockInTransit || 0)} unidades</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Velocidad de Venta Calculada:</span>
                    <span style={{ fontWeight: 600 }}>
                      {editingItem?.estimated_daily_sales || '0.00'}/día (basado en ventas de 30 días)
                    </span>
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} /> {submitting ? 'Aplicando...' : 'Aplicar Ajustes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Sale Modal */}
      {isSaleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} style={{ color: 'var(--accent-color)' }} />
                Registrar Venta Manual
              </h3>
              <button className="action-btn" onClick={() => setIsSaleModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Producto *</label>
                  <select 
                    className="form-select" 
                    value={saleProductId} 
                    onChange={(e) => setSaleProductId(e.target.value)}
                    required
                  >
                    <option value="">Selecciona un producto...</option>
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>{p.sku_internal} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Cantidad Vendida *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={saleQuantity} 
                      onChange={(e) => setSaleQuantity(e.target.value)} 
                      min="1"
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de Venta *</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={saleDate} 
                        onChange={(e) => setSaleDate(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas Opcionales</label>
                  <textarea 
                    className="form-textarea" 
                    value={saleNotes} 
                    onChange={(e) => setSaleNotes(e.target.value)} 
                    placeholder="Ej. Venta al por menor, pedido de prueba, etc."
                    rows="3"
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSaleModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} /> {submitting ? 'Registrando...' : 'Registrar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Movement Modal */}
      {isEditMovementModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} style={{ color: 'var(--accent-color)' }} />
                Editar Movimiento
              </h3>
              <button className="action-btn" onClick={() => setIsEditMovementModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditMovementSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Producto</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{editingMovement?.products?.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>SKU: {editingMovement?.products?.sku_internal}</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de Movimiento *</label>
                  <select 
                    className="form-select" 
                    value={movementType} 
                    onChange={(e) => setMovementType(e.target.value)}
                    required
                  >
                    <option value="Entrada de inventario">Entrada de inventario</option>
                    <option value="Venta">Venta</option>
                    <option value="Ajuste manual">Ajuste manual</option>
                    <option value="Devolución">Devolución</option>
                    <option value="Daño o pérdida">Daño o pérdida</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Cantidad *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={movementQuantity} 
                    onChange={(e) => setMovementQuantity(e.target.value)} 
                    required 
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                    Nota: Los ajustes manuales pueden ser negativos. Las ventas y pérdidas restan stock de forma automática.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas / Razón del cambio</label>
                  <textarea 
                    className="form-textarea" 
                    value={movementNotes} 
                    onChange={(e) => setMovementNotes(e.target.value)} 
                    placeholder="Ej. Corrección de error de digitación, etc."
                    rows="3"
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditMovementModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} /> {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
