import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Search, X, Check, ShoppingCart, RefreshCw, Calendar, ArrowRight } from 'lucide-react';

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
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [estArrival, setEstArrival] = useState('');
  const [status, setStatus] = useState('Pendiente');
  const [batchNo, setBatchNo] = useState('');
  const [error, setError] = useState(null);

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
    setProductId(products[0]?.id || '');
    setSupplierId(suppliers[0]?.id || '');
    setQuantity(100);
    setUnitCost(5.0);
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
    setProductId(po.product_id);
    setSupplierId(po.supplier_id);
    setQuantity(po.quantity);
    setUnitCost(po.unit_cost);
    setOrderDate(po.order_date);
    setEstArrival(po.estimated_arrival || '');
    setStatus(po.status);
    setBatchNo('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payload = {
      order_number: orderNumber,
      product_id: productId,
      supplier_id: supplierId,
      quantity: parseInt(quantity) || 0,
      unit_cost: parseFloat(unitCost) || 0,
      order_date: orderDate,
      estimated_arrival: estArrival || null,
      status,
      updated_at: new Date().toISOString()
    };

    try {
      let savedPO = null;

      if (editingPO) {
        // If status is transitioning to 'Recibido' and it wasn't before
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
          await updateTransitInventory(productId, quantity);
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
    const { data: inv } = await supabase.from('inventory').select('*').eq('product_id', pId).single();
    if (inv) {
      await supabase.from('inventory').update({
        stock_in_transit: (inv.stock_in_transit || 0) + qty
      }).eq('id', inv.id);
    }
  };

  // Handle PO status change to Recibido
  const handlePOReceipt = async (po) => {
    try {
      // 1. Fetch current inventory levels
      const { data: inv, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', po.product_id)
        .single();
      
      if (invError) throw invError;

      // Calculate new stocks
      // Subtract PO quantity from transit (capping at 0), and add to stock_current
      const transitSub = Math.min(inv.stock_in_transit, po.quantity);
      const newTransit = inv.stock_in_transit - transitSub;
      const newCurrent = inv.stock_current + po.quantity;

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          stock_current: newCurrent,
          stock_in_transit: newTransit,
          last_updated: new Date().toISOString()
        })
        .eq('id', inv.id);

      if (updateError) throw updateError;

      // 2. Create a Batch representing this received purchase order
      const generatedBatchNo = batchNo || `LOT-${po.order_number}-${new Date().getFullYear()}`;
      
      const { error: batchError } = await supabase
        .from('batches')
        .insert([{
          batch_number: generatedBatchNo,
          product_id: po.product_id,
          supplier_id: po.supplier_id,
          purchase_order_id: po.id,
          quantity: po.quantity,
          cost_unit: po.unit_cost,
          status: 'In Warehouse',
          manufacturing_date: po.order_date,
          notes: `Lote autogenerado al recibir el Pedido de Compra PO-${po.order_number}`
        }]);

      if (batchError) throw batchError;

      // 3. Link the PO to the newly created batch
      const { data: createdBatch } = await supabase
        .from('batches')
        .select('id')
        .eq('batch_number', generatedBatchNo)
        .single();

      if (createdBatch) {
        await supabase
          .from('purchase_orders')
          .update({ batch_id: createdBatch.id })
          .eq('id', po.id);
      }

    } catch (err) {
      console.error('Error handling PO receipt actions:', err);
      alert(`Pedido marcado como Recibido, pero hubo un problema actualizando el inventario: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (po, newStatus) => {
    try {
      // Check if we are transitioning to 'Recibido'
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
        // If status changed to Enviado/Aduanas, add to transit
        if ((newStatus === 'Enviado' || newStatus === 'Aduanas') && (po.status !== 'Enviado' && po.status !== 'Aduanas')) {
          await updateTransitInventory(po.product_id, po.quantity);
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
    return (
      po.order_number.includes(search) ||
      po.products?.name.toLowerCase().includes(search.toLowerCase()) ||
      po.products?.sku_internal.toLowerCase().includes(search.toLowerCase()) ||
      po.suppliers?.company_name.toLowerCase().includes(search.toLowerCase())
    );
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
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Buscar por PO, SKU, producto o proveedor..." 
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
          <ShoppingCart size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>No se encontraron pedidos de compra</h3>
          <p style={{ marginTop: '8px' }}>Crea un nuevo pedido de compra para empezar a rastrear importaciones.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Producto / SKU</th>
                <th>Proveedor</th>
                <th>Cantidad</th>
                <th>Coste Unitario</th>
                <th>Coste Total</th>
                <th>Fecha Pedido</th>
                <th>Llegada Estimada</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map(po => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 600 }}>PO-{po.order_number}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{po.products?.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>SKU: {po.products?.sku_internal}</span>
                    </div>
                  </td>
                  <td>{po.suppliers?.company_name}</td>
                  <td>{po.quantity} uds</td>
                  <td>{formatCurrency(po.unit_cost)}</td>
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
                        backgroundColor: po.status === 'Recibido' || po.status === 'Cerrado' ? 'var(--success-light)' : 'var(--bg-primary)',
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
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon-only" onClick={() => handleDelete(po.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingPO ? 'Editar Pedido de Compra' : 'Crear Pedido de Compra'}</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
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
                  <label className="form-label">Seleccionar Producto *</label>
                  <select 
                    className="form-select" 
                    value={productId} 
                    onChange={(e) => setProductId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecciona un producto...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>[{p.sku_internal}] {p.name}</option>
                    ))}
                  </select>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Cantidad (Unidades) *</label>
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
                    <label className="form-label">Coste Unitario (€) *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-input" 
                      value={unitCost} 
                      onChange={(e) => setUnitCost(e.target.value)} 
                      min="0.01"
                      required 
                    />
                  </div>
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
                    <label className="form-label" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Número de Lote / Batch</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={batchNo} 
                      onChange={(e) => setBatchNo(e.target.value)} 
                      placeholder={`Ej. LOT-${orderNumber}-${new Date().getFullYear()}`} 
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                      Al guardar como "Recibido", se creará automáticamente un lote físico con esta clave y se sumará el stock al almacén.
                    </span>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Valor Total del Pedido (Calculado): {formatCurrency(parseInt(quantity || 0) * parseFloat(unitCost || 0))}
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
