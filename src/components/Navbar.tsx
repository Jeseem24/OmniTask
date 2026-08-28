'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, Bot, ListChecks } from 'lucide-react';

interface NavbarProps {
  activeTab?: 'chat' | 'tasks';
  onTabChange?: (tab: 'chat' | 'tasks') => void;
  pendingCount?: number;
}

export default function Navbar({ activeTab, onTabChange, pendingCount }: NavbarProps) {
  return (
    <header className="sticky top-2 sm:top-3 z-50 px-2.5 sm:px-6 max-w-7xl mx-auto w-full">
      <div className="glass-pill rounded-full px-3.5 sm:px-5 py-2 flex items-center justify-between shadow-xl transition-all duration-300">
        {/* Left: Clean Logo */}
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25 group-hover:scale-105 transition-transform">
            <Zap className="w-3.5 h-3.5 fill-white/20" />
          </div>
          <span className="font-bold text-sm sm:text-base text-white tracking-tight group-hover:text-indigo-200 transition-colors">
            OmniTask
          </span>
        </Link>

        {/* Mobile-Only Unified Segmented Switcher */}
        {onTabChange && (
          <div className="flex lg:hidden items-center bg-black/40 p-1 rounded-full border border-white/[0.08]">
            <button
              onClick={() => onTabChange('chat')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Chat</span>
            </button>

            <button
              onClick={() => onTabChange('tasks')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Tasks</span>
              {pendingCount !== undefined && pendingCount > 0 && (
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  activeTab === 'tasks' ? 'bg-white/25 text-white' : 'bg-white/[0.1] text-zinc-300'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
