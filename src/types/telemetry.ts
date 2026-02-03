export type KeystrokeAction = 'char' | 'delete' | 'nav' | 'other';

export type TelemetryEvent =
  | {
    type: 'keystroke';
    timestamp: number;
    key: string;
    action: KeystrokeAction
  }
  | {
    type: 'paste';
    timestamp: number;
    length: number;
    source: string;
  };
