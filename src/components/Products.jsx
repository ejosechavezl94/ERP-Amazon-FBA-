import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Search, X, Package, Check, RefreshCw } from 'lucide-react';
import ConfirmDialog from './ui/ConfirmDialog';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('All');
  const [brands, setBrands] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form states
  const [skuInternal, setSkuInternal] = useState('');
  const [asinAmazon, setAsinAmazon] = useState('');
  const [eanCode, setEanCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState('Active');
  const [productToDelete, setProductToDelete] = useState(null);
  const [costAmazon, setCostAmazon] = useState(0);
  const [targetPrice, setTargetPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sku_internal', { ascending: true });
      
      if (error) throw error;
      setProducts(data);

      // Extract unique brands
      const uniqueBrands = ['All', ...new Set(data.map(p => p.brand).filter(Boolean))];
      setBrands(uniqueBrands);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setSkuInternal('');
    setAsinAmazon('');
    setEanCode('');
    setName('');
    setBrand('');
    setStatus('Active');
    setCostAmazon(0);
    setTargetPrice(0);
    setNotes('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setSkuInternal(product.sku_internal);
    setAsinAmazon(product.asin_amazon || '');
    setEanCode(product.ean_code || '');
    setName(product.name);
    setBrand(product.brand || '');
    setStatus(product.status);
    setCostAmazon(product.cost_manufacturing);
    setTargetPrice(product.target_price);
    setNotes(product.notes || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payload = {
      sku_internal: skuInternal,
      asin_amazon: asinAmazon || null,
      ean_code: eanCode || null,
      name,
      brand: brand || null,
      status,
      cost_manufacturing: parseFloat(costAmazon) || 0,
      cost_shipping: 0,
      target_price: parseFloat(targetPrice) || 0,
      notes: notes || null,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([payload]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      setError(err.message || 'Error guardando el producto');
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (err) {
      alert(err.message || 'Error al eliminar el producto');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku_internal.toLowerCase().includes(search.toLowerCase()) || 
      (p.asin_amazon && p.asin_amazon.toLowerCase().includes(search.toLowerCase())) ||
      (p.ean_code && p.ean_code.toLowerCase().includes(search.toLowerCase()));
    
    const matchesBrand = filterBrand === 'All' || p.brand === filterBrand;
    return matchesSearch && matchesBrand;
  });

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
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
            }}>Catálogo FBA</span>
          </div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' }}>Catálogo de Productos</h1>
          <p className="page-subtitle">Gestiona SKUs, enlaces ASIN de Amazon y estructuras de costes de adquisición</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal} style={{ boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)' }}>
          <Plus size={16} /> Añadir Producto
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '24px', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        background: 'var(--surface-color)',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por SKU, ASIN, EAN o nombre de producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '40px', borderRadius: '10px' }}
            />
          </div>
          <select 
            className="form-select" 
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            style={{ width: '180px', borderRadius: '10px' }}
          >
            {brands.map(b => (
              <option key={b} value={b}>{b === 'All' ? 'Todas las Marcas' : b}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {filteredProducts.length} {filteredProducts.length === 1 ? 'producto encontrado' : 'productos encontrados'}
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', borderRadius: '16px' }}>
          <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.4, color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>No se encontraron productos</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Prueba ajustando los filtros o añade un nuevo SKU al catálogo.</p>
        </div>
      ) : (
        <div className="table-container" style={{ borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>SKU Interno</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>ASIN Amazon</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Producto & Marca</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Coste Fab.</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>P. Venta AMZ</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Margen Est.</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Estado</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const cost = Number(p.cost_manufacturing) || 0;
                const price = Number(p.target_price) || 0;
                const marginPct = price > 0 ? ((price - cost) / price * 100) : 0;

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>
                      <span style={{ 
                        background: 'rgba(245, 158, 11, 0.08)', 
                        color: 'var(--text-primary)', 
                        padding: '4px 8px', 
                        borderRadius: '6px',
                        border: '1px solid rgba(245, 158, 11, 0.2)'
                      }}>
                        {p.sku_internal}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {p.asin_amazon ? (
                        <a 
                          href={`https://www.amazon.es/dp/${p.asin_amazon}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            fontFamily: 'var(--font-mono)', 
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            color: 'var(--accent-color)',
                            textDecoration: 'none',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'var(--surface-color)',
                            border: '1px solid var(--border-color)'
                          }}
                        >
                          {p.asin_amazon} ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.name}</div>
                      {p.brand && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Marca: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.brand}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(cost)}
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatCurrency(price)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {price > 0 ? (
                        <span style={{ 
                          fontFamily: 'var(--font-mono)', 
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: marginPct >= 40 ? '#10b981' : marginPct >= 20 ? '#f59e0b' : '#ef4444',
                          background: marginPct >= 40 ? 'rgba(16, 185, 129, 0.1)' : marginPct >= 20 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          {marginPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${
                        p.status === 'Active' ? 'badge-success' : 
                        p.status === 'Draft' ? 'badge-neutral' : 'badge-danger'
                      }`} style={{ borderRadius: '20px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {p.status === 'Active' ? 'Activo' : p.status === 'Draft' ? 'Borrador' : 'Archivado'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openEditModal(p)} aria-label="Editar producto" style={{ borderRadius: '8px' }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon-only" onClick={() => setProductToDelete(p.id)} aria-label="Eliminar producto" style={{ borderRadius: '8px' }}>
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingProduct ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)} aria-label="Cerrar modal"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">SKU Interno *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={skuInternal} 
                      onChange={(e) => setSkuInternal(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ASIN Amazon</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={asinAmazon} 
                      onChange={(e) => setAsinAmazon(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Código EAN</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={eanCode} 
                      onChange={(e) => setEanCode(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre del Producto *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Marca</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={brand} 
                      onChange={(e) => setBrand(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select 
                      className="form-select" 
                      value={status} 
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="Active">Activo</option>
                      <option value="Draft">Borrador</option>
                      <option value="Archived">Archivado</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Coste por Unidad (AMZ) (€)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      value={costAmazon} 
                      onChange={(e) => setCostAmazon(e.target.value)} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio de Venta Amz (€)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      value={targetPrice} 
                      onChange={(e) => setTargetPrice(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <textarea 
                    className="form-textarea" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
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

      <ConfirmDialog 
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={() => handleDelete(productToDelete)}
        title="Eliminar Producto"
        description="¿Estás seguro de que quieres eliminar este producto? Esto también eliminará su registro de inventario."
        confirmText="Eliminar"
      />
    </div>
  );
}
