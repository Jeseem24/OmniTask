'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import ChatInterface from '@/components/ChatInterface';
import TaskCard, { TaskItem } from '@/components/TaskCard';
import TaskDetailModal from '@/components/TaskDetailModal';
import { toast } from '@/lib/toast';
import { CheckCircle2, RefreshCw, Plus, X, AlertTriangle, Clock, Zap, ListChecks, Search, GripVertical, Sparkles, Trash2, Loader2 } from 'lucide-react';

export default function Home() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ALL');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Clear confirmation modal state
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearScope, setClearScope] = useState<'all' | 'completed'>('all');
  const [isClearing, setIsClearing] = useState(false);

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newImportance, setNewImportance] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tasks?status=all');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        toast.success(nextStatus === 'COMPLETED' ? 'Task completed!' : 'Task uncompleted');
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
      fetchTasks();
    }
  };

  const handleUpdateTask = async (taskId: string, fields: Partial<TaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...fields } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        toast.success('Task updated');
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Task deleted');
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
      fetchTasks();
    }
  };

  const handleExecuteClear = async (scope: 'all' | 'completed') => {
    setIsClearing(true);
    try {
      const res = await fetch(`/api/tasks?scope=${scope}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(scope === 'all' ? 'All tasks cleared' : 'Completed tasks cleared');
        setShowClearConfirmModal(false);
        fetchTasks();
      } else {
        toast.error('Failed to clear tasks');
      }
    } catch (err) {
      console.error('Clear error:', err);
      toast.error('Failed to clear tasks');
    } finally {
      setIsClearing(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          deadlineISO: newDeadline ? new Date(newDeadline).toISOString() : undefined,
          importance: newImportance,
        }),
      });
      if (res.ok) {
        toast.success(`Added "${newTitle.trim()}"`);
        setNewTitle(''); setNewDescription(''); setNewDeadline(''); setNewImportance(3);
        setShowAddForm(false);
        fetchTasks();
      }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedTaskId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (draggedTaskId && draggedTaskId !== id) {
      setDragOverTaskId(id);
    }
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetId) {
      handleDragEnd();
      return;
    }

    const currentList = [...tasks];
    const sourceIndex = currentList.findIndex((t) => t.id === draggedTaskId);
    const targetIndex = currentList.findIndex((t) => t.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    const [movedTask] = currentList.splice(sourceIndex, 1);
    currentList.splice(targetIndex, 0, movedTask);

    const updatedList = currentList.map((task, idx) => {
      const priorityScore = (currentList.length - idx) * 10;
      return { ...task, priorityScore };
    });

    setTasks(updatedList);
    handleDragEnd();

    try {
      await fetch(`/api/tasks/${draggedTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priorityScore: updatedList[targetIndex].priorityScore,
          userModified: true,
        }),
      });
    } catch (err) {
      console.error('Drag persist error:', err);
    }
  };

  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'tasks'>('chat');

  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
  const overdueTasks = pendingTasks.filter((t) => {
    if (!t.deadline) return false;
    try { return new Date(t.deadline).getTime() < Date.now(); } catch { return false; }
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'ACTIVE' && t.status === 'COMPLETED') return false;
      if (statusFilter === 'DONE' && t.status !== 'COMPLETED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description ? t.description.toLowerCase().includes(q) : false;
        return matchTitle || matchDesc;
      }
      return true;
    });
  }, [tasks, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen text-zinc-100 font-sans antialiased pb-6">
      <Navbar
        activeTab={activeMobileTab}
        onTabChange={setActiveMobileTab}
        pendingCount={pendingTasks.length}
      />

      <main className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2.5 sm:py-5">
        {/* Unified Cockpit Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left Column: AI Assistant (5 cols) */}
          <div className={`lg:col-span-5 lg:sticky lg:top-20 space-y-4 ${activeMobileTab === 'tasks' ? 'hidden lg:block' : 'block'}`}>
            <ChatInterface onTasksUpdated={fetchTasks} />
          </div>

          {/* Right Column: Dynamic Task Queue (7 cols) */}
          <div className={`lg:col-span-7 space-y-4 ${activeMobileTab === 'chat' ? 'hidden lg:block' : 'block'}`}>
            {/* Header / Stats & Controls Bar (Double-Bezel Architecture) */}
            <div className="doppelrand-shell rounded-2xl sm:rounded-3xl p-0.5 sm:p-1.5">
              <div className="doppelrand-core p-3 sm:p-5 space-y-3 sm:space-y-4 rounded-[calc(1rem-2px)] sm:rounded-[calc(1.5rem-2px)]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                      <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                      Task Queue
                    </h2>
                    <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5 font-mono">
                      Drag to reorder • Tap card to inspect
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="btn-pill-primary active:scale-95 text-xs py-1.5 px-3"
                    >
                      <span>{showAddForm ? 'Cancel' : 'Add Task'}</span>
                      <div className="btn-icon-pod w-5 h-5">
                        {showAddForm ? <X className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                      </div>
                    </button>

                    {tasks.length > 0 && (
                      <button
                        onClick={() => { setClearScope('all'); setShowClearConfirmModal(true); }}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-full glass hover:border-red-500/20 transition-all active:scale-95"
                        title="Clear all tasks"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={fetchTasks}
                      disabled={isLoading}
                      className="p-1.5 sm:p-2 text-zinc-400 hover:text-zinc-200 rounded-full glass hover:border-white/20 transition-all disabled:opacity-50 active:scale-95"
                      title="Refresh queue"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-0.5">
                  <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-zinc-950/60 border border-white/[0.05] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-mono text-zinc-400 font-bold">Active</div>
                    <div className="text-base sm:text-xl font-extrabold text-indigo-400 font-mono mt-0.5">{pendingTasks.length}</div>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-zinc-950/60 border border-white/[0.05] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-mono text-zinc-400 font-bold">Overdue</div>
                    <div className="text-base sm:text-xl font-extrabold text-rose-400 font-mono mt-0.5">{overdueTasks.length}</div>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-zinc-950/60 border border-white/[0.05] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-mono text-zinc-400 font-bold">Done</div>
                    <div className="text-base sm:text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{completedTasks.length}</div>
                  </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter by keyword..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-white/[0.08] focus:border-indigo-500/50 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-zinc-950/80 border border-white/[0.08] p-1 rounded-xl">
                    {(['ALL', 'ACTIVE', 'DONE'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                          statusFilter === filter
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual Add Form Drawer */}
                {showAddForm && (
                  <form onSubmit={handleManualAdd} className="p-3.5 rounded-2xl bg-zinc-950/90 border border-indigo-500/30 space-y-3 animate-fade-in shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> New Task Entry
                      </span>
                      <button type="button" onClick={() => setShowAddForm(false)} className="text-zinc-500 hover:text-zinc-300">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Task title..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-zinc-900/90 border border-white/[0.1] rounded-xl px-3 py-2 text-xs font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />

                    <textarea
                      placeholder="Notes / description (optional)..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-900/90 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={newImportance}
                        onChange={(e) => setNewImportance(parseInt(e.target.value, 10))}
                        className="px-2.5 py-1.5 text-xs font-bold rounded-xl border bg-zinc-900 text-zinc-200 border-white/[0.1] focus:outline-none"
                      >
                        <option value="5">🔴 Critical</option>
                        <option value="4">🟠 High</option>
                        <option value="3">🟢 Medium</option>
                        <option value="1">⚪ Low</option>
                      </select>

                      <input
                        type="datetime-local"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="bg-zinc-900 border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
                      />

                      <button
                        type="submit"
                        disabled={isSubmitting || !newTitle.trim()}
                        className="ml-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        {isSubmitting ? 'Adding...' : 'Save Task'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Task List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-2xl glass animate-pulse" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="doppelrand-shell rounded-2xl sm:rounded-3xl p-0.5 sm:p-1.5">
                <div className="doppelrand-core p-8 sm:p-12 text-center rounded-[calc(1rem-2px)] sm:rounded-[calc(1.5rem-2px)]">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-200">
                    {searchQuery ? 'No matching tasks' : 'Task Queue is Empty'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? `No tasks matched "${searchQuery}". Clear your search to view all.`
                      : 'Ask the AI on the left or click "Add Task" to start populating your day.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelectTask={setSelectedTask}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteTask}
                    onUpdateTask={handleUpdateTask}
                    isDragging={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                  />
                ))}

                {/* Bottom Clear Actions */}
                <div className="pt-3 flex items-center justify-center gap-3 flex-wrap">
                  {completedTasks.length > 0 && statusFilter !== 'ACTIVE' && (
                    <button
                      onClick={() => { setClearScope('completed'); setShowClearConfirmModal(true); }}
                      className="px-3.5 py-1.5 glass text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-full transition-all hover:border-white/20 active:scale-95 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Clear completed ({completedTasks.length})
                    </button>
                  )}
                  {tasks.length > 0 && (
                    <button
                      onClick={() => { setClearScope('all'); setShowClearConfirmModal(true); }}
                      className="px-3.5 py-1.5 glass text-zinc-500 hover:text-red-400 text-xs font-semibold rounded-full transition-all hover:border-red-500/20 active:scale-95 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear all ({tasks.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Safe Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="bg-[#111116] border border-red-500/30 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">
                {clearScope === 'all' ? 'Delete All Tasks?' : 'Clear Completed Tasks?'}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {clearScope === 'all'
                  ? `Are you sure you want to permanently delete all ${tasks.length} tasks from your queue? This action cannot be undone.`
                  : `Are you sure you want to delete ${completedTasks.length} completed tasks?`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={isClearing}
                className="px-4 py-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 font-semibold text-xs transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteClear(clearScope)}
                disabled={isClearing}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-[0_4px_16px_rgba(239,68,68,0.4)] transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                {isClearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onToggleComplete={handleToggleComplete}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}
