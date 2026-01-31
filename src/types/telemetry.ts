export type TelemetryEvent = 
  | { type: 'keystroke'; timestamp: number; key: string }
  | { type: 'paste'; timestamp: number; charCount: number; source: string };
