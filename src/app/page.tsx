'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import ChatInterface from '@/components/ChatInterface';
import TaskCard, { TaskItem } from '@/components/TaskCard';
import SmartNotificationBanner from '@/components/SmartNotificationBanner';
import { CheckCircle2, RefreshCw, Plus, X, ChevronDown } from 'lucide-react';

const TASK_TYPES = [
  'WORK', 'PROJECT', 'FINANCE', 'HEALTH', 'ERRAND',
  'ASSIGNMENT', 'PERSONAL', 'SOCIAL', 'LEARNING',
];

export default function Home() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Manual task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTaskType, setNewTaskType] = useState('PERSONAL');
  const [newDeadline, setNewDeadline] = useState('');
  const [newImportance, setNewImportance] = useState(3);
  const [newEffort, setNewEffort] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data: TaskItem[] = await res.json();
        // Sort: Pending tasks first (by priority), Completed tasks at bottom
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

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleToggleComplete = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTask = async (id: string, updatedData: Partial<TaskItem>) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updatedData.title,
          deadlineISO: updatedData.deadline ? new Date(updatedData.deadline).toISOString() : null,
          importance: updatedData.importance,
          userModified: true,
        }),
      });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearCompleted = async () => {
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
    if (completedTasks.length === 0) return;
    setTasks((prev) => prev.filter((t) => t.status !== 'COMPLETED'));
    try {
      await Promise.all(completedTasks.map((t) => fetch(`/api/tasks/${t.id}`, { method: 'DELETE' })));
    } catch (err) {
      console.error('Clear completed error:', err);
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
          taskType: newTaskType,
          deadlineISO: newDeadline ? new Date(newDeadline).toISOString() : undefined,
          importance: newImportance,
          estimatedEffortMins: newEffort,
        }),
      });
      if (res.ok) {
        // Reset form
        setNewTitle('');
        setNewDescription('');
        setNewTaskType('PERSONAL');
        setNewDeadline('');
        setNewImportance(3);
        setNewEffort(30);
        setShowAddForm(false);
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'tasks'>('chat');

  const pendingCount = tasks.filter((t) => t.status !== 'COMPLETED').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      <Navbar />
      <SmartNotificationBanner tasks={tasks} />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        {/* Mobile View Tab Switcher (< lg screens) */}
        <div className="flex lg:hidden items-center p-1 bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 shadow-lg">
          <button
            onClick={() => setActiveMobileTab('chat')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeMobileTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            💬 AI Assistant
          </button>
          <button
            onClick={() => setActiveMobileTab('tasks')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeMobileTab === 'tasks'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            📋 Active Tasks ({pendingCount})
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Chatbot Interface (7 cols on desktop, conditionally visible on mobile) */}
          <div className={`lg:col-span-7 ${activeMobileTab === 'chat' ? 'block' : 'hidden lg:block'}`}>
            <ChatInterface onTasksUpdated={fetchTasks} />
          </div>

          {/* Live Task Matrix & Manual Add (5 cols on desktop, conditionally visible on mobile) */}
          <div className={`lg:col-span-5 space-y-4 ${activeMobileTab === 'tasks' ? 'block' : 'hidden lg:block'}`}>
            {/* Header with Add Button */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" /> Active Tasks ({tasks.length})
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Via AI chat or manually added</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      showAddForm
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20'
                    }`}
                  >
                    {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {showAddForm ? 'Cancel' : 'Add Task'}
                  </button>
                  <button
                    onClick={fetchTasks}
                    className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors"
                    title="Refresh tasks"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Add Task Form */}
            {showAddForm && (
              <form
                onSubmit={handleManualAdd}
                className="bg-zinc-900/80 border border-indigo-500/20 rounded-2xl p-5 shadow-xl space-y-4 animate-in slide-in-from-top-2"
              >
                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Task Manually
                </h3>

                {/* Title */}
                <input
                  type="text"
                  placeholder="Task title *"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
                  autoFocus
                  required
                />

                {/* Description */}
                <textarea
                  placeholder="Description (optional)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all resize-none"
                />

                {/* Deadline */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1 block">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting || !newTitle.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  {isSubmitting ? 'Adding...' : '+ Add Task'}
                </button>
              </form>
            )}

            {/* Task List */}
            {isLoading ? (
              <div className="py-12 text-center text-zinc-500 text-xs">Loading task matrix...</div>
            ) : tasks.length === 0 ? (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-xs">
                No active tasks yet! Use the AI chatbot or click &quot;+ Add Task&quot; above.
              </div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteTask}
                    onUpdateTask={handleUpdateTask}
                  />
                ))}

                {tasks.some((t) => t.status === 'COMPLETED') && (
                  <div className="pt-2 text-center">
                    <button
                      onClick={handleClearCompleted}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 text-xs font-semibold rounded-xl border border-zinc-800 transition-all shadow"
                    >
                      🧹 Clear All Completed Tasks ({tasks.filter((t) => t.status === 'COMPLETED').length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
