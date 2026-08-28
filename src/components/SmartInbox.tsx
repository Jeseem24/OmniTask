'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileText, Image as ImageIcon, Send, Loader2, UploadCloud, Edit3 } from 'lucide-react';

export default function SmartInbox() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'manual'>('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualTitle, setManualTitle] = useState('');
  const [manualType, setManualType] = useState('PERSONAL');
  const [manualDeadline, setManualDeadline] = useState('');
  const [manualEffort, setManualEffort] = useState(30);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim()) return;
    setIsProcessing(true); setError(null);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'WHATSAPP_TEXT', content: textContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process');
      router.push(`/review/${data.extractionId}`);
    } catch (err: any) {
      setError(err.message || 'Extraction error');
    } finally { setIsProcessing(false); }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsProcessing(true); setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', file.type.includes('pdf') ? 'PDF' : 'SCREENSHOT');
      const res = await fetch('/api/intake', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process');
      router.push(`/review/${data.extractionId}`);
    } catch (err: any) {
      setError(err.message || 'File extraction error');
    } finally { setIsProcessing(false); }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    setIsProcessing(true); setError(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle, taskType: manualType,
          deadlineISO: manualDeadline ? new Date(manualDeadline).toISOString() : null,
          estimatedEffortMins: Number(manualEffort),
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally { setIsProcessing(false); }
  };

  const tabs = [
    { key: 'text' as const, icon: FileText, label: 'Paste Text' },
    { key: 'file' as const, icon: ImageIcon, label: 'Upload File' },
    { key: 'manual' as const, icon: Edit3, label: 'Manual Entry' },
  ];

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 shadow-2xl max-w-3xl mx-auto animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">Smart Inbox</h2>
          <p className="text-xs text-zinc-500">Paste messages, upload files, or create tasks directly.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-black/20 p-1 rounded-xl border border-white/[0.06] mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 text-xs font-medium">{error}</div>
      )}

      {activeTab === 'text' && (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <textarea
            rows={5}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste a WhatsApp message, email, or note..."
            className="w-full bg-zinc-950/60 border border-white/[0.08] rounded-xl p-4 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none transition-all"
          />
          <button type="submit" disabled={isProcessing || !textContent.trim()}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]">
            {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Sparkles className="w-4 h-4" /> Extract Tasks</>}
          </button>
        </form>
      )}

      {activeTab === 'file' && (
        <form onSubmit={handleFileSubmit} className="space-y-4">
          <div className="border-2 border-dashed border-white/[0.08] hover:border-indigo-500/30 bg-zinc-950/40 rounded-2xl p-8 text-center transition-all cursor-pointer relative">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-indigo-400">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{file ? file.name : 'Click or drag & drop'}</p>
                <p className="text-xs text-zinc-600 mt-1">Screenshots, PDFs (max 15MB)</p>
              </div>
            </div>
          </div>
          <button type="submit" disabled={isProcessing || !file}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]">
            {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><Sparkles className="w-4 h-4" /> Process File</>}
          </button>
        </form>
      )}

      {activeTab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <input type="text" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Task title"
            className="w-full bg-zinc-950/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" required />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={manualType} onChange={(e) => setManualType(e.target.value)}
              className="bg-zinc-950/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
              <option value="PERSONAL">Personal</option>
              <option value="WORK">Work</option>
              <option value="FINANCE">Finance</option>
              <option value="HEALTH">Health</option>
              <option value="ERRAND">Errand</option>
              <option value="PROJECT">Project</option>
              <option value="ASSIGNMENT">Assignment</option>
              <option value="LEARNING">Learning</option>
              <option value="OTHER">Other</option>
            </select>
            <input type="datetime-local" value={manualDeadline} onChange={(e) => setManualDeadline(e.target.value)}
              className="bg-zinc-950/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            <input type="number" value={manualEffort} onChange={(e) => setManualEffort(Number(e.target.value))} min={5} step={5} placeholder="Effort (mins)"
              className="bg-zinc-950/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <button type="submit" disabled={isProcessing || !manualTitle.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]">
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
          </button>
        </form>
      )}
    </div>
  );
}
