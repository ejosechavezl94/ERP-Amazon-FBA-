import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, Edit2, Trash2, Search, X, Check, RefreshCw, 
  Layers, Package, Users, ShoppingCart, FileText, Calendar, Info 
} from 'lucide-react';

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [error, setError] = useState(null);

  // Form states
  const [batchNumber, setBatchNumber] = useState('');
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [costUnit, setCostUnit] = useState(0);
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [status, setStatus] = useState('Activo');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch batches with relations
      const { data: bData, error: bErr } = await supabase
        .from('batches')
        .select(`
          *,
          products(id, name, sku_internal),
          suppliers(id, company_name),
          purchase_orders!fk_batches_purchase_order(id, order_number)
        `)
        .order('created_at', { ascending: false });
      if (bErr) throw bErr;

      // 2. Fetch all sales to perform FIFO sold calculations
      const { data: sData } = await supabase.from('sales').select('product_id, quantity');
      
      // 3. Fetch products, suppliers, orders for dropdowns
      const { data: pData } = await supabase.from('products').select('id, name, sku_internal');
      const { data: supData } = await supabase.from('suppliers').select('id, company_name');
      const { data: ordData } = await supabase.from('purchase_orders').select('id, order_number');
      const { data: docData } = await supabase.from('documents').select('id, name, file_path, file_type, category, batch_id');

      setProducts(pData || []);
      setSuppliers(supData || []);
      setOrders(ordData || []);
      setDocuments(docData || []);

      // Calculate sold units per batch using FIFO logic
      if (bData && sData) {
        // Group sales by product_id
        const productSales = {};
        sData.forEach(sale => {
          productSales[sale.product_id] = (productSales[sale.product_id] || 0) + sale.quantity;
        });

        // Order batches chronologically to apply FIFO
        const chronoBatches = [...bData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const salesCounters = { ...productSales };

        chronoBatches.forEach(batch => {
          const prodId = batch.product_id;
          const totalSales = salesCounters[prodId] || 0;
          if (totalSales > 0) {
            const allocated = Math.min(batch.quantity, totalSales);
            batch.sold_units = allocated;
            batch.remaining_units = batch.quantity - allocated;
            salesCounters[prodId] -= allocated;
          } else {
            batch.sold_units = 0;
            batch.remaining_units = batch.quantity;
          }
        });

        // Set state back to the original order (or sorted)
        setBatches(bData);
      } else {
        setBatches(bData || []);
      }
    } catch (err) {
      console.error('Error fetching batches data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingBatch(null);
    setBatchNumber('');
    setProductId('');
    setSupplierId('');
    setOrderId('');
    setQuantity(0);
    setCostUnit(0);
    setMfgDate('');
    setExpDate('');
    setStatus('Activo');
    setNotes('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (batch) => {
    setEditingBatch(batch);
    setBatchNumber(batch.batch_number);
    setProductId(batch.product_id);
    setSupplierId(batch.supplier_id || '');
    setOrderId(batch.purchase_order_id || '');
    setQuantity(batch.quantity);
    setCostUnit(batch.cost_unit);
    setMfgDate(batch.manufacturing_date || '');
    setExpDate(batch.expiry_date || '');
    setStatus(batch.status || 'Activo');
    setNotes(batch.notes || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payload = {
      batch_number: batchNumber,
      product_id: productId,
      supplier_id: supplierId || null,
      purchase_order_id: orderId || null,
      quantity: parseInt(quantity) || 0,
      cost_unit: parseFloat(costUnit) || 0,
      cost_total: (parseInt(quantity) || 0) * (parseFloat(costUnit) || 0),
      manufacturing_date: mfgDate || null,
      expiry_date: expDate || null,
      status,
      notes: notes || null
    };

    try {
      if (editingBatch) {
        const { error } = await supabase
          .from('batches')
          .update(payload)
          .eq('id', editingBatch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('batches')
          .insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Error al guardar el lote');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este lote? Esto no afectará las unidades históricas del inventario pero borrará este lote.')) return;

    try {
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert(err.message || 'Error al eliminar el lote');
    }
  };

  const filteredBatches = batches.filter(b => {
    const matchesSearch = 
      b.batch_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.products && b.products.name.toLowerCase().includes(search.toLowerCase())) ||
      (b.products && b.products.sku_internal.toLowerCase().includes(search.toLowerCase())) ||
      (b.suppliers && b.suppliers.company_name.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  // Metrics calculations
  const totalBatchesCount = batches.length;
  const totalUnitsInitial = batches.reduce((acc, b) => acc + b.quantity, 0);
  const totalUnitsSold = batches.reduce((acc, b) => acc + (b.sold_units || 0), 0);
  const totalUnitsRemaining = totalUnitsInitial - totalUnitsSold;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lotes de Producción</h1>
          <p className="page-subtitle">Rastrea la trazabilidad, unidades vendidas, costes unitarios y fechas de vencimiento</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Crear Lote
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 280px))', gap: '24px', marginBottom: '24px' }}>
        <div className="card metric-card">
          <span className="metric-label">Lotes Registrados</span>
          <span className="metric-value">{totalBatchesCount}</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Buscar por lote, SKU, producto..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Layers size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No se encontraron lotes registrados.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Producto</th>
                <th>Proveedor</th>
                <th>Unidades (Ini / Vend / Rest)</th>
                <th>Fechas (Fab / Venc)</th>
                <th>Costo Unit. / Total</th>
                <th>Documentos</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map(b => {
                const batchDocs = documents.filter(d => d.batch_id === b.id);
                return (
                  <tr key={b.id}>
                    <td>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: '0.8rem', 
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-tertiary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)'
                      }}>
                        {b.batch_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.products?.name || 'Producto Desconocido'}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{b.products?.sku_internal}</span>
                      </div>
                    </td>
                    <td>
                      {b.suppliers ? (
                        <span style={{ fontSize: '0.85rem' }}>{b.suppliers.company_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span title="Iniciales" style={{ fontWeight: 600 }}>{b.quantity}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                        <span title="Vendidas" style={{ color: 'var(--success-color)' }}>{b.sold_units ?? 0}</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                        <span title="Restantes" style={{ 
                          color: (b.remaining_units ?? b.quantity) === 0 ? 'var(--danger-color)' : 'var(--warning-color)',
                          fontWeight: 500
                        }}>{b.remaining_units ?? b.quantity}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                        <span title="Fecha Fabricación" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={10} style={{ color: 'var(--text-tertiary)' }} />
                          {b.manufacturing_date || 'N/A'}
                        </span>
                        <span title="Fecha Expiración" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: b.expiry_date ? 500 : 400 }}>
                          <Calendar size={10} style={{ color: 'var(--danger-color)' }} />
                          {b.expiry_date || 'Sin vencimiento'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{formatCurrency(b.cost_unit)}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total: {formatCurrency(b.cost_total || (b.quantity * b.cost_unit))}</span>
                      </div>
                    </td>
                    <td>
                      {batchDocs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {batchDocs.map(doc => (
                            <span key={doc.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--accent-color)' }} title={doc.name}>
                              <FileText size={10} />
                              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontStyle: 'italic' }}>Ninguno</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        b.status === 'Activo' ? 'badge-success' : 
                        b.status === 'Agotado' ? 'badge-danger' : 'badge-neutral'
                      }`} style={{ fontSize: '0.7rem' }}>
                        {b.status || 'Activo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openEditModal(b)} title="Editar Lote">
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => handleDelete(b.id)} title="Eliminar Lote">
                          <Trash2 size={13} style={{ color: 'var(--danger-color)' }} />
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

      {/* Add / Edit Batch Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingBatch ? 'Editar Lote' : 'Crear Lote'}</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Número de Lote *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={batchNumber} 
                    onChange={(e) => setBatchNumber(e.target.value)} 
                    placeholder="Ej. BATCH-2026-A"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Producto *</label>
                  <select 
                    className="form-select" 
                    value={productId} 
                    onChange={(e) => setProductId(e.target.value)}
                    required
                  >
                    <option value="">Selecciona un producto</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku_internal})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Proveedor</label>
                    <select 
                      className="form-select" 
                      value={supplierId} 
                      onChange={(e) => setSupplierId(e.target.value)}
                    >
                      <option value="">Ninguno</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.company_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pedido PO Asoc.</label>
                    <select 
                      className="form-select" 
                      value={orderId} 
                      onChange={(e) => setOrderId(e.target.value)}
                    >
                      <option value="">Ninguno</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>{o.order_number}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Cantidad Inicial *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={quantity} 
                      onChange={(e) => setQuantity(e.target.value)} 
                      min="1"
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Costo Unitario (€) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-input" 
                      value={costUnit} 
                      onChange={(e) => setCostUnit(e.target.value)} 
                      min="0.01"
                      required 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Fecha de Fabricación</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={mfgDate} 
                      onChange={(e) => setMfgDate(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha de Expiración</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={expDate} 
                      onChange={(e) => setExpDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select 
                    className="form-select" 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Activo">Activo</option>
                    <option value="Agotado">Agotado</option>
                    <option value="Retirado">Retirado</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <textarea 
                    className="form-textarea" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Comentarios adicionales..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
