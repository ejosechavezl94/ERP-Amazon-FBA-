import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Edit2, Search, X, Check, RefreshCw, AlertTriangle, AlertCircle, 
  TrendingUp, ShoppingCart, History, List, Calendar, User, FileText, ArrowUpRight, ArrowDownRight, Trash2
} from 'lucide-react';

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'history'
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
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
    setStockMin(item.stock_min);
    setError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const currentStock = parseInt(editingItem.stock_current) || 0;
      const targetStock = parseInt(stockCurrent) || 0;
      const delta = targetStock - currentStock;

      // 1. Update metadata in inventory (reserved, transit, min)
      const { error: invError } = await supabase
        .from('inventory')
        .update({
          stock_reserved: parseInt(stockReserved) || 0,
          stock_in_transit: parseInt(stockInTransit) || 0,
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
            movement_type: 'Ajuste manual',
            quantity: delta,
            notes: `Ajuste manual de stock actual desde panel (${currentStock} -> ${targetStock})`,
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
        if (!window.confirm('¡Atención! La cantidad vendida excede el stock disponible actual. ¿Deseas forzar el registro de la venta igualmente?')) {
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
    return (
      item.product_name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku_internal.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku_amazon && item.sku_amazon.toLowerCase().includes(search.toLowerCase()))
    );
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">Sincroniza el inventario en tiempo real, costes y cobertura de stock</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary btn-sm" onClick={() => openSaleModal('')}>
            <ShoppingCart size={14} /> Registrar Venta
          </button>
          <button className="btn btn-secondary btn-sm" onClick={activeTab === 'inventory' ? fetchInventory : fetchMovements}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="tab-menu" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', gap: '20px' }}>
        <button 
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'inventory' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem'
          }}
        >
          <List size={16} /> Catálogo de Inventario
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--accent-color)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--accent-color)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem'
          }}
        >
          <History size={16} /> Historial de Movimientos
        </button>
      </div>

      {activeTab === 'inventory' ? (
        <>
          {/* Search and Alert Indicators */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Buscar por SKU o nombre..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <AlertCircle size={16} style={{ color: 'var(--danger-color)' }} />
                <span>Stock crítico</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} style={{ color: 'var(--warning-color)' }} />
                <span>Stock bajo</span>
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <TrendingUp size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h3>No se encontraron registros de inventario</h3>
              <p style={{ marginTop: '8px' }}>El inventario se crea automáticamente al añadir productos al catálogo.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nombre del Producto</th>
                    <th>Stock Actual</th>
                    <th>Stock Reservado</th>
                    <th>Stock en Tránsito</th>
                    <th>Disponible</th>
                    <th>Mínimo</th>
                    <th>Valor de Inventario</th>
                    <th>Ventas 7d / 30d</th>
                    <th>Velocidad Diaria</th>
                    <th>Cobertura Est.</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(item => {
                    const isUnderMin = item.stock_available < item.stock_min;
                    const isCritical = item.stock_available === 0 && item.stock_min > 0;

                    return (
                      <tr key={item.id} style={{ 
                        backgroundColor: isCritical ? 'var(--danger-light)' : isUnderMin ? 'var(--warning-light)' : 'transparent' 
                      }}>
                        <td style={{ fontWeight: 600 }}>{item.sku_internal}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{item.product_name}</span>
                            {item.sku_amazon && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>AMZN: {item.sku_amazon}</span>}
                          </div>
                        </td>
                        <td>{item.stock_current}</td>
                        <td>{item.stock_reserved}</td>
                        <td>{item.stock_in_transit}</td>
                        <td style={{ fontWeight: 600 }}>
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
                        <td>{item.estimated_daily_sales}/día</td>
                        <td style={{ fontWeight: 600 }}>
                          <span className={`badge ${
                            item.days_coverage === null ? 'badge-neutral' :
                            item.days_coverage < 15 ? 'badge-danger' : 
                            item.days_coverage < 30 ? 'badge-warning' : 'badge-success'
                          }`}>
                            {formatDaysCoverage(item.days_coverage)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openSaleModal(item.product_id)} title="Registrar Venta">
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Producto</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{editingItem?.product_name}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Stock Actual *</label>
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
                    <label className="form-label">Stock Mínimo Alerta *</label>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                  <div className="form-group">
                    <label className="form-label">Stock Reservado *</label>
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
                    <label className="form-label">Stock en Tránsito *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={stockInTransit} 
                      onChange={(e) => setStockInTransit(e.target.value)} 
                      min="0"
                      required 
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
