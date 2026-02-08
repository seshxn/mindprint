export type KeystrokeAction = "char" | "delete" | "nav" | "other";
export type TextOperationType = "insert" | "delete" | "replace";

export type TelemetryEvent =
  | {
      type: "keystroke";
      timestamp: number;
      key: string;
      action: KeystrokeAction;
    }
  | {
      type: "paste";
      timestamp: number;
      length: number;
      source: string;
    }
  | {
      type: "operation";
      timestamp: number;
      op: TextOperationType;
      from: number;
      to: number;
      text: string;
    };
