import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Search, X, Check, Globe, Mail, Phone, MapPin, ExternalLink, RefreshCw, Building, User, Link as LinkIcon } from 'lucide-react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Form states
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('company_name', { ascending: true });
      if (error) throw error;
      setSuppliers(data);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openAddModal = () => {
    setEditingSupplier(null);
    setCompanyName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setCountry('');
    setWebsite('');
    setNotes('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setCompanyName(supplier.company_name);
    setContactName(supplier.contact_name || '');
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setCountry(supplier.country || '');
    setWebsite(supplier.website || '');
    setNotes(supplier.notes || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payload = {
      company_name: companyName,
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      country: country || null,
      website: website || null,
      notes: notes || null,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editingSupplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      setError(err.message || 'Error al guardar el proveedor');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este proveedor? Esto también desvinculará pedidos y lotes relacionados.')) return;

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchSuppliers();
    } catch (err) {
      alert(err.message || 'Error al eliminar el proveedor');
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    return (
      s.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (s.country && s.country.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">Gestiona tu directorio de fabricantes e intermediarios de importación</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Añadir Proveedor
        </button>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Buscar por empresa, contacto, email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Mostrando {filteredSuppliers.length} proveedores
        </div>
      </div>

      {/* Grid view of suppliers (Linear/ClickUp style) */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <Globe size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>No se encontraron proveedores</h3>
          <p style={{ marginTop: '8px' }}>Registra un proveedor para asociarlo a tus pedidos de compra.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredSuppliers.map(s => (
            <div 
              key={s.id} 
              className="card" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '20px 24px', 
                gap: '20px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}
            >
              {/* Left section: Building Icon and Text content */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1, minWidth: 0 }}>
                {/* Building Icon Container */}
                <div 
                  style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    backgroundColor: 'rgba(59, 130, 246, 0.08)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--accent-color)',
                    border: '1px solid rgba(59, 130, 246, 0.15)',
                    flexShrink: 0
                  }}
                >
                  <Building size={20} />
                </div>

                {/* Text information */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                  {/* Company Name */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.company_name}
                  </h3>

                  {/* Sub-metadata row */}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {s.contact_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <span>{s.contact_name}</span>
                      </div>
                    )}
                    {s.country && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <span>{s.country}</span>
                      </div>
                    )}
                    {s.website && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LinkIcon size={14} style={{ color: 'var(--text-tertiary)' }} />
                        <a 
                          href={s.website.startsWith('http') ? s.website : `https://${s.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}
                        >
                          {s.website.replace(/(^\w+:|^)\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Note / Tag */}
                  {s.notes && (
                    <div style={{ display: 'flex', marginTop: '4px' }}>
                      <span 
                        style={{ 
                          fontSize: '0.75rem', 
                          backgroundColor: 'rgba(59, 130, 246, 0.12)', 
                          color: 'var(--accent-color)', 
                          padding: '4px 12px', 
                          borderRadius: '9999px',
                          fontWeight: '600'
                        }}
                      >
                        {s.notes.length > 60 ? s.notes.slice(0, 60) + '...' : s.notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right section: Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ 
                    padding: '8px', 
                    borderRadius: '8px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px'
                  }} 
                  onClick={() => openEditModal(s)}
                  title="Editar proveedor"
                >
                  <Edit2 size={14} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button 
                  className="btn btn-danger btn-sm" 
                  style={{ 
                    padding: '8px', 
                    borderRadius: '8px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.06)', 
                    border: '1px solid rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px'
                  }} 
                  onClick={() => handleDelete(s.id)}
                  title="Eliminar proveedor"
                >
                  <Trash2 size={14} style={{ color: 'var(--danger-color)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{editingSupplier ? 'Editar Proveedor' : 'Añadir Nuevo Proveedor'}</h3>
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
                  <label className="form-label">Nombre de la Empresa *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    placeholder="Ej. Shenzhen Electronics Co."
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Persona de Contacto</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={contactName} 
                    onChange={(e) => setContactName(e.target.value)} 
                    placeholder="Ej. Alice Lee"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Email de Contacto</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="alice@proveedor.com"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      placeholder="+86 138 0000 0000"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">País</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={country} 
                      onChange={(e) => setCountry(e.target.value)} 
                      placeholder="China"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sitio Web</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={website} 
                      onChange={(e) => setWebsite(e.target.value)} 
                      placeholder="www.proveedor.com"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notas o Términos comerciales</label>
                  <textarea 
                    className="form-textarea" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Términos de pago: FOB, 30% depósito / 70% previo al envío..."
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
