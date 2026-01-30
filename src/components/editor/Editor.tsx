'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Toolbar } from './Toolbar';

const Editor = () => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...',
        emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-stone-400 before:float-left before:h-0 pointer-events-none',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[50vh] text-lg leading-relaxed',
      },
    },
    immediatelyRender: false, 
  });

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Toolbar editor={editor} />
      <div className="mt-8 px-4 sm:px-0">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default Editor;
