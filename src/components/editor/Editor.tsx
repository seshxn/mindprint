'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Toolbar } from './Toolbar';
import { useMindprintTelemetry } from '@/hooks/useMindprintTelemetry';

const Editor = () => {
  const { trackKeystroke, trackPaste, updateValidation, validationResult } = useMindprintTelemetry();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...',
        emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-stone-400 before:float-left before:h-0 pointer-events-none',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // We pass the plain text length for strict character count
      // or we can use editor.storage.characterCount.characters() if extension installed.
      // For now, getText().length is a decent approximation.
      updateValidation(editor.getText().length);
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
    <div className="w-full max-w-3xl mx-auto relative">
      <div className="flex justify-between items-end mb-4">
        <Toolbar editor={editor} />
        <div className={`text-xs font-mono px-2 py-1 rounded border ${validationResult.status === 'VERIFIED_HUMAN'
            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            : validationResult.status === 'SUSPICIOUS' || validationResult.status === 'LOW_EFFORT'
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
              : 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-800/50 dark:text-stone-400 dark:border-stone-700' // INSUFFICIENT_DATA
          }`}>
          PoH: {validationResult.status?.replace('_', ' ')}
          {validationResult.status !== 'VERIFIED_HUMAN' && validationResult.reason && (
            <span className="block opacity-75 text-[10px] whitespace-pre-wrap max-w-[200px]">
              {validationResult.reason}
            </span>
          )}
        </div>
      </div>
      <div className="px-4 sm:px-0">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default Editor;
