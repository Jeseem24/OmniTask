'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import TaskCard, { TaskItem } from '@/components/TaskCard';
import { Compass, Clock, Sparkles, Target } from 'lucide-react';

export default function SmartPlannerPage() {
  const [availableMins, setAvailableMins] = useState<number>(60);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeOptions = [
    { label: '30m', value: 30 },
    { label: '45m', value: 45 },
    { label: '1hr', value: 60 },
    { label: '1.5hr', value: 90 },
    { label: '2hr', value: 120 },
    { label: '3hr', value: 180 },
  ];

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks?status=PENDING&availableMins=${availableMins}`);
      if (!res.ok) throw new Error('Failed to fetch');
      setTasks(await res.json());
    } catch (err: any) {
      setError(err.message || 'Error fetching recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchRecommendations(); }, [availableMins]);

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
    } catch (err) { console.error(err); }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try { await fetch(`/api/tasks/${id}`, { method: 'DELETE' }); }
    catch (err) { console.error(err); }
  };

  const topTask = tasks[0];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Banner */}
        <div className="relative glass rounded-3xl p-6 sm:p-8 overflow-hidden animate-fade-up">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">Smart Planner</h1>
                <p className="text-xs text-zinc-500">How much time do you have? I'll pick the best tasks.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {timeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAvailableMins(opt.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 ${
                    availableMins === opt.value
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 border border-purple-400/40'
                      : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Focus Card */}
        {topTask && (
          <div className="glass rounded-2xl p-5 sm:p-6 border-l-4 border-l-indigo-500 animate-fade-up" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
              <Target className="w-4 h-4" />
              Recommended Focus ({availableMins}m window)
            </div>
            <p className="text-zinc-200 text-sm leading-relaxed">
              Start with{' '}
              <span className="font-bold text-white">{topTask.title}</span>{' '}
              <span className="text-zinc-500">({topTask.estimatedEffortMins}m)</span>
              {topTask.deadline && (
                <span className="text-zinc-500">
                  {' '}— due {new Date(topTask.deadline).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Task List */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Work Queue
            </span>
            <span className="text-xs font-normal text-zinc-600">
              Tasks ≤ {availableMins}m
            </span>
          </h2>

          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-500 text-xs">Finding optimal tasks...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-xs">{error}</div>
          ) : tasks.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center animate-fade-up">
              <div className="text-3xl mb-3">🎯</div>
              <p className="text-sm text-zinc-400">No tasks fit your {availableMins}-minute window. Try a larger budget!</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
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
