import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, X, Check, Clock, User, MessageSquare, RefreshCw } from 'lucide-react';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Add/Edit Task Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Pendiente');
  const [priority, setPriority] = useState('Media');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('Todas');
  const [filterMine, setFilterMine] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Comment Form states
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const columns = [
    { id: 'Pendiente', title: 'Pendiente', color: '#64748b' },
    { id: 'En progreso', title: 'En Progreso', color: '#f59e0b' },
    { id: 'Esperando respuesta', title: 'Esperando Respuesta', color: '#38bdf8' },
    { id: 'Completado', title: 'Completado', color: '#10b981' }
  ];

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles:assignee_id(email, full_name), task_comments(id)')
        .order('position', { ascending: true });
      if (error) throw error;
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, full_name, email');
      if (error) throw error;
      setProfiles(data);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setCurrentUserId(session.user.id);
    });
  }, []);

  const openAddModal = (colId = 'Pendiente') => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setStatus(colId);
    setPriority('Media');
    setAssigneeId('');
    setDueDate('');
    setError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (task, e) => {
    e.stopPropagation();
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setPriority(task.priority);
    setAssigneeId(task.assignee_id || '');
    setDueDate(task.due_date || '');
    setError(null);
    setIsAddModalOpen(true);
  };

  const openDetailModal = async (task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
    fetchComments(task.id);
  };

  const fetchComments = async (taskId) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*, profiles:profile_id(full_name, email)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;

    try {
      const sessionUser = (await supabase.auth.getSession()).data.session?.user;
      if (!sessionUser) return;

      const { error } = await supabase
        .from('task_comments')
        .insert([{
          task_id: selectedTask.id,
          profile_id: sessionUser.id,
          comment_text: newComment
        }]);

      if (error) throw error;

      setNewComment('');
      fetchComments(selectedTask.id);
      fetchTasks();
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const payload = {
      title,
      description: description || null,
      status,
      priority,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', editingTask.id);
        if (error) throw error;
      } else {
        // Calculate max position to append
        const colTasks = tasks.filter(t => t.status === status);
        const maxPos = colTasks.reduce((max, t) => t.position > max ? t.position : max, 0);
        payload.position = maxPos + 1;

        const { error } = await supabase
          .from('tasks')
          .insert([payload]);
        if (error) throw error;
      }

      setIsAddModalOpen(false);
      fetchTasks();
    } catch (err) {
      setError(err.message || 'Error al guardar la tarea');
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      setIsDetailModalOpen(false);
      fetchTasks();
    } catch (err) {
      alert(err.message || 'Error al eliminar la tarea');
    }
  };

  // Kanban Native Drag and Drop logic
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, colId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove || taskToMove.status === colId) return;

    // Optimistic update in state
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: colId } : t));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: colId, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error updating task status on drop:', err);
      fetchTasks(); // rollback
    }
  };

  const handleUpdateStatusDirect = async (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, status: newStatus } : prev);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating status directly:', err);
      fetchTasks();
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter tasks based on live search, priority and assignee
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPriority = filterPriority === 'Todas' || task.priority === filterPriority;
    const matchesMine = !filterMine || (task.assignee_id && task.assignee_id === currentUserId);

    return matchesSearch && matchesPriority && matchesMine;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
      {/* Executive Kanban Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Gestión Operativa FBA</h1>
            <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '3px 8px', letterSpacing: '0.05em', fontWeight: 700 }}>TABLERO KANBAN</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            Rastrea en tiempo real el progreso de compras, inspecciones, producción y envíos a almacenes Amazon
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={fetchTasks}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
            title="Recargar tareas"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            <span>Refrescar</span>
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => openAddModal('Pendiente')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, borderRadius: '8px' }}
          >
            <Plus size={16} /> <span>Crear Tarea</span>
          </button>
        </div>
      </div>

      {/* Linear Quick Filters & Search Toolbar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '14px', 
        flexWrap: 'wrap',
        background: 'var(--surface-color)',
        padding: '12px 18px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Left: Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Buscar por título o detalle de tarea..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              padding: '7px 12px', 
              fontSize: '0.84rem', 
              borderRadius: '8px',
              backgroundColor: 'var(--bg-primary)'
            }}
          />
        </div>

        {/* Right: Quick filter buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Priority filter pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-primary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {['Todas', 'Alta', 'Media', 'Baja'].map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: filterPriority === p ? 700 : 500,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: filterPriority === p ? 'var(--accent-color)' : 'transparent',
                  color: filterPriority === p ? '#090b10' : 'var(--text-secondary)',
                  transition: 'all 0.12s ease'
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Mine filter toggle */}
          {currentUserId && (
            <button
              onClick={() => setFilterMine(prev => !prev)}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: filterMine ? 'var(--accent-color)' : 'var(--border-color)',
                backgroundColor: filterMine ? 'var(--accent-light)' : 'var(--bg-primary)',
                color: filterMine ? 'var(--accent-color)' : 'var(--text-secondary)',
                transition: 'all 0.12s ease'
              }}
            >
              Solo mías {filterMine && '✓'}
            </button>
          )}

          {/* Counter */}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginLeft: '4px' }}>
            {filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}
          </span>
        </div>
      </div>

      {/* Kanban Board Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : (
        <div className="kanban-board-wrapper">
          {columns.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <div 
                key={col.id} 
                className="kanban-column-box"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="kanban-column-head">
                  <div className="kanban-column-title-wrapper">
                    <span className="kanban-column-dot" style={{ backgroundColor: col.color, boxShadow: `0 0 8px ${col.color}66` }}></span>
                    <span className="kanban-column-label">{col.title}</span>
                  </div>
                  <span className="kanban-column-count-badge">{colTasks.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {colTasks.map(task => {
                    const priorityColor = 
                      task.priority === 'Alta' ? 'var(--danger-color)' :
                      task.priority === 'Media' ? 'var(--warning-color)' : 'var(--text-tertiary)';

                    return (
                      <div 
                        key={task.id} 
                        className="kanban-card-wrapper"
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => openDetailModal(task)}
                      >
                        {/* Priority Hairline Indicator on left edge */}
                        <div className="kanban-card-priority-indicator" style={{ backgroundColor: priorityColor }} />

                        <div className="kanban-card-header-row">
                          <span className="kanban-card-task-title">{task.title}</span>
                          <button 
                            className="btn btn-secondary btn-sm btn-icon-only" 
                            style={{ padding: '3px', borderRadius: '4px', opacity: 0.7 }}
                            onClick={(e) => openEditModal(task, e)}
                            title="Editar tarea"
                          >
                            <Edit2 size={11} />
                          </button>
                        </div>

                        {task.description && (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
                            {task.description}
                          </p>
                        )}

                        <div className="kanban-card-footer-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`badge ${
                              task.priority === 'Alta' ? 'badge-danger' : 
                              task.priority === 'Media' ? 'badge-warning' : 'badge-neutral'
                            }`} style={{ fontSize: '0.65rem', padding: '2px 6px', fontWeight: 700 }}>
                              {task.priority || 'Normal'}
                            </span>

                            {task.status === 'Completado' && (() => {
                              const updated = new Date(task.updated_at || task.created_at);
                              const diffDays = Math.floor((new Date() - updated) / (1000 * 60 * 60 * 24));
                              const daysLeft = Math.max(0, 30 - diffDays);
                              return (
                                <span 
                                  style={{ 
                                    fontSize: '0.65rem', 
                                    fontFamily: 'var(--font-mono)',
                                    color: daysLeft <= 5 ? 'var(--danger-color)' : 'var(--text-secondary)',
                                    backgroundColor: daysLeft <= 5 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-secondary)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="Auto-limpieza a los 30 días"
                                >
                                  <Clock size={9} />
                                  <span>{daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}</span>
                                </span>
                              );
                            })()}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {task.due_date && (
                              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }} title="Fecha límite">
                                <Clock size={10} />
                                <span>{task.due_date.slice(5)}</span>
                              </span>
                            )}

                            {task.task_comments && task.task_comments.length > 0 && (
                              <span 
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '3px', 
                                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                  color: 'var(--accent-color)',
                                  padding: '1px 6px', 
                                  borderRadius: '9999px',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)'
                                }} 
                                title={`${task.task_comments.length} comentarios`}
                              >
                                <MessageSquare size={10} />
                                <span>{task.task_comments.length}</span>
                              </span>
                            )}

                            <div 
                              className="kanban-avatar-bubble" 
                              title={task.profiles?.full_name || task.profiles?.email || 'Sin asignar'}
                            >
                              {getInitials(task.profiles?.full_name || task.profiles?.email)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ borderStyle: 'dashed', width: '100%', display: 'flex', gap: '6px', fontSize: '0.78rem', justifyContent: 'center', marginTop: '6px', padding: '8px' }}
                    onClick={() => openAddModal(col.id)}
                  >
                    <Plus size={13} /> Añadir Tarea
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingTask ? 'Editar Tarea' : 'Crear Nueva Tarea'}</h3>
              <button className="action-btn" onClick={() => setIsAddModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert-banner alert-banner-danger" style={{ marginBottom: '16px' }}>
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Título *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="Ej. Programar inspección de calidad Lote 4"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea 
                    className="form-textarea" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Detalles sobre entregables, contactos, etc..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select 
                      className="form-select" 
                      value={status} 
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En progreso">En Progreso</option>
                      <option value="Esperando respuesta">Esperando Respuesta</option>
                      <option value="Completado">Completado</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prioridad</label>
                    <select 
                      className="form-select" 
                      value={priority} 
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Responsable</label>
                    <select 
                      className="form-select" 
                      value={assigneeId} 
                      onChange={(e) => setAssigneeId(e.target.value)}
                    >
                      <option value="">Sin asignar</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fecha Límite</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={dueDate} 
                      onChange={(e) => setDueDate(e.target.value)} 
                    />
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details & Comments Slide-Over Drawer (Linear / Apple style) */}
      {isDetailModalOpen && selectedTask && (
        <div 
          className="modal-overlay" 
          onClick={() => setIsDetailModalOpen(false)}
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'stretch',
            padding: 0,
            background: 'rgba(5, 7, 10, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000
          }}
        >
          <div 
            style={{ 
              width: '520px', 
              maxWidth: '92vw', 
              height: '100vh',
              backgroundColor: 'var(--surface-color)',
              borderLeft: '1px solid var(--border-color)',
              boxShadow: '0 0 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.18s ease-out',
              overflow: 'hidden'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top Header */}
            <div style={{ 
              padding: '16px 22px', 
              borderBottom: '1px solid var(--border-color)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-color)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Detalles de Tarea
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => openEditModal(selectedTask, e)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', borderRadius: '6px' }}
                >
                  <Edit2 size={12} /> Editar
                </button>
                <button 
                  className="btn btn-danger btn-sm btn-icon-only" 
                  onClick={() => {
                    handleDelete(selectedTask.id);
                    setIsDetailModalOpen(false);
                  }} 
                  title="Eliminar tarea"
                  style={{ borderRadius: '6px', padding: '6px' }}
                >
                  <Trash2 size={13} />
                </button>
                <button 
                  className="action-btn" 
                  onClick={() => setIsDetailModalOpen(false)}
                  style={{ borderRadius: '6px', padding: '6px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {/* Drawer Scrollable Body */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Task Title */}
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                  {selectedTask.title}
                </h2>

                {/* Quick Status Selector Pills */}
                <div style={{ marginTop: '16px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                    Estado Rápido
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {columns.map(col => {
                      const isCurrent = selectedTask.status === col.id;
                      return (
                        <button
                          key={col.id}
                          onClick={() => handleUpdateStatusDirect(selectedTask.id, col.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            fontWeight: isCurrent ? 700 : 500,
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: isCurrent ? col.color : 'var(--border-color)',
                            backgroundColor: isCurrent ? `${col.color}22` : 'var(--bg-primary)',
                            color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: col.color }} />
                          {col.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Metadata Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Prioridad</span>
                  <span className={`badge ${
                    selectedTask.priority === 'Alta' ? 'badge-danger' : 
                    selectedTask.priority === 'Media' ? 'badge-warning' : 'badge-neutral'
                  }`} style={{ fontSize: '0.72rem', padding: '3px 8px', fontWeight: 700 }}>
                    {selectedTask.priority || 'Normal'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Fecha Límite</span>
                  <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} style={{ color: 'var(--text-tertiary)' }} />
                    {selectedTask.due_date || 'Sin fecha'}
                  </span>
                </div>

                <div style={{ gridColumn: 'span 2', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Responsable</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="kanban-avatar-bubble" style={{ width: '24px', height: '24px', fontSize: '0.7rem' }}>
                      {getInitials(selectedTask.profiles?.full_name || selectedTask.profiles?.email)}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {selectedTask.profiles?.full_name || selectedTask.profiles?.email || 'Sin asignar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Descripción
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }}>
                    {selectedTask.description}
                  </p>
                </div>
              )}

              {/* Comments Discussion Thread */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <MessageSquare size={15} style={{ color: 'var(--accent-color)' }} /> 
                  Comentarios y Actividad ({comments.length})
                </h4>

                {/* Comment list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                  {comments.length === 0 ? (
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 0 }}>
                      No hay comentarios aún. Deja una nota o actualización sobre esta tarea.
                    </p>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '4px', 
                        padding: '10px 14px', 
                        backgroundColor: 'var(--bg-primary)', 
                        borderRadius: '10px', 
                        border: '1px solid var(--border-color)' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{c.profiles?.full_name || c.profiles?.email || 'Usuario'}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                            {new Date(c.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4, margin: 0 }}>
                          {c.comment_text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add comment form */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Escribir una actualización..." 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    style={{ borderRadius: '8px', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                    required
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', borderRadius: '8px' }}>
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
