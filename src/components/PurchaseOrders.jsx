import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Search, X, Check, ShoppingCart, RefreshCw, Calendar, Link } from 'lucide-react';

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState(null);

  // Form states
  const [orderNumber, setOrderNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [estArrival, setEstArrival] = useState('');
  const [status, setStatus] = useState('Pendiente');
  const [batchNo, setBatchNo] = useState('');
  const [error, setError] = useState(null);

  // Dynamic order lines state (Array of objects)
  const [orderLines, setOrderLines] = useState([
    { productId: '', quantity: 100, unitCost: 5.0 }
  ]);

  useEffect(() => {
    fetchPOs();
    fetchDropdowns();
  }, []);

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, products(name, sku_internal), suppliers(company_name)')
        .order('order_number', { ascending: false });
      if (error) throw error;
      setPurchaseOrders(data);
    } catch (err) {
      console.error('Error fetching POs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const { data: pData } = await supabase.from('products').select('id, name, sku_internal').eq('status', 'Active');
      const { data: sData } = await supabase.from('suppliers').select('id, company_name');
      setProducts(pData || []);
      setSuppliers(sData || []);
    } catch (err) {
      console.error('Error fetching dropdowns:', err);
    }
  };

  const openAddModal = () => {
    setEditingPO(null);
    setOrderNumber(Math.floor(1000 + Math.random() * 9000).toString());
    setSupplierId(suppliers[0]?.id || '');
    setOrderLines([
      { productId: products[0]?.id || '', quantity: '', unitCost: '' }
    ]);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setEstArrival('');
    setStatus('Pendiente');
    setBatchNo('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (po) => {
    setEditingPO(po);
    setOrderNumber(po.order_number);
    setSupplierId(po.supplier_id);
    setOrderDate(po.order_date);
    setEstArrival(po.estimated_arrival || '');
    setStatus(po.status);
    setBatchNo('');
    setError(null);

    // If purchase order contains items array, load it; otherwise fall back to single product columns
    if (po.items && Array.isArray(po.items) && po.items.length > 0) {
      setOrderLines(po.items.map(item => ({
        productId: item.productId || item.product_id || '',
        quantity: item.quantity || '',
        unitCost: item.unitCost || item.unit_cost || ''
      })));
    } else {
      setOrderLines([
        { productId: po.product_id || '', quantity: po.quantity || '', unitCost: po.unit_cost || '' }
      ]);
    }
    
    setIsModalOpen(true);
  };

  // Order Lines Handlers
  const addOrderLine = () => {
    setOrderLines([
      ...orderLines,
      { productId: products[0]?.id || '', quantity: '', unitCost: '' }
    ]);
  };

  const removeOrderLine = (index) => {
    const lines = [...orderLines];
    lines.splice(index, 1);
    setOrderLines(lines);
  };

  const updateOrderLine = (index, field, value) => {
    const lines = [...orderLines];
    lines[index][field] = value;
    setOrderLines(lines);
  };

  const calculatedTotalCost = orderLines.reduce((acc, line) => acc + ((parseInt(line.quantity) || 0) * (parseFloat(line.unitCost) || 0)), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate that all lines have a product selected
    if (orderLines.some(line => !line.productId)) {
      setError('Por favor selecciona un producto para todas las líneas del pedido.');
      return;
    }

    // Prepare payload
    const payload = {
      order_number: orderNumber,
      // Store first line's details as single values for backwards compatibility
      product_id: orderLines[0]?.productId || null,
      quantity: orderLines.reduce((sum, l) => sum + l.quantity, 0),
      unit_cost: orderLines[0]?.unitCost || 0,
      total_cost: calculatedTotalCost,
      items: orderLines, // save dynamic array of objects to jsonb column
      supplier_id: supplierId,
      order_date: orderDate,
      estimated_arrival: estArrival || null,
      status,
      updated_at: new Date().toISOString()
    };

    try {
      let savedPO = null;

      if (editingPO) {
        const statusTransitionToReceived = status === 'Recibido' && editingPO.status !== 'Recibido';

        const { data, error } = await supabase
          .from('purchase_orders')
          .update(payload)
          .eq('id', editingPO.id)
          .select();
        
        if (error) throw error;
        savedPO = data[0];

        if (statusTransitionToReceived && savedPO) {
          await handlePOReceipt(savedPO);
        }
      } else {
        const { data, error } = await supabase
          .from('purchase_orders')
          .insert([payload])
          .select();
        
        if (error) throw error;
        savedPO = data[0];

        // If PO was created directly in 'Enviado' or 'Aduanas', update transit inventory
        if (status === 'Enviado' || status === 'Aduanas') {
          for (const line of orderLines) {
            await updateTransitInventory(line.productId, line.quantity);
          }
        } else if (status === 'Recibido') {
          await handlePOReceipt(savedPO);
        }
      }

      setIsModalOpen(false);
      fetchPOs();
    } catch (err) {
      setError(err.message || 'Error al guardar el pedido');
    }
  };

  // Helper to increment stock_in_transit
  const updateTransitInventory = async (pId, qty) => {
    const { error } = await supabase.rpc('rpc_update_transit_inventory', { p_product_id: pId, p_qty: qty });
    if (error) throw error;
  };

  // Handle PO status change to Recibido
  const handlePOReceipt = async (po) => {
    try {
      const { error } = await supabase.rpc('rpc_handle_po_receipt', { p_po_id: po.id, p_batch_no: batchNo || '' });
      if (error) throw error;
    } catch (err) {
      console.error('Error handling PO receipt actions:', err);
      alert(`Pedido marcado como Recibido, pero hubo un problema actualizando el inventario: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (po, newStatus) => {
    try {
      const isTransitioningToReceived = newStatus === 'Recibido' && po.status !== 'Recibido';
      
      // Update PO status
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', po.id)
        .select();

      if (error) throw error;

      if (isTransitioningToReceived) {
        await handlePOReceipt(data[0]);
      } else {
        // If status changed to Enviado/Aduanas, add lines to transit
        if ((newStatus === 'Enviado' || newStatus === 'Aduanas') && (po.status !== 'Enviado' && po.status !== 'Aduanas')) {
          const lines = po.items && Array.isArray(po.items) && po.items.length > 0
            ? po.items
            : [{ productId: po.product_id, quantity: po.quantity }];
          
          for (const line of lines) {
            await updateTransitInventory(line.productId || line.product_id, line.quantity);
          }
        }
      }

      fetchPOs();
    } catch (err) {
      alert(err.message || 'Error al actualizar el estado');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este pedido de compra?')) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchPOs();
    } catch (err) {
      alert(err.message || 'Error al eliminar el pedido');
    }
  };

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = 
      po.order_number.includes(search) ||
      (po.suppliers && po.suppliers.company_name.toLowerCase().includes(search.toLowerCase()));
    
    // Check if search query matches any products inside order lines
    const matchesProduct = po.items && Array.isArray(po.items)
      ? po.items.some(line => {
          const prod = products.find(p => p.id === line.productId);
          return prod && (
            prod.name.toLowerCase().includes(search.toLowerCase()) ||
            prod.sku_internal.toLowerCase().includes(search.toLowerCase())
          );
        })
      : (po.products && (
          po.products.name.toLowerCase().includes(search.toLowerCase()) ||
          po.products.sku_internal.toLowerCase().includes(search.toLowerCase())
        ));

    return matchesSearch || matchesProduct;
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos de Compra</h1>
          <p className="page-subtitle">Gestiona la cadena de suministro, control de aduanas e ingresos de stock</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Crear Pedido (PO)
        </button>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Buscar por PO, SKU, producto..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Mostrando {filteredPOs.length} pedidos
        </div>
      </div>

      {/* POs List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : filteredPOs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.5, color: 'var(--text-tertiary)' }} />
          <h3>No se encontraron pedidos de compra</h3>
          <p style={{ marginTop: '8px', fontSize: '0.875rem' }}>Crea un nuevo pedido de compra para empezar a registrar mercancía.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Variantes / SKU</th>
                <th>Proveedor</th>
                <th>Unidades Totales</th>
                <th>Costo Total</th>
                <th>Fecha Pedido</th>
                <th>Llegada Estimada</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map(po => {
                const totalUnits = po.items && Array.isArray(po.items)
                  ? po.items.reduce((sum, l) => sum + l.quantity, 0)
                  : po.quantity;
                return (
                  <tr key={po.id}>
                    <td style={{ fontWeight: 600 }}>PO-{po.order_number}</td>
                    <td>
                      {po.items && Array.isArray(po.items) && po.items.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {po.items.map((line, idx) => {
                            const prod = products.find(p => p.id === line.productId);
                            return (
                              <span key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                <strong style={{ fontFamily: 'var(--font-mono)' }}>[{prod?.sku_internal || 'N/A'}]</strong> {prod?.name || 'Desconocido'} ({line.quantity} uds)
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{po.products?.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>SKU: {po.products?.sku_internal}</span>
                        </div>
                      )}
                    </td>
                    <td>{po.suppliers?.company_name}</td>
                    <td>{totalUnits} uds</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(po.total_cost)}</td>
                    <td>{po.order_date}</td>
                    <td>{po.estimated_arrival || <span style={{ color: 'var(--text-tertiary)' }}>Sin definir</span>}</td>
                    <td>
                      <select 
                        className="form-select" 
                        value={po.status} 
                        onChange={(e) => handleUpdateStatus(po, e.target.value)}
                        style={{ 
                          padding: '3px 8px', 
                          fontSize: '0.8rem', 
                          width: '130px', 
                          fontWeight: 500,
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: po.status === 'Recibido' || po.status === 'Cerrado' ? 'var(--success-light)' : 'var(--bg-secondary)',
                          color: po.status === 'Recibido' || po.status === 'Cerrado' ? 'var(--success-color)' : 'var(--text-primary)',
                        }}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Producción">Producción</option>
                        <option value="Inspección">Inspección</option>
                        <option value="Enviado">Enviado</option>
                        <option value="Aduanas">Aduanas</option>
                        <option value="Recibido">Recibido</option>
                        <option value="Cerrado">Cerrado</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openEditModal(po)}>
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => handleDelete(po.id)}>
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingPO ? 'Editar Pedido de Compra' : 'Crear Pedido de Compra'}</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {error && (
                  <div className="alert-banner alert-banner-danger">
                    {error}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Número de Pedido (PO) *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={orderNumber} 
                      onChange={(e) => setOrderNumber(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select 
                      className="form-select" 
                      value={status} 
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Producción">Producción</option>
                      <option value="Inspección">Inspección</option>
                      <option value="Enviado">Enviado</option>
                      <option value="Aduanas">Aduanas</option>
                      <option value="Recibido">Recibido</option>
                      <option value="Cerrado">Cerrado</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Seleccionar Proveedor *</label>
                  <select 
                    className="form-select" 
                    value={supplierId} 
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecciona un proveedor...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Dinamic Order Lines Section */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '16px', backgroundColor: 'var(--bg-secondary)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '12px' }}>
                    Productos y Variantes del Pedido *
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {orderLines.map((line, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          {idx === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Variante / SKU</label>}
                          <select 
                            className="form-select" 
                            value={line.productId} 
                            onChange={(e) => updateOrderLine(idx, 'productId', e.target.value)}
                            required
                          >
                            <option value="" disabled>Seleccionar...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>[{p.sku_internal}] {p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          {idx === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Cantidad</label>}
                          <input 
                            type="number" 
                            className="form-input" 
                            value={line.quantity} 
                            onChange={(e) => {
                              const val = e.target.value;
                              updateOrderLine(idx, 'quantity', val === '' ? '' : parseInt(val, 10));
                            }}
                            min="1"
                            required 
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          {idx === 0 && <label className="form-label" style={{ fontSize: '0.75rem' }}>Coste Unit (€)</label>}
                          <input 
                            type="number" 
                            step="0.01"
                            className="form-input" 
                            value={line.unitCost} 
                            onChange={(e) => {
                              const val = e.target.value;
                              updateOrderLine(idx, 'unitCost', val === '' ? '' : parseFloat(val));
                            }}
                            min="0.01"
                            required 
                          />
                        </div>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm btn-icon-only" 
                          onClick={() => removeOrderLine(idx)}
                          disabled={orderLines.length === 1}
                          style={{ height: '38px' }}
                          title="Eliminar fila"
                        >
                          <Trash2 size={13} style={{ color: 'var(--danger-color)' }} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ marginTop: '12px' }} 
                    onClick={addOrderLine}
                  >
                    <Plus size={14} /> Añadir Producto
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Fecha de Pedido *</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={orderDate} 
                      onChange={(e) => setOrderDate(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha Estimada Llegada</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={estArrival} 
                      onChange={(e) => setEstArrival(e.target.value)} 
                    />
                  </div>
                </div>

                {status === 'Recibido' && !editingPO?.batch_id && (
                  <div className="form-group" style={{ padding: '12px', border: '1px dashed var(--accent-color)', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'var(--accent-light)' }}>
                    <label className="form-label" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Prefijo de Lote / Batch</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={batchNo} 
                      onChange={(e) => setBatchNo(e.target.value)} 
                      placeholder={`Ej. LOT-${orderNumber}`} 
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      Al guardar como "Recibido", se creará automáticamente un lote físico por cada variante del pedido y se sumará el stock.
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Valor Total del Pedido (Calculado):
                  </span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                    {formatCurrency(calculatedTotalCost)}
                  </span>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Guardar Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
