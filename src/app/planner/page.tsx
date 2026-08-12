'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import TaskCard, { TaskItem } from '@/components/TaskCard';
import { Compass, Clock, Sparkles, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function SmartPlannerPage() {
  const [availableMins, setAvailableMins] = useState<number>(60);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeOptions = [
    { label: '30 Mins', value: 30 },
    { label: '45 Mins', value: 45 },
    { label: '60 Mins (1 hr)', value: 60 },
    { label: '90 Mins (1.5 hrs)', value: 90 },
    { label: '120 Mins (2 hrs)', value: 120 },
  ];

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks?status=PENDING&availableMins=${availableMins}`);
      if (!res.ok) throw new Error('Failed to fetch recommendations');
      const data = await res.json();
      setTasks(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [availableMins]);

  const handleToggleComplete = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchRecommendations();
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

  const topTask = tasks[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-purple-950/50 via-indigo-950/40 to-zinc-900 border border-purple-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-zinc-100">Smart Execution Planner</h1>
              <p className="text-xs text-zinc-400">
                How much time do you have right now? The assistant selects the best high-impact work block.
              </p>
            </div>
          </div>

          {/* Time Selector Pills */}
          <div className="mt-6">
            <label className="block text-xs font-semibold text-zinc-400 mb-2">
              Select Your Available Time Budget:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {timeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAvailableMins(opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    availableMins === opt.value
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/50 scale-[1.03]'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Focus Rationale Card */}
        {topTask && (
          <div className="bg-gradient-to-br from-indigo-900/40 via-zinc-900 to-zinc-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Recommended Action for tonight ({availableMins} mins)
            </div>

            <div className="text-zinc-200 text-sm leading-relaxed">
              Based on deadline urgency, importance rating, and effort fit, you should focus on{' '}
              <span className="font-bold text-white underline decoration-indigo-500 underline-offset-4">
                {topTask.title}
              </span>{' '}
              ({topTask.estimatedEffortMins} mins).
              {topTask.deadline && (
                <span className="text-zinc-400 font-normal">
                  {' '}
                  It is due on{' '}
                  {new Date(topTask.deadline).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                  .
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tasks List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-zinc-200 flex items-center justify-between">
            <span>Recommended Work Queue</span>
            <span className="text-xs font-normal text-zinc-400">
              Showing tasks fitting ≤ {availableMins} mins
            </span>
          </h2>

          {isLoading ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              Calculating optimal task recommendation matrix...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 text-sm">
              No tasks match your {availableMins}-minute time window. Try selecting a larger time budget above!
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
