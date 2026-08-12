'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { BookOpen, Plus, Loader2, Tag } from 'lucide-react';

interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
  colorHex: string;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [colorHex, setColorHex] = useState('#3B82F6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, colorHex }),
      });

      if (res.ok) {
        setName('');
        setCode('');
        fetchSubjects();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sampleColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100">Categories & Life Areas</h1>
            <p className="text-xs text-zinc-400">
              Organize your tasks across Personal, Work, Finance, Health, Projects, and Academics.
            </p>
          </div>
        </div>

        {/* Add Subject Card */}
        <form
          onSubmit={handleCreateSubject}
          className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4"
        >
          <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" /> Add New Category or Area
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Category Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Work, Finance, Fitness"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Short Code / Tag</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WORK, FIN, CS301"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Theme Color</label>
              <div className="flex items-center gap-2">
                {sampleColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorHex(c)}
                    className={`w-6 h-6 rounded-full border transition-all ${
                      colorHex === c ? 'scale-125 border-white ring-2 ring-indigo-500/50' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all shadow-md"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Subject'}
          </button>
        </form>

        {/* Subjects List Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
            Your Courses ({subjects.length})
          </h2>

          {isLoading ? (
            <div className="py-8 text-center text-zinc-500 text-xs">Loading course catalog...</div>
          ) : subjects.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-xs">
              No course subjects created yet. Add your first subject above!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 shadow-md"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: sub.colorHex || '#3B82F6' }}
                  />
                  <div>
                    <h3 className="font-bold text-sm text-zinc-100">{sub.name}</h3>
                    {sub.code && <p className="text-xs text-zinc-400">{sub.code}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
