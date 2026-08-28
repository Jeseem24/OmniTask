'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExtractedCandidateTask } from '@/lib/aiExtractor';
import { Sparkles, Check, Trash2, Plus, Loader2 } from 'lucide-react';

interface ReviewDeskProps {
  extractionId: string;
  sourceId: string;
  initialCandidateTasks: ExtractedCandidateTask[];
  rawSourceText?: string | null;
}

export default function ReviewDesk({ extractionId, sourceId, initialCandidateTasks, rawSourceText }: ReviewDeskProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<ExtractedCandidateTask[]>(initialCandidateTasks);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateTask = (index: number, field: keyof ExtractedCandidateTask, value: any) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value, userModified: true };
    setTasks(updated);
  };

  const handleRemoveTask = (index: number) => setTasks(tasks.filter((_, i) => i !== index));

  const handleAddSubtask = (taskIndex: number) => {
    const updated = [...tasks];
    updated[taskIndex].subtasks = [...(updated[taskIndex].subtasks || []), { title: 'New step', estimatedEffortMins: 15, taskType: 'SUBMISSION' }];
    setTasks(updated);
  };

  const handleUpdateSubtask = (taskIndex: number, subIndex: number, title: string) => {
    const updated = [...tasks];
    if (updated[taskIndex].subtasks) { updated[taskIndex].subtasks![subIndex].title = title; setTasks(updated); }
  };

  const handleRemoveSubtask = (taskIndex: number, subIndex: number) => {
    const updated = [...tasks];
    if (updated[taskIndex].subtasks) {
      updated[taskIndex].subtasks = updated[taskIndex].subtasks!.filter((_, i) => i !== subIndex);
      setTasks(updated);
    }
  };

  const handleConfirmAll = async () => {
    if (tasks.length === 0) { router.push('/'); return; }
    setIsSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/tasks/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractionId, sourceId, confirmedTasks: tasks }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to confirm'); }
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Error confirming tasks');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="glass rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-up">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              Review Desk
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-medium">{tasks.length} tasks</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Verify and edit before saving to your task list.</p>
          </div>
        </div>
        <button onClick={handleConfirmAll} disabled={isSubmitting || tasks.length === 0}
          className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all flex-shrink-0 active:scale-95">
          {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Confirm All ({tasks.length})</>}
        </button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-xs">{error}</div>}

      {rawSourceText && (
        <details className="glass rounded-xl p-4 text-xs text-zinc-400">
          <summary className="font-semibold text-zinc-300 cursor-pointer hover:text-white transition-colors">View Source Text</summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans bg-zinc-950/60 p-3 rounded-lg border border-white/[0.06] text-zinc-400">{rawSourceText}</pre>
        </details>
      )}

      {tasks.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center animate-fade-up">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm text-zinc-400">No tasks remaining. Click confirm or head back.</p>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {tasks.map((task, index) => (
            <div key={index} className="glass rounded-2xl p-5 space-y-4 card-hover">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <input type="text" value={task.title} onChange={(e) => handleUpdateTask(index, 'title', e.target.value)}
                    className="w-full bg-zinc-950/60 border border-white/[0.08] focus:border-indigo-500/40 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition-all" />
                  <input type="text" value={task.description || ''} onChange={(e) => handleUpdateTask(index, 'description', e.target.value)}
                    className="w-full bg-zinc-950/40 border border-white/[0.05] focus:border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-zinc-400 focus:outline-none transition-all" placeholder="Description..." />
                </div>
                <button onClick={() => handleRemoveTask(index)} className="p-2 text-zinc-600 hover:text-red-400 rounded-lg hover:bg-white/[0.04] transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-zinc-500 mb-1">Category</label>
                  <input type="text" value={task.subjectName || ''} onChange={(e) => handleUpdateTask(index, 'subjectName', e.target.value)} placeholder="e.g. Work"
                    className="w-full bg-zinc-950/60 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-indigo-500/40 transition-all" />
                </div>
                <div>
                  <label className="block font-medium text-zinc-500 mb-1">Type</label>
                  <select value={task.taskType} onChange={(e) => handleUpdateTask(index, 'taskType', e.target.value)}
                    className="w-full bg-zinc-950/60 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-indigo-500/40">
                    {['PERSONAL','WORK','FINANCE','HEALTH','ERRAND','PROJECT','ASSIGNMENT','SUBMISSION','EXAM','QUIZ','READING','EVENT','LEARNING','OTHER'].map(t => (
                      <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-zinc-500 mb-1">Deadline</label>
                  <input type="datetime-local" value={task.deadlineISO ? new Date(task.deadlineISO).toISOString().slice(0, 16) : ''}
                    onChange={(e) => handleUpdateTask(index, 'deadlineISO', e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="w-full bg-zinc-950/60 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-indigo-500/40 transition-all" />
                </div>
                <div>
                  <label className="block font-medium text-zinc-500 mb-1">Effort (mins)</label>
                  <input type="number" value={task.estimatedEffortMins} onChange={(e) => handleUpdateTask(index, 'estimatedEffortMins', Number(e.target.value))}
                    step={5} min={5}
                    className="w-full bg-zinc-950/60 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-indigo-500/40" />
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">Subtasks</span>
                  <button type="button" onClick={() => handleAddSubtask(index)} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors">
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>
                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="space-y-1.5">
                    {task.subtasks.map((sub, subIndex) => (
                      <div key={subIndex} className="flex items-center gap-2">
                        <input type="text" value={sub.title} onChange={(e) => handleUpdateSubtask(index, subIndex, e.target.value)}
                          className="flex-1 bg-zinc-950/40 border border-white/[0.04] rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/40" />
                        <button type="button" onClick={() => handleRemoveSubtask(index, subIndex)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
