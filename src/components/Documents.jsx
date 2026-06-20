import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Search, X, Check, FileText, Download, Link, RefreshCw } from 'lucide-react';

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
      const { error: dbError } = await supabase
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
        }]);

      if (dbError) throw dbError;

      setIsModalOpen(false);
      setFile(null);
      setNotes('');
      setProductId('');
      setSupplierId('');
      setOrderId('');
      setBatchId('');
      fetchDocuments();
    } catch (err) {
      setError(err.message || 'Error durante la subida del documento');
    } finally {
      setUploading(false);
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

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar documentos..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select 
            className="form-select" 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="All">Todas las Categorías</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Mostrando {filteredDocs.length} documentos
        </div>
      </div>

      {/* Documents Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>No hay documentos guardados</h3>
          <p style={{ marginTop: '8px' }}>Sube facturas, contratos o fotos de aduanas vinculadas a tus pedidos.</p>
        </div>
      ) : (
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
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
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
                      <button className="btn btn-secondary btn-sm btn-icon-only" onClick={() => handleDownload(doc)} title="Descargar de manera segura">
                        <Download size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm btn-icon-only" onClick={() => handleDelete(doc)}>
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
    </div>
  );
}
