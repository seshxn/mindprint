import { NextRequest, NextResponse } from 'next/server';
import { gemini } from '@/lib/gemini';
import { FORENSIC_LINGUIST_PROMPT } from '@/lib/prompts';

export const POST = async (req: NextRequest) => {
  try {
    const { log } = await req.json();

    if (!log) {
      return NextResponse.json({ error: 'Missing log data' }, { status: 400 });
    }

    const response = await gemini.models.generateContent({
      model: 'gemini-3-flash-preview',
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

    // Since we requested JSON, the text should be valid JSON
    const analysis = JSON.parse(text);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis failed:', error);
    return NextResponse.json({ error: 'Failed to analyze log' }, { status: 500 });
  }
}
