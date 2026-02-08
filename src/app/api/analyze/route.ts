import { NextRequest, NextResponse } from "next/server";
import { gemini } from "@/lib/gemini";
import { FORENSIC_LINGUIST_PROMPT } from "@/lib/prompts";
import { ANALYSIS_MODEL_ID } from "@/lib/constants";
import { db, hasDatabaseUrl } from "@/db";
import { analysisResults } from "@/db/schema";

type AnalysisResponse = {
  cognitive_effort: number;
  human_likelihood: number;
  events?: Array<{ type?: string; timestamp?: number; description?: string }>;
  analysis_summary?: string;
};

const RETRYABLE_STATUS_CODES = new Set([429, 500, 503, 504]);
const MAX_ANALYSIS_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 600;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const getErrorStatus = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { status?: unknown; message?: unknown };
  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  if (typeof candidate.message === "string") {
    const match = candidate.message.match(/"code"\s*:\s*(\d{3})/);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
};

const generateAnalysisText = async (log: unknown) => {
  for (let attempt = 1; attempt <= MAX_ANALYSIS_ATTEMPTS; attempt += 1) {
    try {
      const response = await gemini.models.generateContent({
        model: ANALYSIS_MODEL_ID,
        contents: `Analyze the following typing log:\n\n${JSON.stringify(log, null, 2)}`,
        config: {
          systemInstruction: FORENSIC_LINGUIST_PROMPT,
          responseMimeType: "application/json",
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response text received from Gemini");
      }

      return text;
    } catch (error) {
      const status = getErrorStatus(error);
      const canRetry =
        status !== null &&
        RETRYABLE_STATUS_CODES.has(status) &&
        attempt < MAX_ANALYSIS_ATTEMPTS;

      if (!canRetry) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * 250);
      const delayMs =
        INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1) + jitterMs;
      console.warn(
        `Transient Gemini error (status ${status}) on attempt ${attempt}/${MAX_ANALYSIS_ATTEMPTS}; retrying in ${delayMs}ms.`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error("Failed to analyze log after retries");
};

const parseAnalysis = (raw: string): AnalysisResponse => {
  try {
    return JSON.parse(raw) as AnalysisResponse;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Invalid analysis payload.");
    }
    return JSON.parse(match[0]) as AnalysisResponse;
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const { log, sessionId } = await req.json();

    if (!log) {
      return NextResponse.json({ error: "Missing log data" }, { status: 400 });
    }

    const text = await generateAnalysisText(log);

    const analysis = parseAnalysis(text);

    if (
      typeof analysis.cognitive_effort !== "number" ||
      typeof analysis.human_likelihood !== "number"
    ) {
      throw new Error("Invalid analysis format received from Gemini");
    }

    if (
      hasDatabaseUrl &&
      typeof sessionId === "string" &&
      sessionId.trim().length > 0
    ) {
      await db.insert(analysisResults).values({
        sessionId: sessionId.trim(),
        result: JSON.stringify(analysis),
      });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis failed:", error);

    const status = getErrorStatus(error);
    if (status === 429 || status === 503 || status === 504) {
      return NextResponse.json(
        { error: "Analysis model is currently busy. Please retry in a few seconds." },
        { status: 503 },
      );
    }

    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "Analysis provider rejected the request. Check GOOGLE_API_KEY permissions." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to analyze log" },
      { status: 500 },
    );
  }
};
