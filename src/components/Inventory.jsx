import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Edit2, Search, X, Check, RefreshCw, AlertTriangle, AlertCircle, TrendingUp } from 'lucide-react';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Editing form states
  const [stockCurrent, setStockCurrent] = useState(0);
  const [stockReserved, setStockReserved] = useState(0);
  const [stockInTransit, setStockInTransit] = useState(0);
  const [stockMin, setStockMin] = useState(0);
  const [dailySales, setDailySales] = useState(1.0);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      // Query the dynamic database view that computes all metrics
      const { data, error } = await supabase
        .from('view_inventory_details')
        .select('*')
        .order('sku_internal', { ascending: true });
      
      if (error) throw error;
      setInventory(data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setStockCurrent(item.stock_current);
    setStockReserved(item.stock_reserved);
    setStockInTransit(item.stock_in_transit);
    setStockMin(item.stock_min);
    setDailySales(item.estimated_daily_sales);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          stock_current: parseInt(stockCurrent) || 0,
          stock_reserved: parseInt(stockReserved) || 0,
          stock_in_transit: parseInt(stockInTransit) || 0,
          stock_min: parseInt(stockMin) || 0,
          estimated_daily_sales: parseFloat(dailySales) || 1.0,
          last_updated: new Date().toISOString()
        })
        .eq('id', editingItem.id); // Wait, this uses the inventory row's id (PK)

      if (error) throw error;

      setIsModalOpen(false);
      fetchInventory();
    } catch (err) {
      setError(err.message || 'Error actualizando inventario');
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario</h1>
          <p className="page-subtitle">Sincroniza el inventario en tiempo real, costes y cobertura de stock</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchInventory}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

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
                <th>Ventas Diarias Est.</th>
                <th>Cobertura Est.</th>
                <th>Última Actualización</th>
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
                    <td>{item.estimated_daily_sales}/día</td>
                    <td style={{ fontWeight: 600 }}>
                      <span className={`badge ${
                        item.days_coverage < 15 ? 'badge-danger' : 
                        item.days_coverage < 30 ? 'badge-warning' : 'badge-success'
                      }`}>
                        {formatDaysCoverage(item.days_coverage)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(item.last_updated).toLocaleString('es-ES', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openEditModal(item)}>
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Inventory Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Ajustar Inventario: {editingItem?.sku_internal}</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Producto</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{editingItem?.product_name}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Stock Actual (En almacén) *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={stockCurrent} 
                      onChange={(e) => setStockCurrent(e.target.value)} 
                      min="0"
                      required 
                    />
                  </div>
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
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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

                <div className="form-group">
                  <label className="form-label">Ventas Diarias Estimadas (Velocidad de venta) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-input" 
                    value={dailySales} 
                    onChange={(e) => setDailySales(e.target.value)} 
                    min="0"
                    required 
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Se utiliza para estimar los días de cobertura de stock: Disponible / Ventas Diarias
                  </span>
                </div>

                <div className="form-group" style={{ marginTop: '8px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Disponible Estimado:</span>
                    <span style={{ fontWeight: 600 }}>{parseInt(stockCurrent || 0) - parseInt(stockReserved || 0) + parseInt(stockInTransit || 0)} unidades</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>Cobertura Estimada:</span>
                    <span style={{ fontWeight: 600 }}>
                      {dailySales > 0 ? `${Math.ceil((parseInt(stockCurrent || 0) - parseInt(stockReserved || 0) + parseInt(stockInTransit || 0)) / parseFloat(dailySales))} días` : 'N/A'}
                    </span>
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Aplicar Ajustes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
