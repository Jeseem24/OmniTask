'use client';

import React, { useState } from 'react';
import { getPriorityTier } from '@/lib/priorityEngine';
import { CheckCircle2, Circle, Trash2, Calendar, Pencil, Check, X, AlertTriangle, GripVertical, Maximize2, Sparkles, Clock } from 'lucide-react';

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  taskType: string;
  status: string;
  priorityScore: number;
  importance: number;
  deadline?: string | Date | null;
  isDeadlineAmbiguous?: boolean;
  estimatedEffortMins: number;
  subject?: { name: string; code?: string | null; colorHex?: string } | null;
  subtasks?: TaskItem[];
  source?: { type: string } | null;
}

interface TaskCardProps {
  task: TaskItem;
  onToggleComplete: (id: string, currentStatus: string) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updatedData: Partial<TaskItem>) => void;
  onSelectTask?: (task: TaskItem) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
}

function isOverdue(deadline: string | Date | null | undefined): boolean {
  if (!deadline) return false;
  try {
    const d = new Date(deadline);
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  } catch { return false; }
}

function isDueToday(deadline: string | Date | null | undefined): boolean {
  if (!deadline) return false;
  try {
    const d = new Date(deadline);
    return !isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
  } catch { return false; }
}

function getRelativeDeadline(deadline: string | Date | null | undefined): string {
  if (!deadline) return 'No deadline';
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return 'No deadline';
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    const diffDays = Math.ceil(diffHrs / 24);

    if (diffHrs < 0) return 'Overdue';
    if (d.toDateString() === now.toDateString()) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    if (diffDays <= 7) return `${diffDays} days left`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return 'No deadline'; }
}

export default function TaskCard({
  task,
  onToggleComplete,
  onDelete,
  onUpdateTask,
  onSelectTask,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  const safeGetIsoDate = (dVal: any) => {
    if (!dVal) return '';
    try {
      const d = new Date(dVal);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch { return ''; }
  };

  const [editDeadline, setEditDeadline] = useState(safeGetIsoDate(task.deadline));
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editImportance, setEditImportance] = useState(task.importance || 3);
  const [isSaving, setIsSaving] = useState(false);

  const isCompleted = task.status === 'COMPLETED';
  const tier = getPriorityTier(task.priorityScore, task.importance);
  const overdue = !isCompleted && isOverdue(task.deadline);
  const dueToday = !isCompleted && isDueToday(task.deadline);
  const deadlineText = getRelativeDeadline(task.deadline);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCompleted) {
      const confirmed = window.confirm(`Delete "${task.title}"?`);
      if (!confirmed) return;
    }
    onDelete(task.id);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editTitle.trim()) return;
    setIsSaving(true);
    try {
      if (onUpdateTask) {
        await onUpdateTask(task.id, {
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          deadline: editDeadline ? editDeadline : null,
          importance: editImportance,
        });
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Update task error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      draggable={!isCompleted && !isEditing}
      onDragStart={(e) => onDragStart && onDragStart(e, task.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver && onDragOver(e, task.id);
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop && onDrop(e, task.id)}
      onClick={() => {
        if (!isEditing && onSelectTask) onSelectTask(task);
      }}
      className={`group relative rounded-2xl p-[1px] transition-all duration-300 cursor-pointer ${
        isDragging
          ? 'opacity-30 scale-[0.98]'
          : isDragOver
          ? 'scale-[1.01] shadow-[0_0_25px_rgba(99,102,241,0.3)]'
          : isCompleted
          ? 'opacity-45'
          : overdue
          ? 'shadow-[0_0_20px_rgba(239,68,68,0.15)]'
          : 'hover:scale-[1.008] hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.6)]'
      }`}
      style={{
        background: isDragOver
          ? 'linear-gradient(135deg, rgba(99,102,241,0.8), rgba(168,85,247,0.8))'
          : overdue
          ? 'linear-gradient(135deg, rgba(239,68,68,0.4), rgba(255,255,255,0.06))'
          : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
      }}
    >
      {/* Inner Hardware Core */}
      <div className={`rounded-[calc(1rem-1px)] p-4 sm:p-5 transition-all duration-300 ${
        isCompleted
          ? 'bg-zinc-950/40'
          : overdue
          ? 'bg-zinc-950/90'
          : 'bg-[#0d0d11]/85 backdrop-blur-xl group-hover:bg-[#111116]/90'
      }`}>
        {/* Top: Priority Tier & Relative Deadline */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded-full border shadow-sm ${tier.bgClass} ${tier.colorClass}`}>
              {tier.label}
            </span>

            {task.deadline && !isCompleted && (
              <span className={`flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                overdue
                  ? 'text-red-400 bg-red-500/10 border-red-500/25 animate-pulse-subtle'
                  : dueToday
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                  : 'text-zinc-400 bg-white/[0.03] border-white/[0.06]'
              }`}>
                {overdue ? <AlertTriangle className="w-3 h-3 text-red-400" /> : <Clock className="w-3 h-3 text-zinc-400" />}
                {deadlineText}
              </span>
            )}
          </div>

          {/* Grip Drag Handle */}
          {!isCompleted && (
            <div
              className="text-zinc-600 group-hover:text-zinc-400 p-1 cursor-grab active:cursor-grabbing hover:bg-white/[0.05] rounded-md transition-colors"
              title="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Main Body */}
        <div className="flex items-start gap-3.5">
          {/* Checkbox Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(task.id, task.status);
            }}
            className="mt-0.5 flex-shrink-0 transition-transform active:scale-90"
          >
            {isCompleted ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border border-zinc-700 group-hover:border-indigo-400 hover:scale-110 transition-all flex items-center justify-center" />
            )}
          </button>

          {/* Task Info / Quick Edit */}
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-3 pt-0.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-indigo-500/50 rounded-xl px-3 py-2 text-sm text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                  placeholder="Task title"
                  autoFocus
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-950 border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none"
                  placeholder="Notes / context..."
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">Priority</label>
                    <select
                      value={editImportance}
                      onChange={(e) => setEditImportance(parseInt(e.target.value, 10))}
                      className="bg-zinc-950 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value={5}>🔴 Critical</option>
                      <option value={4}>🟠 High</option>
                      <option value={3}>🟢 Medium</option>
                      <option value={1}>⚪ Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 block mb-1">Deadline</label>
                    <input
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="bg-zinc-950 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editTitle.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                      setEditTitle(task.title);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 glass text-zinc-400 hover:text-white rounded-lg text-xs transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h4 className={`text-sm font-semibold tracking-tight leading-snug transition-colors ${
                  isCompleted
                    ? 'line-through text-zinc-500'
                    : 'text-zinc-100 group-hover:text-white'
                }`}>
                  {task.title}
                </h4>

                {task.description && (
                  <p className={`text-xs mt-1 leading-relaxed line-clamp-2 ${
                    isCompleted ? 'text-zinc-600' : 'text-zinc-400'
                  }`}>
                    {task.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Pod Controls (Hover Reveal) */}
          {!isEditing && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectTask) onSelectTask(task);
                }}
                className="p-1.5 text-zinc-400 hover:text-indigo-300 rounded-lg hover:bg-white/[0.06] transition-colors"
                title="Inspect Task"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/[0.06] transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleDelete}
                className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
