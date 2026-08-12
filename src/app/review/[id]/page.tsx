'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import ReviewDesk from '@/components/ReviewDesk';
import { Loader2 } from 'lucide-react';

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [candidateData, setCandidateData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCandidates() {
      try {
        const res = await fetch(`/api/candidates/${id}`);
        if (!res.ok) throw new Error('Failed to load candidate tasks');
        const data = await res.json();
        setCandidateData(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error fetching extraction');
      } finally {
        setIsLoading(false);
      }
    }
    loadCandidates();
  }, [id]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500 text-sm">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            Loading AI Extracted Candidate Tasks...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {error}
          </div>
        ) : (
          <ReviewDesk
            extractionId={candidateData.id}
            sourceId={candidateData.sourceId}
            initialCandidateTasks={candidateData.extractedTasks}
            rawSourceText={candidateData.source?.rawContent}
          />
        )}
      </main>
    </div>
  );
}
