'use client';

import React, { useMemo, useState } from 'react';
import Editor from '@/components/editor/Editor';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { analyzeSession } from '@/app/actions/analysis';
import { toast } from 'sonner';
import { AnalysisResult } from '@/components/AnalysisResult';

const WritePage = () => {
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [isFinishing, setIsFinishing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleFinishSession = async () => {
    try {
      setIsFinishing(true);

      // Show loading toast
      const loadingToast = toast.loading('Analyzing your writing session...');

      const result = await analyzeSession(sessionId);

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (result.error) {
        // Handle different error types with specific messages
        switch (result.error) {
          case 'NO_TELEMETRY':
            toast.error('No Data Found', {
              description: result.message || 'No telemetry data found for this session. Try writing something first!',
            });
            break;
          case 'MISSING_API_KEY':
            toast.error('Configuration Error', {
              description: result.message || 'API key not configured. Please add GOOGLE_API_KEY to your .env file.',
            });
            break;
          case 'API_ERROR':
            toast.error('Analysis Failed', {
              description: result.message || 'Failed to analyze session. Please check your API key and try again.',
            });
            break;
          default:
            toast.error('Error', {
              description: result.message || 'An unexpected error occurred during analysis.',
            });
        }
        console.error('Analysis error:', result);
      } else {
        // Success - show result in drawer
        setAnalysisResult(result.analysis || 'Analysis complete');
        setIsDrawerOpen(true);
        toast.success('Session Analyzed!', {
          description: 'Your psychological profile based on this session is ready.',
          duration: 3000,
        });
        console.log('Analysis result:', result.analysis);
      }
    } catch (e) {
      console.error('Error finishing session:', e);
      toast.error('Unexpected Error', {
        description: 'An unexpected error occurred. Please try again.',
      });
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
          {isFinishing ? 'Analyzing...' : 'Finish Session'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-12 sm:py-20">
        <Editor sessionId={sessionId} />
      </main>

      {/* Analysis Result Drawer */}
      <AnalysisResult
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        analysis={analysisResult || ''}
      />
    </div>
  );
}

export default WritePage;
