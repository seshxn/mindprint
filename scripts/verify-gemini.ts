import "dotenv/config";
import { gemini } from "../src/lib/gemini";
import { FORENSIC_LINGUIST_PROMPT } from "../src/lib/prompts";
import { ANALYSIS_MODEL_ID } from "../src/lib/constants";

interface LogEntry {
  key: string;
  timestamp: number;
  type?: string;
}

const runVerification = async () => {
  console.log("Running Forensic Linguist Verification...");

  // 1. Simulating a mock log with a Pause
  const pauseLog: LogEntry[] = [
    { key: "H", timestamp: 1000 },
    { key: "e", timestamp: 1100 },
    { key: "l", timestamp: 1200 },
    { key: "l", timestamp: 1300 },
    { key: "o", timestamp: 1400 },
    // 3 second pause
    { key: " ", timestamp: 4400 },
    { key: "W", timestamp: 4500 },
    { key: "o", timestamp: 4600 },
    { key: "r", timestamp: 4700 },
    { key: "l", timestamp: 4800 },
    { key: "d", timestamp: 4900 },
  ];

  // 2. Simulating a mock log with Bulk Paste
  const pasteLog: LogEntry[] = [
    { key: "T", timestamp: 1000 },
    { key: "h", timestamp: 1100 },
    { key: "i", timestamp: 1200 },
    // Sudden burst (paste)
    {
      key: "s is a pasted text of considerable length.",
      timestamp: 1250,
      type: "paste",
    },
  ];

  try {
    const analyzeLog = async (log: LogEntry[], label: string) => {
      console.log(`\n--- Analyzing ${label} ---`);
      const response = await gemini.models.generateContent({
        model: ANALYSIS_MODEL_ID,
        contents: `Analyze:\n${JSON.stringify(log)}`,
        config: {
          systemInstruction: FORENSIC_LINGUIST_PROMPT,
          responseMimeType: "application/json",
        },
      });
      console.log(response.text);
    };

    await analyzeLog(pauseLog, "Pause Log");
    await analyzeLog(pasteLog, "Bulk Paste Log");
  } catch (error) {
    console.error("Verification failed:", error);
  }
};

runVerification();
