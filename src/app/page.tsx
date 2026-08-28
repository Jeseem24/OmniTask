'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import ChatInterface from '@/components/ChatInterface';
import TaskCard, { TaskItem } from '@/components/TaskCard';
import TaskDetailModal from '@/components/TaskDetailModal';
import { toast } from '@/lib/toast';
import { CheckCircle2, RefreshCw, Plus, X, AlertTriangle, Clock, Zap, ListChecks, Search, GripVertical, Sparkles } from 'lucide-react';

export default function Home() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ALL');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

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
        const data: TaskItem[] = await res.json();
        const sorted = [...data].sort((a, b) => {
          if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
          if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
          return (b.priorityScore || 0) - (a.priorityScore || 0);
        });
        setTasks(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleToggleComplete = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    const targetTask = tasks.find(t => t.id === id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    if (selectedTask && selectedTask.id === id) {
      setSelectedTask(prev => prev ? { ...prev, status: nextStatus } : null);
    }
    
    if (nextStatus === 'COMPLETED') {
      toast.success(`Completed "${targetTask?.title || 'Task'}"`);
    } else {
      toast.info(`Reopened "${targetTask?.title || 'Task'}"`);
    }

    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchTasks();
    } catch (err) { console.error(err); }
  };

  const handleDeleteTask = async (id: string) => {
    const targetTask = tasks.find(t => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTask?.id === id) setSelectedTask(null);
    toast.info(`Deleted "${targetTask?.title || 'task'}"`);
    try { await fetch(`/api/tasks/${id}`, { method: 'DELETE' }); }
    catch (err) { console.error(err); }
  };

  const handleUpdateTask = async (id: string, updatedData: Partial<TaskItem>) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updatedData.title,
          description: updatedData.description,
          deadlineISO: updatedData.deadline ? new Date(updatedData.deadline).toISOString() : null,
          importance: updatedData.importance,
          userModified: true,
        }),
      });
      if (res.ok) {
        toast.success('Task updated');
        fetchTasks();
      }
    } catch (err) { console.error(err); }
  };

  const handleClearCompleted = async () => {
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
    if (completedTasks.length === 0) return;
    setTasks((prev) => prev.filter((t) => t.status !== 'COMPLETED'));
    toast.info(`Cleared ${completedTasks.length} completed tasks`);
    try {
      await Promise.all(completedTasks.map((t) => fetch(`/api/tasks/${t.id}`, { method: 'DELETE' })));
    } catch (err) { console.error('Clear completed error:', err); }
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
    toast.success('Priority reordered');
    handleDragEnd();

    try {
      await fetch(`/api/tasks/${movedTask.id}`, {
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
                    <div className={`text-base sm:text-xl font-extrabold font-mono mt-0.5 ${overdueTasks.length > 0 ? 'text-red-400 animate-pulse-subtle' : 'text-zinc-600'}`}>
                      {overdueTasks.length}
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-zinc-950/60 border border-white/[0.05] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-widest font-mono text-zinc-400 font-bold">Done</div>
                    <div className="text-base sm:text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{completedTasks.length}</div>
                  </div>
                </div>

                {/* Search & Filter Tabs */}
                <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                  {/* Search Bar */}
                  <div className="relative flex-1 min-w-[130px]">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter by keyword..."
                      className="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-zinc-950/80 border border-white/[0.08] rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-0.5 sm:gap-1 bg-zinc-950 p-0.5 sm:p-1 rounded-xl border border-white/[0.08]">
                    {(['ALL', 'ACTIVE', 'DONE'] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`px-2.5 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-mono font-bold transition-all ${
                          statusFilter === filter
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Add Form (Hardware Container) */}
            {showAddForm && (
              <form onSubmit={handleManualAdd} className="glass-elevated rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-3 animate-scale-in border border-indigo-500/30 shadow-2xl">
                <h3 className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
                  <Plus className="w-3.5 h-3.5" /> Direct Task Entry
                </h3>
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 sm:px-4 sm:py-2.5 bg-zinc-950 border border-white/[0.1] rounded-xl sm:rounded-2xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  autoFocus
                  required
                />
                <textarea
                  placeholder="Optional context / notes..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 sm:px-4 sm:py-2.5 bg-zinc-950 border border-white/[0.1] rounded-xl sm:rounded-2xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                />
                <div className="flex items-center gap-2 sm:gap-3">
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="flex-1 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-zinc-950 border border-white/[0.1] rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/60"
                  />
                  <select
                    value={newImportance}
                    onChange={(e) => setNewImportance(parseInt(e.target.value))}
                    className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-zinc-950 border border-white/[0.1] rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/60 font-semibold"
                  >
                    <option value={5}>🔴 Critical</option>
                    <option value={4}>🟠 High</option>
                    <option value={3}>🟢 Medium</option>
                    <option value={1}>⚪ Low</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="w-full py-2 sm:py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold rounded-xl sm:rounded-2xl transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/25 active:scale-[0.99]"
                >
                  {isSubmitting ? 'Adding...' : 'Create Task'}
                </button>
              </form>
            )}

            {/* Task List */}
            {isLoading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-zinc-500 text-xs font-mono">Syncing task state...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center animate-fade-up border border-white/[0.06]">
                <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">{searchQuery ? '🔍' : '⚡'}</div>
                <h3 className="text-sm font-bold text-zinc-300 mb-1">
                  {searchQuery ? 'No matching tasks' : 'Queue is Clear'}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                  {searchQuery
                    ? `No tasks found matching "${searchQuery}". Try a different keyword.`
                    : 'Describe your tasks to the AI Copilot on the left or tap "Add Task" to get started.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3 max-h-[calc(100dvh-16rem)] lg:max-h-[calc(100vh-21rem)] overflow-y-auto pr-0.5 sm:pr-1 stagger-children custom-scrollbar">
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteTask}
                    onUpdateTask={handleUpdateTask}
                    onSelectTask={(t) => setSelectedTask(t)}
                    isDragging={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                  />
                ))}

                {completedTasks.length > 0 && statusFilter !== 'ACTIVE' && (
                  <div className="pt-3 text-center">
                    <button
                      onClick={handleClearCompleted}
                      className="px-4 py-2 glass text-zinc-500 hover:text-red-400 text-xs font-semibold rounded-full transition-all hover:border-red-500/20 active:scale-95"
                    >
                      Clear completed ({completedTasks.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Deep Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdateTask={handleUpdateTask}
        onToggleComplete={handleToggleComplete}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}
