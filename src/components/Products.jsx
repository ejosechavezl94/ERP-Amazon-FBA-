import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Search, X, Package, Check, RefreshCw } from 'lucide-react';

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
    if (!window.confirm('¿Estás seguro de que quieres eliminar este producto? Esto también eliminará su registro de inventario.')) return;

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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">Gestiona tu catálogo de productos y costes de adquisición</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
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
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por SKU, ASIN, EAN o nombre..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select 
            className="form-select" 
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            style={{ width: '160px' }}
          >
            {brands.map(b => (
              <option key={b} value={b}>{b === 'All' ? 'Todas las Marcas' : b}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Mostrando {filteredProducts.length} productos
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <Package size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>No se encontraron productos</h3>
          <p style={{ marginTop: '8px' }}>Empieza por añadir un nuevo producto al catálogo.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SKU Interno</th>
                <th>ASIN Amazon</th>
                <th>Código EAN</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Coste Unidad (AMZ)</th>
                <th>Precio de Venta Amz</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.sku_internal}</td>
                  <td>{p.asin_amazon || <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>N/A</span>}</td>
                  <td>{p.ean_code || <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>N/A</span>}</td>
                  <td>{p.name}</td>
                  <td>{p.brand || <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(p.cost_manufacturing)}</td>
                  <td>{formatCurrency(p.target_price)}</td>
                  <td>
                    <span className={`badge ${
                      p.status === 'Active' ? 'badge-success' : 
                      p.status === 'Draft' ? 'badge-neutral' : 'badge-danger'
                    }`}>
                      {p.status === 'Active' ? 'Activo' : p.status === 'Draft' ? 'Borrador' : 'Archivado'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => openEditModal(p)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon-only" onClick={() => handleDelete(p.id)}>
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
              <h3 className="modal-title">{editingProduct ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
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
    </div>
  );
}
