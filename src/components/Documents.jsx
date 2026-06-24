import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Search, X, Check, FileText, Download, Link, RefreshCw, Eye } from 'lucide-react';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Preview states
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Form states
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('Facturas');
  const [notes, setNotes] = useState('');
  const [productId, setProductId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [error, setError] = useState(null);

  const categories = [
    'Facturas', 'Presupuestos', 'Packing Lists', 'Certificados', 
    'Documentos de importación', 'Contratos', 'Imágenes', 'Archivos generales'
  ];

  useEffect(() => {
    fetchDocuments();
    fetchDropdowns();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *, 
          products(name, sku_internal), 
          suppliers(company_name), 
          purchase_orders(order_number), 
          batches(batch_number)
        `)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const { data: pData } = await supabase.from('products').select('id, name, sku_internal');
      const { data: sData } = await supabase.from('suppliers').select('id, company_name');
      const { data: oData } = await supabase.from('purchase_orders').select('id, order_number');
      const { data: bData } = await supabase.from('batches').select('id, batch_number');
      setProducts(pData || []);
      setSuppliers(sData || []);
      setOrders(oData || []);
      setBatches(bData || []);
    } catch (err) {
      console.error('Error fetching entities for linking:', err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor selecciona un archivo para subir.');
      return;
    }
    setError(null);
    setUploading(true);

    try {
      // 1. Upload file to Supabase Storage private bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).slice(2)}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Insert metadata into public.documents table
      const { data: insertedData, error: dbError } = await supabase
        .from('documents')
        .insert([{
          name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          category,
          notes: notes || null,
          product_id: productId || null,
          supplier_id: supplierId || null,
          purchase_order_id: orderId || null,
          batch_id: batchId || null,
          uploaded_by: (await supabase.auth.getSession()).data.session?.user?.id
        }])
        .select();

      if (dbError) throw dbError;

      setIsModalOpen(false);
      setFile(null);
      setNotes('');
      setProductId('');
      setSupplierId('');
      setOrderId('');
      setBatchId('');
      fetchDocuments();

      if (insertedData && insertedData[0]) {
        handlePreview(insertedData[0]);
      }
    } catch (err) {
      setError(err.message || 'Error durante la subida del documento');
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (doc) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);
    setPreviewUrl('');
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 300, { download: false }); // link valid for 5 minutes and served inline

      if (error) throw error;
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
      }
    } catch (err) {
      console.error('Error generating preview URL:', err);
      alert(`Error al cargar la vista previa: ${err.message}`);
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      // Generate a temporary signed URL for downloading
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 60); // link valid for 60 seconds

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      alert(`Error al descargar el archivo: ${err.message}`);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el documento "${doc.name}"?`)) return;

    try {
      // 1. Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path]);
      if (storageError) throw storageError;

      // 2. Delete from documents table
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);
      if (dbError) throw dbError;

      fetchDocuments();
    } catch (err) {
      alert(`Error al eliminar el archivo: ${err.message}`);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      (doc.notes && doc.notes.toLowerCase().includes(search.toLowerCase())) ||
      (doc.products?.name && doc.products.name.toLowerCase().includes(search.toLowerCase())) ||
      (doc.suppliers?.company_name && doc.suppliers.company_name.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = filterCategory === 'All' || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión Documental</h1>
          <p className="page-subtitle">Almacenamiento privado y seguro para facturas, packing lists y contratos comerciales</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Subir Documento
        </button>
      </div>

      {/* Category Tabs (Notion style) */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        overflowX: 'auto', 
        paddingBottom: '8px', 
        marginBottom: '20px', 
        borderBottom: '1px solid var(--border-color)' 
      }}>
        <button 
          onClick={() => setFilterCategory('All')}
          style={{
            padding: '6px 12px',
            fontSize: '0.85rem',
            fontWeight: 500,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
            color: filterCategory === 'All' ? 'var(--accent-color)' : 'var(--text-secondary)',
            backgroundColor: filterCategory === 'All' ? 'var(--accent-light)' : 'transparent',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setFilterCategory(cat)}
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontWeight: 500,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: '4px',
              color: filterCategory === cat ? 'var(--accent-color)' : 'var(--text-secondary)',
              backgroundColor: filterCategory === cat ? 'var(--accent-light)' : 'transparent',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search & Layout Toggle */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar documentos por nombre, producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          
          {/* View Toggles */}
          <div style={{ display: 'flex', gap: '4px', border: '1px solid var(--border-color)', padding: '2px', borderRadius: 'var(--border-radius-sm)', backgroundColor: 'var(--bg-secondary)' }}>
            <button 
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                border: 'none',
                background: viewMode === 'list' ? 'var(--bg-primary)' : 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 500,
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Lista
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--bg-primary)' : 'transparent',
                borderRadius: '4px',
                cursor: 'pointer',
                color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: 500,
                boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Cuadrícula
            </button>
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Mostrando {filteredDocs.length} documentos
        </div>
      </div>

      {/* Main viewport */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5, color: 'var(--text-tertiary)' }} />
          <h3>No hay documentos guardados</h3>
          <p style={{ marginTop: '8px', fontSize: '0.875rem' }}>Sube facturas, contratos o packing lists vinculados a tus lotes.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Categoría</th>
                <th>Tamaño</th>
                <th>Relación</th>
                <th>Notas</th>
                <th>Fecha Subida</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={18} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                        {doc.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{doc.category}</span>
                  </td>
                  <td>{formatBytes(doc.file_size)}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                      {doc.products && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                          <Link size={10} /> Producto: {doc.products.sku_internal}
                        </div>
                      )}
                      {doc.suppliers && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                          <Link size={10} /> Proveedor: {doc.suppliers.company_name}
                        </div>
                      )}
                      {doc.purchase_orders && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                          <Link size={10} /> Pedido: PO-{doc.purchase_orders.order_number}
                        </div>
                      )}
                      {doc.batches && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                          <Link size={10} /> Lote: {doc.batches.batch_number}
                        </div>
                      )}
                      {!doc.product_id && !doc.supplier_id && !doc.purchase_order_id && !doc.batch_id && (
                        <span style={{ color: 'var(--text-tertiary)' }}>General</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.notes || '-'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(doc.uploaded_at).toLocaleDateString('es-ES')}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => handlePreview(doc)} title="Vista previa">
                        <Eye size={13} />
                      </button>
                      <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => handleDownload(doc)} title="Descargar">
                        <Download size={13} />
                      </button>
                      <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => handleDelete(doc)} title="Eliminar">
                        <Trash2 size={13} style={{ color: 'var(--danger-color)' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View Mode */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
          {filteredDocs.map(doc => (
            <div key={doc.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'space-between', position: 'relative', padding: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{doc.category}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{formatBytes(doc.file_size)}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '8px 0' }}>
                  <FileText size={24} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '2.4em', lineHeight: '1.2' }}>
                    {doc.name}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', padding: '8px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', margin: '8px 0' }}>
                  {doc.products && (
                    <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Link size={10} /> SKU: {doc.products.sku_internal}
                    </span>
                  )}
                  {doc.suppliers && (
                    <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Link size={10} /> Proveedor: {doc.suppliers.company_name}
                    </span>
                  )}
                  {doc.batches && (
                    <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Link size={10} /> Lote: {doc.batches.batch_number}
                    </span>
                  )}
                  {!doc.product_id && !doc.supplier_id && !doc.purchase_order_id && !doc.batch_id && (
                    <span style={{ color: 'var(--text-tertiary)' }}>General</span>
                  )}
                </div>

                {doc.notes && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {doc.notes}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  {new Date(doc.uploaded_at).toLocaleDateString('es-ES')}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-secondary btn-sm btn-icon-only" style={{ padding: '4px' }} onClick={() => handlePreview(doc)} title="Vista previa">
                    <Eye size={12} />
                  </button>
                  <button className="btn btn-secondary btn-sm btn-icon-only" style={{ padding: '4px' }} onClick={() => handleDownload(doc)} title="Descargar">
                    <Download size={12} />
                  </button>
                  <button className="btn btn-secondary btn-sm btn-icon-only" style={{ padding: '4px' }} onClick={() => handleDelete(doc)} title="Eliminar">
                    <Trash2 size={12} style={{ color: 'var(--danger-color)' }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Subir Nuevo Documento</h3>
              <button className="action-btn" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Archivo *</label>
                  <input 
                    type="file" 
                    className="form-input" 
                    onChange={handleFileChange} 
                    required 
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Tamaño máximo recomendado: 10MB
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select 
                    className="form-select" 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Link to Entities */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', padding: '12px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Vincular Documento (Opcional)
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Producto</label>
                      <select className="form-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
                        <option value="">Ninguno</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.sku_internal} - {p.name.slice(0, 15)}...</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Proveedor</label>
                      <select className="form-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                        <option value="">Ninguno</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.company_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Pedido (PO)</label>
                      <select className="form-select" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                        <option value="">Ninguno</option>
                        {orders.map(o => (
                          <option key={o.id} value={o.id}>PO-{o.order_number}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Lote / Batch</label>
                      <select className="form-select" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                        <option value="">Ninguno</option>
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>{b.batch_number}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Notas o Resumen del archivo</label>
                  <textarea 
                    className="form-textarea" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Ej. Factura de envío aduanero pagada por transferencia..."
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Subiendo...' : 'Subir Archivo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Document Modal */}
      {previewDoc && (
        <div className="modal-overlay" style={{ zIndex: 105 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} style={{ color: 'var(--accent-color)' }} />
                  {previewDoc.name}
                </h3>
                <span className="badge badge-neutral" style={{ marginTop: '4px', display: 'inline-block' }}>{previewDoc.category}</span>
              </div>
              <button className="action-btn" onClick={() => { setPreviewDoc(null); setPreviewUrl(''); }}><X size={18} /></button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
              {loadingPreview ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-color)' }} />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cargando vista previa...</span>
                </div>
              ) : previewUrl ? (
                <div style={{ width: '100%', height: '100%', minHeight: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {/* Image Preview */}
                  {(previewDoc.name.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp|svg)$/) || previewDoc.file_type?.startsWith('image/')) ? (
                    <div style={{ padding: '10px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', maxWidth: '100%', maxHeight: '550px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <img 
                        src={previewUrl} 
                        alt={previewDoc.name} 
                        style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '4px' }} 
                      />
                    </div>
                  ) : /* PDF Preview */
                  (previewDoc.name.toLowerCase().endsWith('.pdf') || previewDoc.file_type === 'application/pdf') ? (
                    <iframe 
                      src={previewUrl} 
                      title={previewDoc.name} 
                      width="100%" 
                      height="500px" 
                      style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'white' }} 
                    />
                  ) : /* Text Preview */
                  (previewDoc.name.toLowerCase().match(/\.(txt|json|md|log|csv)$/) || previewDoc.file_type?.startsWith('text/')) ? (
                    <iframe 
                      src={previewUrl} 
                      title={previewDoc.name} 
                      width="100%" 
                      height="400px" 
                      style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '10px' }} 
                    />
                  ) : (
                    /* Fallback when preview not supported */
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      <FileText size={64} style={{ margin: '0 auto 16px', opacity: 0.5, color: 'var(--accent-color)' }} />
                      <h4 style={{ color: 'var(--text-primary)' }}>Vista previa no disponible</h4>
                      <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>No podemos previsualizar este tipo de archivo ({previewDoc.name.split('.').pop().toUpperCase()}) directamente en el navegador.</p>
                      <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => handleDownload(previewDoc)}>
                        <Download size={14} /> Descargar Archivo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--danger-color)' }}>Error al cargar el archivo.</div>
              )}
            </div>
            
            <div className="modal-footer" style={{ flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setPreviewDoc(null); setPreviewUrl(''); }}>Cerrar</button>
              {previewUrl && (
                <button type="button" className="btn btn-primary" onClick={() => handleDownload(previewDoc)}>
                  <Download size={14} /> Descargar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
