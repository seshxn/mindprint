import React from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  editor: Editor | null;
}

export const Toolbar = ({ editor }: ToolbarProps) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 mb-4 bg-white/50 backdrop-blur-sm border border-stone-200 rounded-lg shadow-sm w-fit mx-auto transition-all duration-300 opacity-100 dark:bg-stone-900/50 dark:border-stone-800">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={cn(
          "p-2 rounded hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors",
          editor.isActive('bold') ? "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
        )}
        aria-label="Toggle Bold"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={cn(
          "p-2 rounded hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors",
          editor.isActive('italic') ? "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
        )}
        aria-label="Toggle Italic"
      >
        <Italic className="w-4 h-4" />
      </button>
    </div>
  );
}
