import React, { useState } from 'react';
import { getPriorityTier } from '@/lib/priorityEngine';
import { CheckCircle2, Circle, Trash2, Calendar, Pencil, Check, X } from 'lucide-react';

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
}

export default function TaskCard({ task, onToggleComplete, onDelete, onUpdateTask }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const safeGetIsoDate = (dVal: any) => {
    if (!dVal) return '';
    try {
      const d = new Date(dVal);
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const safeFormatDate = (dVal: any) => {
    if (!dVal) return 'No Deadline';
    try {
      const d = new Date(dVal);
      return isNaN(d.getTime()) ? 'No Deadline' : d.toLocaleDateString('en-GB');
    } catch (e) {
      return 'No Deadline';
    }
  };

  const [editDeadline, setEditDeadline] = useState(safeGetIsoDate(task.deadline));
  const [editImportance, setEditImportance] = useState(task.importance || 3);
  const [isSaving, setIsSaving] = useState(false);

  const isCompleted = task.status === 'COMPLETED';
  const tier = getPriorityTier(task.priorityScore);

  const formattedDeadline = safeFormatDate(task.deadline);

  const handleDelete = () => {
    // Confirmation prompt ONLY for Active (PENDING) tasks
    if (!isCompleted) {
      const confirmed = window.confirm(`Are you sure you want to delete active task "${task.title}"?`);
      if (!confirmed) return;
    }
    // Finished tasks deleted immediately with zero confirmation
    onDelete(task.id);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;
    setIsSaving(true);
    try {
      if (onUpdateTask) {
        await onUpdateTask(task.id, {
          title: editTitle.trim(),
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
      className={`group rounded-2xl border transition-all duration-200 ${
        isCompleted
          ? 'bg-zinc-950/40 border-zinc-800/40 opacity-65'
          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 shadow-lg hover:shadow-xl'
      }`}
    >
      <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
        {/* Left Side: Checkbox & Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={() => onToggleComplete(task.id, task.status)}
            className="mt-0.5 text-zinc-500 hover:text-indigo-400 transition-colors flex-shrink-0"
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              /* Inline Edit Mode Form */
              <div className="space-y-3 pt-0.5">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-sm text-zinc-100 font-semibold focus:outline-none"
                  placeholder="Task title"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">Priority</label>
                    <select
                      value={editImportance}
                      onChange={(e) => setEditImportance(parseInt(e.target.value, 10))}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 font-bold focus:outline-none"
                    >
                      <option value={5} className="text-red-400">🔴 Critical</option>
                      <option value={4} className="text-amber-400">🟠 High</option>
                      <option value={3} className="text-emerald-400">🟢 Medium</option>
                      <option value={1} className="text-zinc-400">⚪ Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-semibold block mb-0.5">Due Date</label>
                    <input
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editTitle.trim()}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow"
                  >
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Normal View Mode */
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {/* Task Title */}
                  <h3
                    className={`font-semibold text-base text-zinc-100 truncate ${
                      isCompleted ? 'line-through text-zinc-500' : ''
                    }`}
                  >
                    {task.title}
                  </h3>

                  {/* Priority Badge */}
                  <span
                    className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full border ${tier.bgClass} ${tier.colorClass}`}
                  >
                    {tier.label} Priority
                  </span>

                  {/* Deadline badge if present */}
                  {task.deadline && (
                    <span suppressHydrationWarning className="flex items-center gap-1 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      {formattedDeadline}
                    </span>
                  )}
                </div>

                {/* Description Preview if exists */}
                {task.description && (
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{task.description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Controls */}
        {!isEditing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Edit button */}
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 text-zinc-500 hover:text-indigo-400 rounded-lg hover:bg-zinc-800 transition-colors"
              title="Edit task"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Trash button */}
            <button
              onClick={handleDelete}
              className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
              title={isCompleted ? "Delete finished task" : "Delete active task"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
