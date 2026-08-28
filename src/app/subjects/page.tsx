'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { BookOpen, Plus, Loader2 } from 'lucide-react';

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
  const [colorHex, setColorHex] = useState('#818cf8');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/subjects');
      if (res.ok) setSubjects(await res.json());
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchSubjects(); }, []);

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
      if (res.ok) { setName(''); setCode(''); fetchSubjects(); }
    } catch (err) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const sampleColors = [
    '#818cf8', '#a78bfa', '#f472b6', '#fb7185',
    '#34d399', '#2dd4bf', '#38bdf8', '#fbbf24',
    '#fb923c', '#a3e635',
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 animate-fade-up">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">Categories</h1>
            <p className="text-xs text-zinc-500">Organize tasks by life area, project, or subject.</p>
          </div>
        </div>

        {/* Add Form */}
        <form onSubmit={handleCreateSubject} className="glass rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-up" style={{ animationDelay: '50ms' }}>
          <h2 className="text-xs font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
            <Plus className="w-3.5 h-3.5" /> New Category
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Work, Finance, Fitness"
                className="w-full bg-zinc-950/60 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Short Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. WORK, FIN, CS301"
                className="w-full bg-zinc-950/60 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-2">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {sampleColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorHex(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all duration-200 ${
                    colorHex === c ? 'scale-125 border-white ring-2 ring-offset-2 ring-offset-zinc-900 ring-indigo-500/50' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Category'}
          </button>
        </form>

        {/* Categories Grid */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Your Categories ({subjects.length})
          </h2>

          {isLoading ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-zinc-500 text-xs">Loading...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center animate-fade-up">
              <div className="text-3xl mb-3">📂</div>
              <p className="text-sm text-zinc-400">No categories yet. Create your first one above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="glass rounded-xl p-4 flex items-center gap-3.5 card-hover"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: sub.colorHex + '25', borderColor: sub.colorHex + '40', borderWidth: 1 }}
                  >
                    <span style={{ color: sub.colorHex }}>{(sub.code || sub.name)[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{sub.name}</h3>
                    {sub.code && <p className="text-xs text-zinc-500 font-mono">{sub.code}</p>}
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
