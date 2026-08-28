'use client';

import React, { useState, useEffect } from 'react';
import { TaskItem } from './TaskCard';
import { getPriorityTier } from '@/lib/priorityEngine';
import { X, Calendar, Clock, AlertTriangle, CheckCircle2, Circle, Trash2, Tag, Sparkles, Check, Save } from 'lucide-react';
import { toast } from '@/lib/toast';

interface TaskDetailModalProps {
  task: TaskItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (id: string, updatedData: Partial<TaskItem>) => void;
  onToggleComplete: (id: string, currentStatus: string) => void;
  onDelete: (id: string) => void;
}

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onToggleComplete,
  onDelete,
}: TaskDetailModalProps) {
  if (!isOpen || !task) return null;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [deadline, setDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''
  );
  const [importance, setImportance] = useState(task.importance || 3);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setDeadline(task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '');
    setImportance(task.importance || 3);
  }, [task]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isCompleted = task.status === 'COMPLETED';
  const tier = getPriorityTier(task.priorityScore);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateTask(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        importance,
      });
      toast.success('Task details saved');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    const confirmed = window.confirm(`Delete "${task.title}"?`);
    if (confirmed) {
      onDelete(task.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl glass border border-white/[0.12] rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-in max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-zinc-950/40">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs uppercase tracking-wider font-bold px-2.5 py-1 rounded-xl border ${tier.bgClass} ${tier.colorClass}`}>
              {tier.label} Priority
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-xl font-semibold border ${
              isCompleted
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
            }`}>
              {isCompleted ? '✓ Completed' : '⚡ Active'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl glass hover:border-white/20 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Title Field */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950/80 border border-white/[0.1] rounded-2xl px-4 py-3 text-base text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition-all"
              placeholder="What needs to be done?"
            />
          </div>

          {/* Description / Notes Field */}
          <div>
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Description & Context
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Add detailed instructions, links, or context..."
              className="w-full bg-zinc-950/80 border border-white/[0.1] rounded-2xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Grid: Deadline + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Deadline */}
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Target Deadline
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Importance Level
              </label>
              <select
                value={importance}
                onChange={(e) => setImportance(parseInt(e.target.value, 10))}
                className="w-full bg-zinc-950/80 border border-white/[0.1] rounded-2xl px-4 py-2.5 text-sm text-zinc-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value={5}>🔴 Critical (Urgent focus)</option>
                <option value={4}>🟠 High (Important)</option>
                <option value={3}>🟢 Medium (Normal priority)</option>
                <option value={1}>⚪ Low (Whenever possible)</option>
              </select>
            </div>
          </div>

          {/* Subtasks Section if any */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="pt-2">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                Subtasks ({task.subtasks.length})
              </label>
              <div className="space-y-2">
                {task.subtasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-2 p-2.5 bg-zinc-950/40 border border-white/[0.04] rounded-xl text-xs text-zinc-300">
                    <span className="text-indigo-400">•</span>
                    <span>{st.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-zinc-950/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleComplete(task.id, task.status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                isCompleted
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
              }`}
            >
              {isCompleted ? <Circle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {isCompleted ? 'Mark Active' : 'Mark Complete'}
            </button>

            <button
              onClick={handleDelete}
              className="p-2 text-zinc-500 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-all active:scale-95"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-xl glass hover:border-white/20 transition-all"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
