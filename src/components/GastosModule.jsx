import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Plus, Download, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Calendar, MonthPicker } from "./ui/Calendar";

const CATEGORIAS = [
  "Amazon fees", "Herramientas", "Empaquetado",
  "Logística", "Marketing", "Diseño / contenido", "Muestras", "Otros"
];

const fmt = (n) =>
  Number(n).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";

const mesActual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};

const EMPTY_FIJO     = { concepto: "", categoria: "", importe: "" };
const EMPTY_VARIABLE = { concepto: "", categoria: "", importe: "", fecha: new Date().toISOString().split("T")[0], notas: "" };

export default function GastosModule() {
  const [tab, setTab]               = useState("fijos");
  const [mes, setMes]               = useState(mesActual);
  const [fijos, setFijos]           = useState([]);
  const [variables, setVariables]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalTipo, setModalTipo]   = useState(null); // "fijo" | "variable"
  const [formF, setFormF]           = useState(EMPTY_FIJO);
  const [formV, setFormV]           = useState(EMPTY_VARIABLE);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => { fetchAll(); }, [mes]);

  async function fetchAll() {
    setLoading(true);
    const [year, month] = mes.split("-").map(Number);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthVal = month === 12 ? 1 : month + 1;
    const nextMonthStr = `${nextYear}-${String(nextMonthVal).padStart(2, "0")}`;

    const [{ data: f }, { data: v }] = await Promise.all([
      supabase.from("gastos_fijos").select("*").order("created_at"),
      supabase.from("gastos_variables").select("*")
        .gte("fecha", `${mes}-01`)
        .lt("fecha", `${nextMonthStr}-01`)
        .order("fecha", { ascending: false }),
    ]);
    setFijos(f || []);
    setVariables(v || []);
    setLoading(false);
  }

  // ── Totales ──────────────────────────────────────────────
  const totalFijos     = fijos.filter(g => g.activo).reduce((s, g) => s + Number(g.importe), 0);
  const totalVariables = variables.reduce((s, g) => s + Number(g.importe), 0);
  const totalMes       = totalFijos + totalVariables;

  // ── Guardar fijo ─────────────────────────────────────────
  async function saveFijo() {
    setError("");
    if (!formF.concepto.trim() || !formF.categoria || !formF.importe) {
      setError("Todos los campos son obligatorios."); return;
    }
    setSaving(true);
    const { error: e } = await supabase.from("gastos_fijos").insert([{
      concepto: formF.concepto.trim(),
      categoria: formF.categoria,
      importe: parseFloat(formF.importe),
    }]);
    setSaving(false);
    if (e) { setError(e.message); return; }
    setFormF(EMPTY_FIJO);
    setModalTipo(null);
    fetchAll();
  }

  // ── Guardar variable ─────────────────────────────────────
  async function saveVariable() {
    setError("");
    if (!formV.concepto.trim() || !formV.categoria || !formV.importe) {
      setError("Todos los campos son obligatorios."); return;
    }
    setSaving(true);
    const { error: e } = await supabase.from("gastos_variables").insert([{
      concepto: formV.concepto.trim(),
      categoria: formV.categoria,
      importe: parseFloat(formV.importe),
      fecha: formV.fecha,
      notas: formV.notas.trim() || null,
    }]);
    setSaving(false);
    if (e) { setError(e.message); return; }
    setFormV(EMPTY_VARIABLE);
    setModalTipo(null);
    fetchAll();
  }

  // ── Toggle fijo activo ────────────────────────────────────
  async function toggleFijo(id, activo) {
    await supabase.from("gastos_fijos").update({ activo: !activo }).eq("id", id);
    setFijos(prev => prev.map(g => g.id === id ? { ...g, activo: !activo } : g));
  }

  // ── Eliminar ──────────────────────────────────────────────
  async function deleteFijo(id) {
    await supabase.from("gastos_fijos").delete().eq("id", id);
    setFijos(prev => prev.filter(g => g.id !== id));
  }
  async function deleteVariable(id) {
    await supabase.from("gastos_variables").delete().eq("id", id);
    setVariables(prev => prev.filter(g => g.id !== id));
  }

  // ── Exportar CSV ──────────────────────────────────────────
  function exportCSV() {
    const fijoRows = fijos
      .filter(g => g.activo)
      .map(g => `"${g.concepto}","${g.categoria}","fijo","mensual","${Number(g.importe).toFixed(2)}","${mes}",""`);
    const varRows = variables
      .map(g => `"${g.concepto}","${g.categoria}","variable","único","${Number(g.importe).toFixed(2)}","${g.fecha}","${g.notas || ""}"`);
    const csv = [
      "Concepto,Categoría,Tipo,Frecuencia,Importe,Fecha,Notas",
      ...fijoRows, ...varRows
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `gastos_${mes}.csv`;
    a.click();
  }

  return (
    <div className="gastos-wrap">

      {/* ── Header ── */}
      <div className="gastos-header">
        <div>
          <h2 className="gastos-title">Gestión de gastos</h2>
          <p className="gastos-sub">Seoul Kkachi Corp — Amazon.es</p>
        </div>
        <div className="gastos-header-actions">
          <MonthPicker
            value={mes}
            onChange={setMes}
          />
          <button className="g-btn-sec" onClick={exportCSV}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Métricas ── */}
      <div className="gastos-metrics">
        <div className="gmetric">
          <span className="gmetric-label">Total del mes</span>
          <span className="gmetric-value gmetric-total">{fmt(totalMes)}</span>
        </div>
        <div className="gmetric">
          <span className="gmetric-label">Gastos fijos activos</span>
          <span className="gmetric-value">{fmt(totalFijos)}</span>
        </div>
        <div className="gmetric">
          <span className="gmetric-label">Gastos variables ({mes})</span>
          <span className="gmetric-value">{fmt(totalVariables)}</span>
        </div>
        <div className="gmetric">
          <span className="gmetric-label">Registros variables</span>
          <span className="gmetric-value">{variables.length}</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="gastos-tabs">
        <button
          className={`gtab ${tab === "fijos" ? "gtab-active" : ""}`}
          onClick={() => setTab("fijos")}
        >
          Fijos <span className="gtab-count">{fijos.length}</span>
        </button>
        <button
          className={`gtab ${tab === "variables" ? "gtab-active" : ""}`}
          onClick={() => setTab("variables")}
        >
          Variables <span className="gtab-count">{variables.length}</span>
        </button>
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <p className="g-loading">Cargando...</p>
      ) : tab === "fijos" ? (
        <>
          <div className="g-section-header">
            <p className="g-section-hint">
              Los gastos fijos se suman automáticamente cada mes mientras estén activos.
            </p>
            <button className="g-btn-primary" onClick={() => { setError(""); setModalTipo("fijo"); }}>
              <Plus size={14} /> Añadir fijo
            </button>
          </div>

          {fijos.length === 0 ? (
            <div className="g-empty">Sin gastos fijos. Añade el primero.</div>
          ) : (
            <table className="g-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th style={{ textAlign: "right" }}>Importe / mes</th>
                  <th style={{ textAlign: "center" }}>Activo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fijos.map(g => (
                  <tr key={g.id} className={!g.activo ? "g-row-inactive" : ""}>
                    <td className="g-concepto">{g.concepto}</td>
                    <td><span className="g-badge g-badge-cat">{g.categoria}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt(g.importe)}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="g-toggle"
                        onClick={() => toggleFijo(g.id, g.activo)}
                        aria-label={g.activo ? "Desactivar" : "Activar"}
                      >
                        {g.activo
                          ? <ToggleRight size={20} style={{ color: "#1D9E75" }} />
                          : <ToggleLeft size={20} style={{ color: "#888" }} />
                        }
                      </button>
                    </td>
                    <td>
                      <button className="g-icon-btn" onClick={() => deleteFijo(g.id)} aria-label="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <>
          <div className="g-section-header">
            <p className="g-section-hint">
              Gastos puntuales del mes <strong>{mes}</strong>.
            </p>
            <button className="g-btn-primary" onClick={() => { setError(""); setShowCalendar(false); setModalTipo("variable"); }}>
              <Plus size={14} /> Añadir variable
            </button>
          </div>

          {variables.length === 0 ? (
            <div className="g-empty">Sin gastos variables este mes.</div>
          ) : (
            <table className="g-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Categoría</th>
                  <th>Fecha</th>
                  <th>Notas</th>
                  <th style={{ textAlign: "right" }}>Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variables.map(g => (
                  <tr key={g.id}>
                    <td className="g-concepto">{g.concepto}</td>
                    <td><span className="g-badge g-badge-cat">{g.categoria}</span></td>
                    <td className="g-muted">{g.fecha}</td>
                    <td className="g-muted">{g.notas || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt(g.importe)}</td>
                    <td>
                      <button className="g-icon-btn" onClick={() => deleteVariable(g.id)} aria-label="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* ── Modal Fijo ── */}
      {modalTipo === "fijo" && (
        <div className="g-modal-bg" onClick={() => setModalTipo(null)}>
          <div className="g-modal" onClick={e => e.stopPropagation()}>
            <h3 className="g-modal-title">Nuevo gasto fijo</h3>
            <p className="g-modal-hint">Se sumará automáticamente cada mes mientras esté activo.</p>
            {error && <p className="g-error">{error}</p>}
            <div className="g-field">
              <label>Concepto *</label>
              <input type="text" placeholder="Ej: Mensualidad Seller Central"
                value={formF.concepto} onChange={e => setFormF({ ...formF, concepto: e.target.value })} />
            </div>
            <div className="g-grid2">
              <div className="g-field">
                <label>Categoría *</label>
                <select value={formF.categoria} onChange={e => setFormF({ ...formF, categoria: e.target.value })}>
                  <option value="">Selecciona...</option>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="g-field">
                <label>Importe mensual (€) *</label>
                <input type="number" min="0" step="0.01" placeholder="0.00"
                  value={formF.importe} onChange={e => setFormF({ ...formF, importe: e.target.value })} />
              </div>
            </div>
            <div className="g-modal-footer">
              <button className="g-btn-sec" onClick={() => setModalTipo(null)}>Cancelar</button>
              <button className="g-btn-primary" onClick={saveFijo} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Variable ── */}
      {modalTipo === "variable" && (
        <div className="g-modal-bg" onClick={() => setModalTipo(null)}>
          <div className="g-modal" onClick={e => e.stopPropagation()}>
            <h3 className="g-modal-title">Nuevo gasto variable</h3>
            <p className="g-modal-hint">Gasto puntual — quedará registrado en el mes de su fecha.</p>
            {error && <p className="g-error">{error}</p>}
            <div className="g-field">
              <label>Concepto *</label>
              <input type="text" placeholder="Ej: Cajas empaquetado lote 1"
                value={formV.concepto} onChange={e => setFormV({ ...formV, concepto: e.target.value })} />
            </div>
            <div className="g-grid2">
              <div className="g-field">
                <label>Categoría *</label>
                <select value={formV.categoria} onChange={e => setFormV({ ...formV, categoria: e.target.value })}>
                  <option value="">Selecciona...</option>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="g-field">
                <label>Importe (€) *</label>
                <input type="number" min="0" step="0.01" placeholder="0.00"
                  value={formV.importe} onChange={e => setFormV({ ...formV, importe: e.target.value })} />
              </div>
            </div>
             <div className="g-grid2" style={{ overflow: "visible" }}>
              <div className="g-field" style={{ position: "relative" }}>
                <label>Fecha</label>
                <input 
                  type="text" 
                  value={formV.fecha} 
                  readOnly 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCalendar(!showCalendar);
                  }}
                  style={{ cursor: "pointer" }}
                  placeholder="Selecciona fecha..."
                />
                {showCalendar && (
                  <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 120, marginTop: "4px" }}>
                    <div style={{ position: "fixed", inset: 0, zIndex: 119 }} onClick={(e) => {
                      e.stopPropagation();
                      setShowCalendar(false);
                    }} />
                    <div style={{ position: "relative", zIndex: 120 }}>
                      <Calendar 
                        selected={formV.fecha} 
                        onSelect={(date) => {
                          setFormV({ ...formV, fecha: date });
                          setShowCalendar(false);
                        }} 
                        captionLayout="dropdown"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="g-field">
                <label>Notas (opcional)</label>
                <input type="text" placeholder="Detalle adicional..."
                  value={formV.notas} onChange={e => setFormV({ ...formV, notas: e.target.value })} />
              </div>
            </div>
            <div className="g-modal-footer">
              <button className="g-btn-sec" onClick={() => setModalTipo(null)}>Cancelar</button>
              <button className="g-btn-primary" onClick={saveVariable} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
