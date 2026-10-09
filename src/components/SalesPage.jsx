import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, Download, Trash2, ShoppingBag, ArrowUpRight, DollarSign } from "lucide-react";
import { Calendar, MonthPicker } from "./ui/Calendar";
import ConfirmDialog from "./ui/ConfirmDialog";

const fmt = (n) =>
  Number(n).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

const mesActual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};

const EMPTY_SALE = { productId: "", quantity: 1, date: new Date().toISOString().split("T")[0], notes: "", warehouseType: "LOCAL" };

export default function SalesPage() {
  const [mes, setMes] = useState(mesActual);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formS, setFormS] = useState(EMPTY_SALE);
  const [saleToDelete, setSaleToDelete] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSales();
    fetchProducts();
  }, [mes]);

  async function fetchSales() {
    setLoading(true);
    try {
      const [year, month] = mes.split("-").map(Number);
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonthVal = month === 12 ? 1 : month + 1;
      const nextMonthStr = `${nextYear}-${String(nextMonthVal).padStart(2, "0")}`;

      const { data, error: err } = await supabase
        .from("sales")
        .select(`
          *,
          products (
            id,
            name,
            sku_internal,
            target_price,
            cost_total
          )
        `)
        .gte("sale_date", `${mes}-01`)
        .lt("sale_date", `${nextMonthStr}-01`)
        .order("sale_date", { ascending: false });

      if (err) throw err;
      setSales(data || []);
    } catch (err) {
      console.error("Error fetching sales:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku_internal, target_price")
        .eq("status", "Active")
        .order("name", { ascending: true });
      setProducts(data || []);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }

  // Calculate metrics
  const totalRevenue = sales.reduce((sum, s) => sum + (s.quantity * (s.products?.target_price || 0)), 0);
  const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.quantity * ((s.products?.target_price || 0) - (s.products?.cost_total || 0))), 0);
  const averageTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

  async function handleRegisterSale(e) {
    e.preventDefault();
    setError("");
    if (!formS.productId || !formS.quantity || !formS.date) {
      setError("Por favor completa los campos obligatorios.");
      return;
    }
    setSaving(true);

    try {
      // 1. Insert into sales
      const { error: saleErr } = await supabase
        .from("sales")
        .insert([{
          product_id: formS.productId,
          sale_date: formS.date,
          quantity: parseInt(formS.quantity, 10),
          notes: formS.notes.trim() || null,
          warehouse_type: formS.warehouseType || 'LOCAL',
          user_id: (await supabase.auth.getSession()).data.session?.user?.id
        }]);

      if (saleErr) throw saleErr;

      setIsModalOpen(false);
      setFormS(EMPTY_SALE);
      setShowCalendar(false);
      fetchSales();
    } catch (err) {
      setError(err.message || "Error al registrar la venta");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSale(id) {
    try {
      const { error: err } = await supabase
        .from("sales")
        .delete()
        .eq("id", id);
      if (err) throw err;
      fetchSales();
    } catch (err) {
      alert("Error al eliminar la venta: " + err.message);
    }
  }

  function exportCSV() {
    const rows = sales.map(s => `"${s.sale_date}","${s.products?.sku_internal || ""}","${s.products?.name || ""}","${s.quantity}","${Number(s.products?.target_price || 0).toFixed(2)}","${Number(s.quantity * (s.products?.target_price || 0)).toFixed(2)}","${s.notes || ""}"`);
    const csv = [
      "Fecha,SKU,Producto,Cantidad,Precio Unitario,Total,Notas",
      ...rows
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `ventas_${mes}.csv`;
    a.click();
  }

  return (
    <div className="gastos-wrap" style={{ maxWidth: "1200px", animation: 'fadeIn 0.2s ease-out' }}>
      {/* Header */}
      <div className="gastos-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 600, 
              color: 'var(--accent-color)', 
              letterSpacing: '0.05em', 
              textTransform: 'uppercase' 
            }}>Registro Comercial & ROI</span>
          </div>
          <h2 className="gastos-title" style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em', display: "flex", alignItems: "center", gap: "10px" }}>
            <ShoppingBag size={22} style={{ color: "var(--accent-color)" }} />
            Historial de Ventas
          </h2>
          <p className="gastos-sub">Transacciones comerciales registradas en canales Amazon FBA y locales</p>
        </div>
        <div className="gastos-header-actions">
          <MonthPicker value={mes} onChange={setMes} />
          <button className="g-btn-sec" onClick={exportCSV} style={{ borderRadius: '10px' }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="gastos-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="gmetric" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <span className="gmetric-label" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Ingresos del Mes</span>
          <span className="gmetric-value" style={{ color: "#10b981", fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700 }}>{fmt(totalRevenue)}</span>
        </div>
        <div className="gmetric" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <span className="gmetric-label" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Unidades Vendidas</span>
          <span className="gmetric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700 }}>{totalUnits} uds</span>
        </div>
        <div className="gmetric" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <span className="gmetric-label" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Margen Bruto Est.</span>
          <span className="gmetric-value" style={{ color: 'var(--accent-color)', fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700 }}>{fmt(totalProfit)}</span>
        </div>
        <div className="gmetric" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <span className="gmetric-label" style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Ticket Medio</span>
          <span className="gmetric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700 }}>{fmt(averageTicket)}</span>
        </div>
      </div>

      {/* Action Header */}
      <div className="g-section-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'var(--surface-color)',
        padding: '16px 20px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px'
      }}>
        <p className="g-section-hint" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Ventas acumuladas en <strong>{mes}</strong>. El inventario se descuenta en tiempo real.
        </p>
        <button className="g-btn-primary" onClick={() => { setError(""); setShowCalendar(false); setIsModalOpen(true); }} style={{ boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)', borderRadius: '10px' }}>
          <Plus size={14} /> Registrar Venta
        </button>
      </div>

      {/* Sales Table */}
      {loading ? (
        <p className="g-loading" style={{ textAlign: 'center', padding: '40px' }}>Cargando ventas...</p>
      ) : sales.length === 0 ? (
        <div className="card empty-state" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', borderRadius: '16px' }}>
          <ShoppingBag size={48} style={{ margin: '0 auto 16px', opacity: 0.4, color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>No se encontraron ventas</h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No hay transacciones registradas en este periodo.</p>
        </div>
      ) : (
        <div className="table-container" style={{ borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <table className="g-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Fecha</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>SKU</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Producto & Almacén</th>
                <th style={{ padding: '14px 16px', textAlign: "right", fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Cantidad</th>
                <th style={{ padding: '14px 16px', textAlign: "right", fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Precio Unit.</th>
                <th style={{ padding: '14px 16px', textAlign: "right", fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Total Ingreso</th>
                <th style={{ padding: '14px 16px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Notas</th>
                <th style={{ width: "50px", padding: '14px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.sale_date}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>
                    <span style={{ 
                      background: 'rgba(245, 158, 11, 0.08)', 
                      color: 'var(--text-primary)', 
                      padding: '4px 8px', 
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.2)'
                    }}>
                      {s.products?.sku_internal}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{s.products?.name}</span>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        padding: '2px 8px', 
                        borderRadius: '10px',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        background: s.warehouse_type === 'FBA' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                        color: s.warehouse_type === 'FBA' ? '#f59e0b' : 'var(--text-secondary)'
                      }}>
                        {s.warehouse_type || 'LOCAL'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: "right", fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.quantity}</td>
                  <td style={{ padding: '14px 16px', textAlign: "right", fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{fmt(s.products?.target_price || 0)}</td>
                  <td style={{ padding: '14px 16px', textAlign: "right", fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#10b981' }}>{fmt(s.quantity * (s.products?.target_price || 0))}</td>
                  <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.notes || "—"}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <button className="g-icon-btn" onClick={() => setSaleToDelete(s.id)} aria-label="Eliminar venta" style={{ borderRadius: '8px' }}>
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Sale Modal */}
      {isModalOpen && (
        <div className="g-modal-bg" onClick={() => setIsModalOpen(false)}>
          <div className="g-modal" onClick={e => e.stopPropagation()}>
            <h3 className="g-modal-title">Registrar Venta</h3>
            <p className="g-modal-hint">Añade una venta manual. El stock del catálogo se actualizará automáticamente.</p>
            {error && <p className="g-error">{error}</p>}
            
            <div className="g-field">
              <label>Producto *</label>
              <select 
                value={formS.productId} 
                onChange={e => setFormS(prev => ({ ...prev, productId: e.target.value }))}
              >
                <option value="">Selecciona un producto...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku_internal})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="g-field">
                <label>Cantidad *</label>
                <input 
                  type="number" 
                  min="1" 
                  value={formS.quantity} 
                  onChange={e => setFormS(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} 
                />
              </div>
              <div className="g-field" style={{ position: "relative" }}>
                <label>Fecha *</label>
                <input 
                  type="text" 
                  value={formS.date} 
                  readOnly 
                  onClick={() => setShowCalendar(!showCalendar)}
                  style={{ cursor: "pointer" }}
                />
                {showCalendar && (
                  <div style={{ position: "absolute", zIndex: 10, top: "100%", left: 0, backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                    <Calendar 
                      selectedDate={formS.date} 
                      onSelectDate={d => {
                        setFormS(prev => ({ ...prev, date: d }));
                        setShowCalendar(false);
                      }} 
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="g-field">
              <label>Notas / Canal de venta</label>
              <textarea 
                placeholder="Ej. Venta física en tienda, pedido web" 
                value={formS.notes} 
                onChange={e => setFormS(prev => ({ ...prev, notes: e.target.value }))} 
              />
            </div>

            <div className="g-modal-foot">
              <button className="g-btn g-btn-sec" onClick={() => { setIsModalOpen(false); setFormS(EMPTY_SALE); setShowCalendar(false); }}>
                Cancelar
              </button>
              <button 
                className="g-btn g-btn-pri" 
                onClick={handleRegisterSale}
                disabled={saving || !formS.productId || formS.quantity <= 0}
              >
                {saving ? "Guardando..." : "Guardar Venta"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={!!saleToDelete}
        onClose={() => setSaleToDelete(null)}
        onConfirm={() => handleDeleteSale(saleToDelete)}
        title="Eliminar Venta"
        description="¿Estás seguro de que quieres eliminar este registro de venta? Esto revertirá de forma automática el stock correspondiente del inventario."
        confirmText="Eliminar"
      />
    </div>
  );
}
