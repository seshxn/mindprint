'use client';

import React from 'react';
import Editor from '@/components/editor/Editor';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const WritePage = () => {
  const handleFinishSession = () => {
    // TODO: Implement session saving logic
    // For now, maybe redirect to home or show a summary?
    // router.push('/');
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
          className="px-4 py-2 bg-stone-900 text-stone-50 rounded-full text-sm font-medium hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200 transition-all shadow-sm active:scale-95"
        >
          Finish Session
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-12 sm:py-20">
        <Editor />
      </main>
    </div>
  );
}

export default WritePage;
