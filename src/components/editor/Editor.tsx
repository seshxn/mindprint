'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useState, useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Toolbar } from './Toolbar';
import { useMindprintTelemetry } from '@/hooks/useMindprintTelemetry';
import { ValidationStatus } from '@/lib/telemetry';
import { TelemetryEvent } from '@/types/telemetry';
import TypingVelocitySparkline from '@/components/telemetry/TypingVelocitySparkline';

const getStatusColor = (status: ValidationStatus = 'INSUFFICIENT_DATA') => {
  switch (status) {
    case 'VERIFIED_HUMAN':
      return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    case 'SUSPICIOUS':
    case 'LOW_EFFORT':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    default:
      return 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-800/50 dark:text-stone-400 dark:border-stone-700';
  }
};

interface EditorProps {
  sessionId: string;
}

const Editor = ({ sessionId }: EditorProps) => {
  const { trackKeystroke, trackPaste, updateValidation, validationResult, getUiEvents, isWarming } = useMindprintTelemetry({ sessionId });
  const [sparklineData, setSparklineData] = useState<TelemetryEvent[]>([]);

  // Update sparkline data periodically instead of on every render
  useEffect(() => {
    // Populate initial data
    setSparklineData(getUiEvents());

    // Update every second
    const intervalId = setInterval(() => {
      setSparklineData(getUiEvents());
    }, 1000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // getUiEvents is stable (useCallback with empty deps), no need to include

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...',
        emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-stone-400 before:float-left before:h-0 pointer-events-none',
      }),
      CharacterCount.configure(),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Use efficient character count from extension
      updateValidation(editor.storage.characterCount.characters());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[50vh] text-lg leading-relaxed',
      },
      handleKeyDown: (_, event) => {
        trackKeystroke(event);
        return false; // Let the event bubble/perform default action
      },
      handlePaste: (_, event) => {
        trackPaste(event);
        return false; // Let the event bubble/perform default action
      },
    },
    immediatelyRender: false,
  });

  return (
    <div className="w-full max-w-3xl mx-auto relative px-4 sm:px-0">
      <div className="flex flex-wrap justify-between items-end gap-2 mb-4">
        <Toolbar editor={editor} />
        <div
          className={`text-xs font-mono px-2 py-1 rounded border ${getStatusColor(validationResult.status)}`}
          title="Based on typing rhythm, not text content."
          aria-label="Proof of Humanity status based on typing rhythm, not text content."
        >
          <span className="inline-flex items-center gap-1">
            PoH
            <span
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[9px] leading-none opacity-70"
              aria-hidden="true"
            >
              i
            </span>
            : {validationResult.status.replaceAll('_', ' ')}
          </span>
          {validationResult.status !== 'VERIFIED_HUMAN' && (
            <span className="block opacity-75 text-[10px] whitespace-pre-wrap max-w-[200px]">
              {isWarming ? 'Warming up…' : validationResult.reason}
            </span>
          )}
        </div>
      </div>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-stone-500 dark:text-stone-400 font-mono mb-3">
          Typing Velocity Over Time
        </div>
        <div className="p-3 sm:p-5 rounded-xl border border-stone-200/60 dark:border-stone-800/60 bg-gradient-to-br from-stone-900/95 via-stone-950/95 to-slate-900/95 shadow-[0_0_32px_rgba(56,189,248,0.18)] backdrop-blur-sm">
          <TypingVelocitySparkline data={sparklineData} height={160} />
        </div>
      </div>
      <div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default Editor;
