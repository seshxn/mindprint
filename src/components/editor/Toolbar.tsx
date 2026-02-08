import React from "react";
import { Editor } from "@tiptap/react";
import { Bold, Italic, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  if (!editor) {
    return null;
  }

  const items: ToolbarItem[] = [
    {
      icon: Bold,
      label: "Toggle Bold",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
      canExecute: () => editor.can().chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: "Toggle Italic",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
      canExecute: () => editor.can().chain().focus().toggleItalic().run(),
    },
  ];

  return (
    <div className="flex items-center gap-2 p-2 mb-4 bg-white border border-slate-200 rounded-xl shadow-sm w-fit mx-auto transition-all duration-300 opacity-100 dark:bg-slate-900 dark:border-slate-700">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.action}
            disabled={!item.canExecute()}
            className={cn(
              "p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
              item.isActive()
                ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400",
            )}
            aria-label={item.label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};
