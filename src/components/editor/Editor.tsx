"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useState, useEffect, useCallback } from "react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Toolbar } from "./Toolbar";
import { useMindprintTelemetry } from "@/hooks/useMindprintTelemetry";
import { ValidationStatus } from "@/lib/telemetry";
import { TelemetryEvent } from "@/types/telemetry";
import TypingVelocitySparkline from "@/components/telemetry/TypingVelocitySparkline";

const getStatusColor = (status: ValidationStatus = "INSUFFICIENT_DATA") => {
  switch (status) {
    case "VERIFIED_HUMAN":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35";
    case "SUSPICIOUS":
    case "LOW_EFFORT":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700";
  }
};

export interface EditorSessionSnapshot {
  text: string;
  events: TelemetryEvent[];
  validationStatus: ValidationStatus;
  riskScore: number | null;
  confidence: number | null;
  sessionId: string | null;
}

interface EditorProps {
  sessionId?: string;
  onSessionChange?: (snapshot: EditorSessionSnapshot) => void;
}

const Editor = ({ sessionId, onSessionChange }: EditorProps) => {
  const {
    trackKeystroke,
    trackPaste,
    trackContentMutation,
    updateValidation,
    validationResult,
    getUiEvents,
    isWarming,
    sessionId: activeSessionId,
    telemetryReady,
  } = useMindprintTelemetry();
  const [sparklineData, setSparklineData] = useState<TelemetryEvent[]>(() =>
    getUiEvents(),
  );

  const emitSessionSnapshot = useCallback(
    (text: string) => {
      if (!onSessionChange) return;
      onSessionChange({
        text,
        events: getUiEvents(),
        validationStatus: validationResult.status,
        riskScore: validationResult.metrics?.riskScore ?? null,
        confidence: validationResult.metrics?.confidence ?? null,
        sessionId: activeSessionId || sessionId || null,
      });
    },
    [
      activeSessionId,
      getUiEvents,
      onSessionChange,
      sessionId,
      validationResult.metrics?.confidence,
      validationResult.metrics?.riskScore,
      validationResult.status,
    ],
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setSparklineData(getUiEvents());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [getUiEvents]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing...",
        emptyEditorClass:
          "is-editor-empty before:content-[attr(data-placeholder)] before:text-slate-400 dark:before:text-slate-500 before:float-left before:h-0 pointer-events-none",
      }),
      CharacterCount.configure(),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      trackContentMutation(text);
      updateValidation(editor.storage.characterCount.characters());
      emitSessionSnapshot(text);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[46vh] text-lg leading-relaxed",
      },
      handleKeyDown: (_, event) => {
        trackKeystroke(event);
        return false;
      },
      handlePaste: (_, event) => {
        trackPaste(event);
        return false;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    emitSessionSnapshot(editor.getText());
  }, [editor, emitSessionSnapshot]);

  return (
    <div className="w-full max-w-4xl mx-auto relative px-2 sm:px-0">
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
            : {validationResult.status.replaceAll("_", " ")}
          </span>
          {validationResult.status !== "VERIFIED_HUMAN" && (
            <span className="block opacity-75 text-[10px] whitespace-pre-wrap max-w-[200px]">
              {isWarming ? "Warming up…" : validationResult.reason}
            </span>
          )}
          {!telemetryReady && (
            <span className="block opacity-75 text-[10px] whitespace-pre-wrap max-w-[200px]">
              Initializing trusted telemetry session...
            </span>
          )}
        </div>
      </div>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-500 dark:text-slate-400 font-mono mb-3">
          Typing Velocity Over Time
        </div>
        <div className="p-3 sm:p-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 dark:shadow-[0_12px_30px_rgba(2,6,23,0.45)]">
          <TypingVelocitySparkline data={sparklineData} height={160} />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_12px_30px_rgba(2,6,23,0.45)]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default Editor;
