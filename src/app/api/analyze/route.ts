import { NextRequest, NextResponse } from 'next/server';
import { gemini } from '@/lib/gemini';
import { FORENSIC_LINGUIST_PROMPT } from '@/lib/prompts';
import { ANALYSIS_MODEL_ID } from '@/lib/constants';
import { db, hasDatabaseUrl } from '@/db';
import { analysisResults } from '@/db/schema';

type AnalysisResponse = {
  cognitive_effort: number;
  human_likelihood: number;
  events?: Array<{ type?: string; timestamp?: number; description?: string }>;
  analysis_summary?: string;
};

const parseAnalysis = (raw: string): AnalysisResponse => {
  try {
    return JSON.parse(raw) as AnalysisResponse;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Invalid analysis payload.');
    }
    return JSON.parse(match[0]) as AnalysisResponse;
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const { log, sessionId } = await req.json();

    if (!log) {
      return NextResponse.json({ error: 'Missing log data' }, { status: 400 });
    }

    const response = await gemini.models.generateContent({
      model: ANALYSIS_MODEL_ID,
      contents: `Analyze the following typing log:\n\n${JSON.stringify(log, null, 2)}`,
      config: {
        systemInstruction: FORENSIC_LINGUIST_PROMPT,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text; 
    if (!text) {
      throw new Error('No response text received from Gemini');
    }

    const analysis = parseAnalysis(text);

    if (typeof analysis.cognitive_effort !== 'number' || typeof analysis.human_likelihood !== 'number') {
      throw new Error('Invalid analysis format received from Gemini');
    }

    if (hasDatabaseUrl && typeof sessionId === 'string' && sessionId.trim().length > 0) {
      await db.insert(analysisResults).values({
        sessionId: sessionId.trim(),
        result: JSON.stringify(analysis),
      });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis failed:', error);
    return NextResponse.json({ error: 'Failed to analyze log' }, { status: 500 });
  }
}
