import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Search, X, Package, Globe, ShoppingCart, CheckSquare } from 'lucide-react';

export default function GlobalSearch({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({
    products: [],
    suppliers: [],
    orders: [],
    tasks: []
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults({ products: [], suppliers: [], orders: [], tasks: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], suppliers: [], orders: [], tasks: [] });
      return;
    }

    const delayDebounce = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    const searchTerm = `%${query}%`;
    try {
      // 1. Search products
      const pSearch = supabase
        .from('products')
        .select('id, name, sku_internal, brand')
        .or(`name.ilike.${searchTerm},sku_internal.ilike.${searchTerm},brand.ilike.${searchTerm}`)
        .limit(5);

      // 2. Search suppliers
      const sSearch = supabase
        .from('suppliers')
        .select('id, company_name, contact_name, country')
        .or(`company_name.ilike.${searchTerm},contact_name.ilike.${searchTerm},country.ilike.${searchTerm}`)
        .limit(5);

      // 3. Search purchase orders
      const oSearch = supabase
        .from('purchase_orders')
        .select('id, order_number, products(name)')
        .or(`order_number.ilike.${searchTerm}`)
        .limit(5);

      // 4. Search tasks
      const tSearch = supabase
        .from('tasks')
        .select('id, title, status')
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .limit(5);

      const [pRes, sRes, oRes, tRes] = await Promise.all([pSearch, sSearch, oSearch, tSearch]);

      setResults({
        products: pRes.data || [],
        suppliers: sRes.data || [],
        orders: oRes.data || [],
        tasks: tRes.data || []
      });
    } catch (err) {
      console.error('Error during global search:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (module, id) => {
    onNavigate(module);
    onClose();
  };

  if (!isOpen) return null;

  const totalResults = 
    results.products.length + 
    results.suppliers.length + 
    results.orders.length + 
    results.tasks.length;

  return (
    <div className="search-modal" onClick={onClose}>
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-input-container">
          <Search size={20} style={{ color: 'var(--text-tertiary)' }} />
          <input 
            type="text" 
            className="search-modal-input" 
            placeholder="Buscar productos, proveedores, órdenes, tareas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            ref={inputRef}
          />
          {loading ? (
            <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
          ) : (
            <button className="action-btn" onClick={onClose}><X size={18} /></button>
          )}
        </div>

        <div className="search-modal-results">
          {query && totalResults === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              No se encontraron resultados para "{query}"
            </div>
          )}

          {!query && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              Escribe algo para buscar en toda la plataforma...
            </div>
          )}

          {/* Products Group */}
          {results.products.length > 0 && (
            <div className="search-result-group">
              <div className="search-result-group-title">Productos</div>
              {results.products.map(p => (
                <div key={p.id} className="search-result-item" onClick={() => handleSelect('products', p.id)}>
                  <div className="search-result-text">
                    <span className="search-result-main">{p.name}</span>
                    <span className="search-result-sub">SKU: {p.sku_internal} {p.brand ? `• Marca: ${p.brand}` : ''}</span>
                  </div>
                  <Package size={16} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              ))}
            </div>
          )}

          {/* Suppliers Group */}
          {results.suppliers.length > 0 && (
            <div className="search-result-group">
              <div className="search-result-group-title">Proveedores</div>
              {results.suppliers.map(s => (
                <div key={s.id} className="search-result-item" onClick={() => handleSelect('suppliers', s.id)}>
                  <div className="search-result-text">
                    <span className="search-result-main">{s.company_name}</span>
                    <span className="search-result-sub">{s.contact_name ? `Contacto: ${s.contact_name} ` : ''}{s.country ? `• País: ${s.country}` : ''}</span>
                  </div>
                  <Globe size={16} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              ))}
            </div>
          )}

          {/* Orders Group */}
          {results.orders.length > 0 && (
            <div className="search-result-group">
              <div className="search-result-group-title">Pedidos de Compra</div>
              {results.orders.map(o => (
                <div key={o.id} className="search-result-item" onClick={() => handleSelect('orders', o.id)}>
                  <div className="search-result-text">
                    <span className="search-result-main">PO-{o.order_number}</span>
                    <span className="search-result-sub">{o.products?.name}</span>
                  </div>
                  <ShoppingCart size={16} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              ))}
            </div>
          )}

          {/* Tasks Group */}
          {results.tasks.length > 0 && (
            <div className="search-result-group">
              <div className="search-result-group-title">Tareas</div>
              {results.tasks.map(t => (
                <div key={t.id} className="search-result-item" onClick={() => handleSelect('tasks', t.id)}>
                  <div className="search-result-text">
                    <span className="search-result-main">{t.title}</span>
                    <span className="search-result-sub">Estado: {t.status}</span>
                  </div>
                  <CheckSquare size={16} style={{ color: 'var(--text-tertiary)' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
