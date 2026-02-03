'use client';

import React, { useMemo, useState } from 'react';
import Editor from '@/components/editor/Editor';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { analyzeSession } from '@/app/actions/analysis';
import { useRouter } from 'next/navigation';

const WritePage = () => {
  const router = useRouter();
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [isFinishing, setIsFinishing] = useState(false);

  const handleFinishSession = async () => {
    try {
      setIsFinishing(true);
      const result = await analyzeSession(sessionId);

      if (result.error) {
        console.error('Analysis error:', result.error);
        alert('Failed to analyze session. Check console for details.');
      } else {
        console.log('Analysis result:', result.analysis);
        alert('Session finished and analyzed! Result saved.');
        // router.push('/'); // Optional: redirect home
      }
    } catch (e) {
      console.error('Error finishing session:', e);
      alert('An unexpected error occurred.');
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-50 flex flex-col">
      {/* Header */}
      <header className="p-4 sm:p-6 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link href="/" className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <button
          onClick={handleFinishSession}
          disabled={isFinishing}
          className="px-4 py-2 bg-stone-900 text-stone-50 rounded-full text-sm font-medium hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isFinishing && <Loader2 className="w-4 h-4 animate-spin" />}
          {isFinishing ? 'Finishing...' : 'Finish Session'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-12 sm:py-20">
        <Editor sessionId={sessionId} />
      </main>
    </div>
  );
}

export default WritePage;
