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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Vista general de tu empresa de comercio electrónico y FBA</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <MonthPicker value={mes} onChange={setMes} />
          <button className="btn btn-secondary btn-sm" onClick={fetchDashboardData}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-cols-4">
        <div className="card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Valor de Inventario</span>
            <Package size={20} style={{ color: 'var(--accent-color)' }} />
          </div>
          <span className="metric-value">{formatCurrency(metrics.totalInventoryValue)}</span>
          <span className="metric-trend trend-up">
            <TrendingUp size={12} /> Stock en almacén
          </span>
        </div>

        <div className="card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Stock Bajo Mínimo</span>
            <AlertTriangle size={20} style={{ color: metrics.lowStockCount > 0 ? 'var(--danger-color)' : 'var(--text-tertiary)' }} />
          </div>
          <span className="metric-value">{metrics.lowStockCount}</span>
          <span className={`metric-trend ${metrics.lowStockCount > 0 ? 'trend-down' : 'trend-up'}`}>
            Productos que necesitan reordenarse
          </span>
        </div>

        <div className="card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Pedidos Activos</span>
            <ShoppingCart size={20} style={{ color: 'var(--info-color)' }} />
          </div>
          <span className="metric-value">{metrics.activeOrdersCount}</span>
          <span className="metric-trend trend-up" style={{ color: 'var(--info-color)' }}>
            En camino o producción
          </span>
        </div>

        <div className="card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Tareas Pendientes</span>
            <CheckSquare size={20} style={{ color: 'var(--warning-color)' }} />
          </div>
          <span className="metric-value">{metrics.pendingTasksCount}</span>
          <span className="metric-trend" style={{ color: 'var(--text-secondary)' }}>
            En tablero Kanban
          </span>
        </div>

        <div className="card metric-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Ventas del Mes</span>
            <TrendingUp size={20} style={{ color: '#10b981' }} />
          </div>
          <span className="metric-value" style={{ color: '#10b981' }}>{formatCurrency(metrics.totalSalesMonth)}</span>
          <span className="metric-trend trend-up">
            {metrics.totalSalesMonthUnits} uds. vendidas
          </span>
        </div>
      </div>

      {/* Slim Alerts Bar */}
      {alerts.length > 0 && (
        <div className="slim-alerts-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} className="danger-glow-icon" style={{ color: 'var(--danger-color)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
              {alerts[0].message}
              {alerts.length > 1 && (
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: '6px' }}>
                  (+{alerts.length - 1} alertas adicionales)
                </span>
              )}
            </span>
          </div>
          {alerts.length > 1 && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => onNavigate('tasks')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', height: 'auto' }}
            >
              Ver todas
            </button>
          )}
        </div>
      )}


      {/* Main Grid */}
      <div className="grid-cols-2">
        {/* Recent Purchase Orders */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Pedidos de Compra Recientes</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('orders')}>Ver Todos</button>
          </div>
          {recentPO.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No hay pedidos registrados.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Producto</th>
                    <th>Proveedor</th>
                    <th>Estado</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPO.map(po => (
                    <tr key={po.id}>
                      <td style={{ fontWeight: 600 }}>PO-{po.order_number}</td>
                      <td>{po.products?.name}</td>
                      <td>{po.suppliers?.company_name}</td>
                      <td>
                        <span className={`badge ${
                          po.status === 'Recibido' || po.status === 'Cerrado' ? 'badge-success' :
                          po.status === 'Pendiente' || po.status === 'Producción' ? 'badge-neutral' : 'badge-warning'
                        }`}>
                          {po.status}
                        </span>
                      </td>
                      <td>{formatCurrency(po.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending / Urgent Tasks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Tareas Urgentes</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('tasks')}>Tablero Kanban</button>
          </div>
          {urgentTasks.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No hay tareas pendientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {urgentTasks.map(task => (
                <div key={task.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 16px', 
                  backgroundColor: 'var(--bg-primary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--border-radius-sm)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{task.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {task.due_date ? `Vence: ${task.due_date}` : 'Sin fecha límite'}
                    </span>
                  </div>
                  <span className={`badge ${
                    task.priority === 'Alta' ? 'badge-danger' : 
                    task.priority === 'Media' ? 'badge-warning' : 'badge-neutral'
                  }`}>
                    {task.priority}
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
