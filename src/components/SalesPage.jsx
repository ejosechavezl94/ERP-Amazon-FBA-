import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, Download, Trash2, ShoppingBag, ArrowUpRight, DollarSign } from "lucide-react";
import { Calendar, MonthPicker } from "./ui/Calendar";

const fmt = (n) =>
  Number(n).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

const mesActual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};

const EMPTY_SALE = { productId: "", quantity: 1, date: new Date().toISOString().split("T")[0], notes: "" };

export default function SalesPage() {
  const [mes, setMes] = useState(mesActual);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formS, setFormS] = useState(EMPTY_SALE);
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
    if (!window.confirm("¿Estás seguro de que quieres eliminar este registro de venta?")) return;

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
    <div className="gastos-wrap" style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div className="gastos-header">
        <div>
          <h2 className="gastos-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShoppingBag size={22} style={{ color: "var(--accent-color)" }} />
            Historial de Ventas
          </h2>
          <p className="gastos-sub">Transacciones registradas manualmente y canales externos</p>
        </div>
        <div className="gastos-header-actions">
          <MonthPicker value={mes} onChange={setMes} />
          <button className="g-btn-sec" onClick={exportCSV}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="gastos-metrics">
        <div className="gmetric">
          <span className="gmetric-label">Ingresos del mes</span>
          <span className="gmetric-value" style={{ color: "#10b981" }}>{fmt(totalRevenue)}</span>
        </div>
        <div className="gmetric">
          <span className="gmetric-label">Unidades vendidas</span>
          <span className="gmetric-value">{totalUnits} uds</span>
        </div>
        <div className="gmetric">
          <span className="gmetric-label">Margen estimado</span>
          <span className="gmetric-value">{fmt(totalProfit)}</span>
        </div>
        <div className="gmetric">
          <span className="gmetric-label">Ticket medio</span>
          <span className="gmetric-value">{fmt(averageTicket)}</span>
        </div>
      </div>

      {/* Action Header */}
      <div className="g-section-header">
        <p className="g-section-hint">
          Ventas del mes de <strong>{mes}</strong>. Estas ventas reducen automáticamente el inventario disponible.
        </p>
        <button className="g-btn-primary" onClick={() => { setError(""); setShowCalendar(false); setIsModalOpen(true); }}>
          <Plus size={14} /> Registrar Venta
        </button>
      </div>

      {/* Sales Table */}
      {loading ? (
        <p className="g-loading">Cargando ventas...</p>
      ) : sales.length === 0 ? (
        <div className="g-empty">No hay ventas registradas en este periodo.</div>
      ) : (
        <table className="g-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>SKU</th>
              <th>Producto</th>
              <th style={{ textAlign: "right" }}>Cantidad</th>
              <th style={{ textAlign: "right" }}>Precio Unitario</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th>Notas</th>
              <th style={{ width: "50px" }}></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="g-muted">{s.sale_date}</td>
                <td style={{ fontWeight: 600 }}>{s.products?.sku_internal}</td>
                <td>{s.products?.name}</td>
                <td style={{ textAlign: "right" }}>{s.quantity}</td>
                <td style={{ textAlign: "right" }}>{fmt(s.products?.target_price || 0)}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(s.quantity * (s.products?.target_price || 0))}</td>
                <td className="g-muted">{s.notes || "—"}</td>
                <td>
                  <button className="g-icon-btn" onClick={() => handleDeleteSale(s.id)} aria-label="Eliminar venta">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                onChange={e => setFormS({ ...formS, productId: e.target.value })}
                required
              >
                <option value="">Selecciona un producto...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>[{p.sku_internal}] {p.name}</option>
                ))}
              </select>
            </div>

            <div className="g-grid2">
              <div className="g-field">
                <label>Cantidad *</label>
                <input 
                  type="number" 
                  min="1" 
                  value={formS.quantity} 
                  onChange={e => setFormS({ ...formS, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="g-field" style={{ position: "relative" }}>
                <label>Fecha *</label>
                <input 
                  type="text" 
                  value={formS.date} 
                  readOnly 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCalendar(!showCalendar);
                  }}
                  style={{ cursor: "pointer" }}
                  required
                />
                {showCalendar && (
                  <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 120, marginTop: "4px" }}>
                    <div style={{ position: "fixed", inset: 0, zIndex: 119 }} onClick={(e) => {
                      e.stopPropagation();
                      setShowCalendar(false);
                    }} />
                    <div style={{ position: "relative", zIndex: 120 }}>
                      <Calendar 
                        selected={formS.date} 
                        onSelect={(date) => {
                          setFormS({ ...formS, date });
                          setShowCalendar(false);
                        }} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="g-field">
              <label>Notas (opcional)</label>
              <input 
                type="text" 
                placeholder="Canal de venta, detalles..." 
                value={formS.notes} 
                onChange={e => setFormS({ ...formS, notes: e.target.value })}
              />
            </div>

            <div className="g-modal-footer">
              <button className="g-btn-sec" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="g-btn-primary" onClick={handleRegisterSale} disabled={saving}>
                {saving ? "Registrando..." : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
