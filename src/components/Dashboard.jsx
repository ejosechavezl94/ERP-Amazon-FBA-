import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  TrendingUp, AlertTriangle, Package, ShoppingCart, 
  RefreshCw, Clock 
} from 'lucide-react';
import { MonthPicker } from './ui/Calendar';

const mesActual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};

export default function Dashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalInventoryValue: 0,
    lowStockCount: 0,
    activeOrdersCount: 0,
    pendingTasksCount: 0,
    recentExpenses: 0,
    totalSalesMonth: 0,
    totalSalesMonthUnits: 0,
  });
  const [alerts, setAlerts] = useState([]);
  const [recentPO, setRecentPO] = useState([]);
  const [urgentTasks, setUrgentTasks] = useState([]);
  const [mes, setMes] = useState(mesActual);

  useEffect(() => {
    fetchDashboardData();
  }, [mes]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Inventory Details for Value and Low Stock
      const { data: inventoryData, error: invError } = await supabase
        .from('view_inventory_details')
        .select('*');
      if (invError) throw invError;

      let totalVal = 0;
      let lowStock = [];
      inventoryData.forEach(item => {
        totalVal += parseFloat(item.inventory_value || 0);
        if (item.stock_available < item.stock_min) {
          lowStock.push(item);
        }
      });

      // 2. Fetch Active Purchase Orders (not Recibido and not Cerrado)
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('*, products(name), suppliers(company_name)')
        .order('created_at', { ascending: false });
      if (poError) throw poError;

      const activePOs = poData.filter(po => po.status !== 'Cerrado' && po.status !== 'Recibido');
      const totalActivePOCost = activePOs.reduce((acc, curr) => acc + parseFloat(curr.total_cost || 0), 0);

      // 3. Fetch Tasks (Pending and incomplete)
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*');
      if (tasksError) throw tasksError;

      const pendingTasks = tasksData.filter(t => t.status !== 'Completado');

      // 4. Generate Alerts
      const generatedAlerts = [];
      
      // Stock Alerts
      lowStock.forEach(item => {
        generatedAlerts.push({
          id: `stock-${item.id}`,
          type: 'danger',
          message: `Producto "${item.product_name}" tiene stock bajo (${item.stock_available} disp. / Mín: ${item.stock_min})`,
          category: 'Stock'
        });
      });

      // Overdue Tasks Alerts
      const today = new Date().toISOString().split('T')[0];
      pendingTasks.forEach(task => {
        if (task.due_date && task.due_date < today) {
          generatedAlerts.push({
            id: `task-${task.id}`,
            type: 'warning',
            message: `Tarea vencida: "${task.title}" (Vencimiento: ${task.due_date})`,
            category: 'Tarea'
          });
        }
      });

      // Delayed PO Alerts (if estimated_arrival is in past and status is not Recibido/Cerrado)
      activePOs.forEach(po => {
        if (po.estimated_arrival && po.estimated_arrival < today) {
          generatedAlerts.push({
            id: `po-${po.id}`,
            type: 'danger',
            message: `Pedido retrasado: PO-${po.order_number} de ${po.suppliers?.company_name || 'Proveedor'} (Llegada estimada: ${po.estimated_arrival})`,
            category: 'Pedido'
          });
        }
      });

      // 5. Fetch Sales for current month
      const [year, month] = mes.split("-").map(Number);
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonthVal = month === 12 ? 1 : month + 1;
      const nextMonthStr = `${nextYear}-${String(nextMonthVal).padStart(2, "0")}`;

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*, products(target_price)')
        .gte('sale_date', `${mes}-01`)
        .lt('sale_date', `${nextMonthStr}-01`);

      if (salesError) throw salesError;

      let salesTotal = 0;
      let salesUnits = 0;
      if (salesData) {
        salesData.forEach(sale => {
          salesUnits += sale.quantity;
          salesTotal += sale.quantity * (sale.products?.target_price || 0);
        });
      }

      setMetrics({
        totalInventoryValue: totalVal,
        lowStockCount: lowStock.length,
        activeOrdersCount: activePOs.length,
        pendingTasksCount: pendingTasks.length,
        recentExpenses: totalActivePOCost,
        totalSalesMonth: salesTotal,
        totalSalesMonthUnits: salesUnits,
      });

      setAlerts(generatedAlerts);
      setRecentPO(poData.slice(0, 5));
      setUrgentTasks(pendingTasks.slice(0, 5));

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {/* Header with Title and Global Actions */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ margin: 0, fontSize: 'clamp(1.4rem, 4vw, 1.75rem)', fontWeight: 700, letterSpacing: '-0.025em' }}>
            Resumen general
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Ventas, inventario disponible y pedidos en curso
          </p>
        </div>

        <div className="dashboard-actions-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          <div className="dashboard-month-wrap" style={{ display: 'flex', alignItems: 'center' }}>
            <MonthPicker value={mes} onChange={setMes} />
          </div>
          <button 
            className="btn btn-secondary btn-sm dashboard-refresh-btn" 
            onClick={fetchDashboardData}
            title="Actualizar datos del panel"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '38px', whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            <span>Actualizar</span>
          </button>
          <button 
            className="btn btn-primary btn-sm dashboard-newpo-btn" 
            onClick={() => onNavigate('orders')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, height: '38px', whiteSpace: 'nowrap' }}
          >
            <ShoppingCart size={14} /> 
            <span>Nuevo pedido PO</span>
          </button>
        </div>
      </div>

      {/* Hero Metrics KPI Cards (4 Grid) */}
      <div className="grid-cols-4" style={{ gap: '12px', marginBottom: 0 }}>
        
        {/* Metric 1: Ventas del Mes */}
        <div className="card metric-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
          <span className="metric-label" style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
            Ventas del mes
          </span>
          <span className="metric-value tabular-num" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatCurrency(metrics.totalSalesMonth)}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            {metrics.totalSalesMonthUnits} {metrics.totalSalesMonthUnits === 1 ? 'unidad vendida' : 'unidades vendidas'}
          </span>
        </div>

        {/* Metric 2: Valor Total de Inventario */}
        <div 
          className="card metric-card" 
          onClick={() => onNavigate('inventory')}
          style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px', minWidth: 0, cursor: 'pointer' }}
        >
          <span className="metric-label" style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
            Valor de inventario
          </span>
          <span className="metric-value tabular-num" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatCurrency(metrics.totalInventoryValue)}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            Stock disponible en Amazon FBA
          </span>
        </div>

        {/* Metric 3: Alertas de Stock Bajo / Reposición */}
        <div 
          className="card metric-card" 
          onClick={() => onNavigate('inventory')}
          style={{ 
            padding: '18px', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            gap: '8px', 
            minWidth: 0,
            cursor: 'pointer',
            borderColor: metrics.lowStockCount > 0 ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-color)',
            backgroundColor: metrics.lowStockCount > 0 ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-secondary)'
          }}
        >
          <span className="metric-label" style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
            Stock bajo
          </span>
          <span className="metric-value tabular-num" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)', fontWeight: 700, color: metrics.lowStockCount > 0 ? 'var(--danger-color)' : 'var(--text-primary)', letterSpacing: '-0.03em', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {metrics.lowStockCount} {metrics.lowStockCount === 1 ? 'producto' : 'productos'}
          </span>
          <span style={{ fontSize: '0.78rem', color: metrics.lowStockCount > 0 ? 'var(--danger-color)' : 'var(--text-tertiary)', fontWeight: 500 }}>
            {metrics.lowStockCount > 0 ? 'Requiere reposición' : 'Niveles óptimos'}
          </span>
        </div>

        {/* Metric 4: Pedidos PO Activos */}
        <div 
          className="card metric-card" 
          onClick={() => onNavigate('orders')}
          style={{ padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px', minWidth: 0, cursor: 'pointer' }}
        >
          <span className="metric-label" style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
            Pedidos en curso
          </span>
          <span className="metric-value tabular-num" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {metrics.activeOrdersCount}
          </span>
          <span className="tabular-num" style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            En tránsito: {formatCurrency(metrics.recentExpenses)}
          </span>
        </div>

      </div>

      {/* FBA Health & Critical Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{ 
          padding: '16px', 
          borderRadius: 'var(--border-radius-lg)', 
          backgroundColor: 'rgba(239, 68, 68, 0.04)', 
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          minWidth: 0,
          maxWidth: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={18} style={{ color: 'var(--danger-color)' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Radar de Alertas Operativas ({alerts.length})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-word' }}>
                {alerts[0].message}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => onNavigate('inventory')}
              style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
            >
              Ver Inventario
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={() => onNavigate('orders')}
              style={{ fontSize: '0.78rem', backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)', color: '#fff', whiteSpace: 'nowrap' }}
            >
              Crear Orden PO
            </button>
          </div>
        </div>
      )}

      {/* Main Operational Grid (2 Columns) */}
      <div className="grid-cols-2" style={{ gap: '16px', marginBottom: 0 }}>
        
        {/* Column 1: Recent Purchase Orders */}
        <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Pedidos de compra recientes</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Últimas órdenes a proveedores</p>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => onNavigate('orders')}
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Ver todos
            </button>
          </div>

          {recentPO.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No hay pedidos de compra registrados recientemente.
            </div>
          ) : (
            <div className="table-container" style={{ borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', overflowX: 'auto', width: '100%', maxWidth: '100%' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.7rem', fontWeight: 700 }}>PO Nº</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.7rem', fontWeight: 700 }}>PRODUCTO</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.7rem', fontWeight: 700 }}>PROVEEDOR</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.7rem', fontWeight: 700 }}>ESTADO</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '0.7rem', fontWeight: 700 }}>COSTO</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPO.map(po => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        PO-{po.order_number}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.8rem', fontWeight: 500 }}>
                        {po.products?.name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {po.suppliers?.company_name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span className={`badge ${
                          po.status === 'Recibido' || po.status === 'Cerrado' ? 'badge-success' :
                          po.status === 'Pendiente' || po.status === 'Producción' ? 'badge-neutral' : 'badge-warning'
                        }`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                          {po.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatCurrency(po.total_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Column 2: Urgent Tasks */}
        <div className="card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Tareas pendientes</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Prioridades operativas del equipo</p>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => onNavigate('tasks')}
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Ver tareas
            </button>
          </div>

          {urgentTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              ¡Todo al día! No tienes tareas pendientes.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
              {urgentTasks.map(task => (
                <div key={task.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 14px', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-sm)',
                  gap: '12px',
                  minWidth: 0
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.title}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {task.due_date ? `Vence: ${task.due_date}` : 'Sin fecha límite'}
                    </span>
                  </div>
                  <span className={`badge ${
                    task.priority === 'Alta' ? 'badge-danger' : 
                    task.priority === 'Media' ? 'badge-warning' : 'badge-neutral'
                  }`} style={{ fontSize: '0.68rem', padding: '2px 8px', flexShrink: 0 }}>
                    {task.priority || 'Normal'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
