'use client';

import React from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="sticky top-3 z-50 px-3 sm:px-6 max-w-7xl mx-auto w-full">
      <div className="glass-pill rounded-full px-5 py-2.5 flex items-center justify-between shadow-lg transition-all duration-300">
        {/* Clean Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
            <Zap className="w-3.5 h-3.5 fill-white/20" />
          </div>
          <span className="font-bold text-sm sm:text-base text-white tracking-tight group-hover:text-indigo-200 transition-colors">
            OmniTask
          </span>
        </Link>
      </div>
    </header>
  );
}
