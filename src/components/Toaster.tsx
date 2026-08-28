'use client';

import React, { useEffect, useState } from 'react';
import { toast, ToastMessage } from '@/lib/toast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => setToasts(updated));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 glass-elevated rounded-xl shadow-2xl border transition-all duration-300 animate-slide-up ${
            t.type === 'success'
              ? 'border-emerald-500/30 bg-zinc-900/90 text-zinc-100'
              : t.type === 'error'
              ? 'border-red-500/30 bg-zinc-900/90 text-zinc-100'
              : t.type === 'warning'
              ? 'border-amber-500/30 bg-zinc-900/90 text-zinc-100'
              : 'border-indigo-500/30 bg-zinc-900/90 text-zinc-100'
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : t.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {t.title && <h4 className="text-xs font-bold text-white mb-0.5">{t.title}</h4>}
            <p className="text-xs text-zinc-300 leading-snug">{t.message}</p>
          </div>

          <button
            onClick={() => toast.dismiss(t.id)}
            className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
