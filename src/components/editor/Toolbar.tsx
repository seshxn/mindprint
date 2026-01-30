import React, { useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarItem {
  icon: LucideIcon;
  label: string;
  action: () => boolean;
  isActive: () => boolean;
  canExecute: () => boolean;
}

export const Toolbar = ({ editor }: ToolbarProps) => {
  const items: ToolbarItem[] = useMemo(() => {
    if (!editor) {
      return [];
    }
    return [
      {
        icon: Bold,
        label: 'Toggle Bold',
        action: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive('bold'),
        canExecute: () => editor.can().chain().focus().toggleBold().run(),
      },
      {
        icon: Italic,
        label: 'Toggle Italic',
        action: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive('italic'),
        canExecute: () => editor.can().chain().focus().toggleItalic().run(),
      },
    ];
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label="Text formatting toolbar"
      className="flex items-center gap-2 p-2 mb-4 bg-white/50 backdrop-blur-sm border border-stone-200 rounded-lg shadow-sm w-fit mx-auto transition-all duration-300 opacity-100 dark:bg-stone-900/50 dark:border-stone-800"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label.toLowerCase().replace(/\s+/g, '-')}
            type="button"
            onClick={item.action}
            disabled={!item.canExecute()}
            className={cn(
              "p-2 rounded hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors",
              item.isActive() ? "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
            )}
            aria-label={item.label}
            aria-pressed={item.isActive()}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
