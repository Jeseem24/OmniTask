'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExtractedCandidateTask } from '@/lib/aiExtractor';
import { Sparkles, Check, Trash2, Plus, Edit2, AlertCircle, Clock, Calendar, CheckSquare, Loader2 } from 'lucide-react';

interface ReviewDeskProps {
  extractionId: string;
  sourceId: string;
  initialCandidateTasks: ExtractedCandidateTask[];
  rawSourceText?: string | null;
}

export default function ReviewDesk({
  extractionId,
  sourceId,
  initialCandidateTasks,
  rawSourceText,
}: ReviewDeskProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<ExtractedCandidateTask[]>(initialCandidateTasks);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateTask = (index: number, field: keyof ExtractedCandidateTask, value: any) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value, userModified: true };
    setTasks(updated);
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleAddSubtask = (taskIndex: number) => {
    const updated = [...tasks];
    const subtasks = updated[taskIndex].subtasks || [];
    updated[taskIndex].subtasks = [
      ...subtasks,
      { title: 'New step', estimatedEffortMins: 15, taskType: 'SUBMISSION' },
    ];
    setTasks(updated);
  };

  const handleUpdateSubtask = (taskIndex: number, subIndex: number, title: string) => {
    const updated = [...tasks];
    if (updated[taskIndex].subtasks) {
      updated[taskIndex].subtasks![subIndex].title = title;
      setTasks(updated);
    }
  };

  const handleRemoveSubtask = (taskIndex: number, subIndex: number) => {
    const updated = [...tasks];
    if (updated[taskIndex].subtasks) {
      updated[taskIndex].subtasks = updated[taskIndex].subtasks!.filter((_, i) => i !== subIndex);
      setTasks(updated);
    }
  };

  const handleConfirmAll = async () => {
    if (tasks.length === 0) {
      router.push('/');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/tasks/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractionId,
          sourceId,
          confirmedTasks: tasks,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to confirm tasks');
      }

      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while confirming tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-zinc-900 border border-indigo-500/30 rounded-2xl p-6 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 mt-1">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              Human Review Desk
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                {tasks.length} Tasks Extracted
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              AI interprets. You decide. Verify deadlines and steps before creating active tasks.
            </p>
          </div>
        </div>

        <button
          onClick={handleConfirmAll}
          disabled={isSubmitting || tasks.length === 0}
          className="py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all flex-shrink-0"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Tasks...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirm All Tasks ({tasks.length})
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Raw Source Text Drawer if present */}
      {rawSourceText && (
        <details className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
          <summary className="font-semibold text-zinc-300 cursor-pointer hover:text-zinc-100">
            View Raw Input Source Text
          </summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-zinc-300">
            {rawSourceText}
          </pre>
        </details>
      )}

      {/* Candidate Tasks Card List */}
      {tasks.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
          No tasks remaining. Click confirm or head back to Dashboard.
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <div
              key={index}
              className="bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 shadow-lg space-y-4 transition-all"
            >
              {/* Task Header: Title & Subject */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => handleUpdateTask(index, 'title', e.target.value)}
                    className="w-full bg-zinc-950/90 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-100 focus:outline-none"
                    placeholder="Task Title"
                  />
                  <input
                    type="text"
                    value={task.description || ''}
                    onChange={(e) => handleUpdateTask(index, 'description', e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800/80 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
                    placeholder="Optional description / notes..."
                  />
                </div>

                <button
                  onClick={() => handleRemoveTask(index)}
                  className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-zinc-800 transition-colors"
                  title="Discard candidate task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* Category / Area Name */}
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Category / Area</label>
                  <input
                    type="text"
                    value={task.subjectName || ''}
                    onChange={(e) => handleUpdateTask(index, 'subjectName', e.target.value)}
                    placeholder="e.g. Work, Finance, Academics"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Task Type */}
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Task Type</label>
                  <select
                    value={task.taskType}
                    onChange={(e) => handleUpdateTask(index, 'taskType', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="WORK">Work</option>
                    <option value="FINANCE">Finance / Bills</option>
                    <option value="HEALTH">Health</option>
                    <option value="ERRAND">Errand</option>
                    <option value="PROJECT">Project</option>
                    <option value="ASSIGNMENT">Assignment / Academic</option>
                    <option value="RECORD">Record</option>
                    <option value="SUBMISSION">Submission</option>
                    <option value="QUIZ">Quiz / Test</option>
                    <option value="EXAM">Exam</option>
                    <option value="READING">Reading</option>
                    <option value="PRACTICE">Practice</option>
                    <option value="EVENT">Event</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* Deadline */}
                <div>
                  <label className="block font-medium text-zinc-400 mb-1 flex items-center justify-between">
                    <span>Deadline</span>
                    {task.isDeadlineAmbiguous && (
                      <span className="text-[10px] text-amber-400 font-normal">Ambiguous</span>
                    )}
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      task.deadlineISO
                        ? new Date(task.deadlineISO).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) =>
                      handleUpdateTask(
                        index,
                        'deadlineISO',
                        e.target.value ? new Date(e.target.value).toISOString() : null
                      )
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Estimated Effort */}
                <div>
                  <label className="block font-medium text-zinc-400 mb-1">Effort (Mins)</label>
                  <input
                    type="number"
                    value={task.estimatedEffortMins}
                    onChange={(e) =>
                      handleUpdateTask(index, 'estimatedEffortMins', Number(e.target.value))
                    }
                    step={5}
                    min={5}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Subtasks Section */}
              <div className="pt-2 border-t border-zinc-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-400">Subtasks & Steps</span>
                  <button
                    type="button"
                    onClick={() => handleAddSubtask(index)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>

                {task.subtasks && task.subtasks.length > 0 && (
                  <div className="space-y-1.5">
                    {task.subtasks.map((sub, subIndex) => (
                      <div key={subIndex} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={sub.title}
                          onChange={(e) => handleUpdateSubtask(index, subIndex, e.target.value)}
                          className="flex-1 bg-zinc-950 border border-zinc-800/80 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(index, subIndex)}
                          className="text-zinc-500 hover:text-red-400 p-1"
                        >
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
