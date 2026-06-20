import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, X, Check, Clock, User, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

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

  // Comment Form states
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const columns = [
    { id: 'Pendiente', title: 'Pendiente', badgeClass: 'badge-neutral' },
    { id: 'En progreso', title: 'En Progreso', badgeClass: 'badge-neutral' },
    { id: 'Esperando respuesta', title: 'Esperando Respuesta', badgeClass: 'badge-warning' },
    { id: 'Bloqueado', title: 'Bloqueado', badgeClass: 'badge-danger' },
    { id: 'Completado', title: 'Completado', badgeClass: 'badge-success' }
  ];

  useEffect(() => {
    fetchTasks();
    fetchProfiles();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles:assignee_id(email, full_name)')
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

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tablero Kanban</h1>
          <p className="page-subtitle">Rastrea la operativa diaria de compras, producción e importación</p>
        </div>
        <button className="btn btn-primary" onClick={() => openAddModal('Pendiente')}>
          <Plus size={16} /> Crear Tarea
        </button>
      </div>

      {/* Kanban Board Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw className="animate-spin" size={24} style={{ color: 'var(--accent-color)' }} />
        </div>
      ) : (
        <div className="kanban-board">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div 
                key={col.id} 
                className="kanban-column"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                <div className="kanban-column-header">
                  <div className="column-title">
                    <span className={`badge ${col.badgeClass}`} style={{ width: '8px', height: '8px', padding: 0, borderRadius: '50%' }}></span>
                    <span>{col.title}</span>
                  </div>
                  <span className="column-count">{colTasks.length}</span>
                </div>

                <div className="kanban-cards-container">
                  {colTasks.map(task => (
                    <div 
                      key={task.id} 
                      className="kanban-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => openDetailModal(task)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <span className="kanban-card-title">{task.title}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button 
                            className="btn btn-secondary btn-sm btn-icon-only" 
                            style={{ padding: '2px', borderRadius: '4px' }}
                            onClick={(e) => openEditModal(task, e)}
                          >
                            <Edit2 size={10} />
                          </button>
                        </div>
                      </div>

                      {task.description && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {task.description}
                        </p>
                      )}

                      <div className="kanban-card-footer">
                        <span className={`badge ${
                          task.priority === 'Alta' ? 'badge-danger' : 
                          task.priority === 'Media' ? 'badge-warning' : 'badge-neutral'
                        }`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                          {task.priority}
                        </span>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {task.due_date && (
                            <span className="kanban-card-due" title="Fecha de vencimiento">
                              <Clock size={10} />
                              <span style={{ fontSize: '0.65rem' }}>{task.due_date.slice(5)}</span>
                            </span>
                          )}
                          <div 
                            className="kanban-card-assignee" 
                            title={task.profiles?.full_name || task.profiles?.email || 'Sin asignar'}
                          >
                            {getInitials(task.profiles?.full_name || task.profiles?.email)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ borderStyle: 'dashed', width: '100%', display: 'flex', gap: '6px', fontSize: '0.8rem', justifyContent: 'center', marginTop: '4px' }}
                    onClick={() => openAddModal(col.id)}
                  >
                    <Plus size={12} /> Añadir Tarea
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
                      <option value="Bloqueado">Bloqueado</option>
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

      {/* Task Details & Comments Modal */}
      {isDetailModalOpen && selectedTask && (
        <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Detalles de Tarea</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-danger btn-sm btn-icon-only" onClick={() => handleDelete(selectedTask.id)} title="Eliminar tarea">
                  <Trash2 size={14} />
                </button>
                <button className="action-btn" onClick={() => setIsDetailModalOpen(false)}><X size={18} /></button>
              </div>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedTask.title}</h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span className="badge badge-neutral">Estado: {selectedTask.status}</span>
                  <span className={`badge ${selectedTask.priority === 'Alta' ? 'badge-danger' : selectedTask.priority === 'Media' ? 'badge-warning' : 'badge-neutral'}`}>
                    Prioridad: {selectedTask.priority}
                  </span>
                  {selectedTask.due_date && (
                    <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Límite: {selectedTask.due_date}
                    </span>
                  )}
                  {selectedTask.profiles && (
                    <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} /> Responsable: {selectedTask.profiles.full_name || selectedTask.profiles.email}
                    </span>
                  )}
                </div>
              </div>

              {selectedTask.description && (
                <div style={{ padding: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Descripción</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{selectedTask.description}</p>
                </div>
              )}

              {/* Comments Section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <MessageSquare size={16} /> Comentarios ({comments.length})
                </h4>

                {/* Comment list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
                  {comments.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay comentarios aún. Deja un comentario abajo.</p>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          <span>{c.profiles?.full_name || c.profiles?.email || 'Usuario'}</span>
                          <span>{new Date(c.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '2px' }}>{c.comment_text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add comment form */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Escribe un comentario..." 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>
                    Comentar
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
