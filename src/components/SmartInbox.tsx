'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, FileText, Image as ImageIcon, FileCode, Send, Loader2, UploadCloud, Edit3 } from 'lucide-react';

export default function SmartInbox() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'manual'>('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual entry fields
  const [manualTitle, setManualTitle] = useState('');
  const [manualType, setManualType] = useState('ASSIGNMENT');
  const [manualDeadline, setManualDeadline] = useState('');
  const [manualEffort, setManualEffort] = useState(30);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'WHATSAPP_TEXT', content: textContent }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process intake');

      router.push(`/review/${data.extractionId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during extraction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', file.type.includes('pdf') ? 'PDF' : 'SCREENSHOT');

      const res = await fetch('/api/intake', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process file');

      router.push(`/review/${data.extractionId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during file extraction');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle,
          taskType: manualType,
          deadlineISO: manualDeadline ? new Date(manualDeadline).toISOString() : null,
          estimatedEffortMins: Number(manualEffort),
        }),
      });

      if (!res.ok) throw new Error('Failed to create manual task');
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create task');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Smart Intake Desk</h2>
          <p className="text-xs text-zinc-400">
            Paste WhatsApp text, drop screenshots/PDFs, or create tasks directly.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'text'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Paste Text / Message
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'file'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Screenshot / PDF
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'manual'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Manual Entry
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Text Paste Tab */}
      {activeTab === 'text' && (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div>
            <textarea
              rows={5}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste a WhatsApp message, work email, bill reminder, notice announcement, or note... (e.g., 'Pay wifi bill before Friday 5 PM' or 'Submit project slide deck by tomorrow morning')"
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isProcessing || !textContent.trim()}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing with Gemini AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Extract Tasks with AI
              </>
            )}
          </button>
        </form>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <form onSubmit={handleFileSubmit} className="space-y-4">
          <div className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 bg-zinc-950/50 rounded-2xl p-8 text-center transition-all cursor-pointer relative">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">
                  {file ? file.name : 'Click or Drag & Drop File'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Supports WhatsApp screenshots, work notices, bill invoices & PDFs (Max 15MB)
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing || !file}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reading & Parsing Document...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Process Uploaded File
              </>
            )}
          </button>
        </form>
      )}

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">Task Title</label>
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="e.g. Renew car insurance policy"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Task Type</label>
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
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
                <option value="EVENT">Event</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="EXAM">Exam</option>
                <option value="READING">Reading</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Deadline</label>
              <input
                type="datetime-local"
                value={manualDeadline}
                onChange={(e) => setManualDeadline(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Est. Effort (mins)</label>
              <input
                type="number"
                value={manualEffort}
                onChange={(e) => setManualEffort(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                min={5}
                step={5}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing || !manualTitle.trim()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Active Task'}
          </button>
        </form>
      )}
    </div>
  );
}
