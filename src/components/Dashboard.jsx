import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
  TrendingUp, AlertTriangle, Package, ShoppingCart, 
  CheckSquare, Receipt, RefreshCw, Calendar, Clock 
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Title and Global Actions */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Resumen Ejecutivo FBA</h1>
            <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '3px 8px', letterSpacing: '0.05em', fontWeight: 700 }}>EN VIVO</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Consola centralizada de ventas, inventario local/FBA y aprovisionamiento
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <MonthPicker value={mes} onChange={setMes} />
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={fetchDashboardData}
            title="Actualizar datos del panel"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            <span>Actualizar</span>
          </button>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={() => onNavigate('orders')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <ShoppingCart size={14} /> 
            <span>Nuevo Pedido PO</span>
          </button>
        </div>
      </div>

      {/* Hero Metrics KPI Cards (4 Grid) */}
      <div className="grid-cols-4" style={{ gap: '16px' }}>
        
        {/* Metric 1: Ventas del Mes */}
        <div className="card metric-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Ventas del Mes ({mes})
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} style={{ color: '#10b981' }} />
            </div>
          </div>
          <div>
            <span className="metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
              {formatCurrency(metrics.totalSalesMonth)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Volumen de unidades:
            </span>
            <span className="badge badge-success" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {metrics.totalSalesMonthUnits} uds vendidas
            </span>
          </div>
        </div>

        {/* Metric 2: Valor Total de Inventario */}
        <div className="card metric-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--accent-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Valor Total Inventario
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} style={{ color: 'var(--accent-color)' }} />
            </div>
          </div>
          <div>
            <span className="metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
              {formatCurrency(metrics.totalInventoryValue)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Ubicación de stock:
            </span>
            <button 
              onClick={() => onNavigate('inventory')} 
              style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Ver desglose Local / FBA →
            </button>
          </div>
        </div>

        {/* Metric 3: Alertas de Stock Bajo / Reposición */}
        <div className="card metric-card" style={{ 
          padding: '18px 20px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', 
          borderLeft: metrics.lowStockCount > 0 ? '4px solid var(--danger-color)' : '4px solid var(--success-color)',
          backgroundColor: metrics.lowStockCount > 0 ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Stock Bajo Mínimo
            </span>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '8px', 
              backgroundColor: metrics.lowStockCount > 0 ? 'var(--danger-light)' : 'var(--success-light)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <AlertTriangle size={18} style={{ color: metrics.lowStockCount > 0 ? 'var(--danger-color)' : 'var(--success-color)' }} />
            </div>
          </div>
          <div>
            <span className="metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.85rem', fontWeight: 800, color: metrics.lowStockCount > 0 ? 'var(--danger-color)' : 'var(--text-primary)', letterSpacing: '-0.04em' }}>
              {metrics.lowStockCount} {metrics.lowStockCount === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: metrics.lowStockCount > 0 ? 'var(--danger-color)' : 'var(--text-secondary)', fontWeight: 500 }}>
              {metrics.lowStockCount > 0 ? 'Requiere reorden a proveedor' : 'Nivel de stock óptimo'}
            </span>
            {metrics.lowStockCount > 0 && (
              <button 
                onClick={() => onNavigate('inventory')}
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px' }}
              >
                Revisar
              </button>
            )}
          </div>
        </div>

        {/* Metric 4: Pedidos PO Activos */}
        <div className="card metric-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--info-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              Pedidos PO Activos
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(14, 165, 233, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={18} style={{ color: 'var(--info-color)' }} />
            </div>
          </div>
          <div>
            <span className="metric-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
              {metrics.activeOrdersCount} {metrics.activeOrdersCount === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Costo total en camino:
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--info-color)' }}>
              {formatCurrency(metrics.recentExpenses)}
            </span>
          </div>
        </div>

      </div>

      {/* FBA Health & Critical Alerts Banner */}
      {alerts.length > 0 && (
        <div style={{ 
          padding: '16px 20px', 
          borderRadius: 'var(--border-radius-lg)', 
          backgroundColor: 'rgba(239, 68, 68, 0.04)', 
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={18} style={{ color: 'var(--danger-color)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Radar de Alertas Operativas ({alerts.length})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {alerts[0].message}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => onNavigate('inventory')}
              style={{ fontSize: '0.78rem' }}
            >
              Ver Inventario
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={() => onNavigate('orders')}
              style={{ fontSize: '0.78rem', backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
            >
              Crear Orden de Compra
            </button>
          </div>
        </div>
      )}

      {/* Main Operational Grid (2 Columns) */}
      <div className="grid-cols-2" style={{ gap: '20px' }}>
        
        {/* Column 1: Recent Purchase Orders */}
        <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Pedidos de Compra Recientes</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Últimas órdenes a proveedores registrados</p>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => onNavigate('orders')}
              style={{ fontSize: '0.78rem' }}
            >
              Ver todos →
            </button>
          </div>

          {recentPO.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No hay pedidos de compra registrados recientemente.
            </div>
          ) : (
            <div className="table-container" style={{ borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.72rem', fontWeight: 700 }}>PO Nº</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.72rem', fontWeight: 700 }}>PRODUCTO</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '0.72rem', fontWeight: 700 }}>PROVEEDOR</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '0.72rem', fontWeight: 700 }}>ESTADO</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '0.72rem', fontWeight: 700 }}>COSTO</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPO.map(po => (
                    <tr key={po.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem' }}>
                        PO-{po.order_number}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', fontWeight: 500 }}>
                        {po.products?.name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {po.suppliers?.company_name || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span className={`badge ${
                          po.status === 'Recibido' || po.status === 'Cerrado' ? 'badge-success' :
                          po.status === 'Pendiente' || po.status === 'Producción' ? 'badge-neutral' : 'badge-warning'
                        }`} style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                          {po.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.82rem' }}>
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
        <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Tareas Operativas Pendientes</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Prioridades asignadas en tu tablero Kanban</p>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => onNavigate('tasks')}
              style={{ fontSize: '0.78rem' }}
            >
              Tablero Kanban →
            </button>
          </div>

          {urgentTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              ¡Todo al día! No tienes tareas pendientes.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {urgentTasks.map(task => (
                <div key={task.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 14px', 
                  backgroundColor: 'var(--bg-tertiary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-sm)',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
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
