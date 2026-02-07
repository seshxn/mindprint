'use server';

import { db, hasDatabaseUrl } from '@/db';
import { analysisResults, telemetryEvents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

export const analyzeSession = async (sessionId: string) => {
    if (!sessionId) {
        return {
            error: 'MISSING_SESSION_ID',
            message: 'Session ID is required for analysis.'
        };
    }

    if (!hasDatabaseUrl) {
        return {
            error: 'MISSING_DATABASE_URL',
            message: 'DATABASE_URL is not configured for this environment.'
        };
    }

    // 1. Fetch telemetry events
    const eventsRecords = await db.select()
        .from(telemetryEvents)
        .where(eq(telemetryEvents.sessionId, sessionId))
        .orderBy(desc(telemetryEvents.createdAt));

    if (eventsRecords.length === 0) {
        return {
            error: 'NO_TELEMETRY',
            message: 'No telemetry data found for this session. Try writing something first!'
        };
    }

    // Aggregate all events
    const allEvents = eventsRecords.flatMap(record => record.events);
    const eventsJson = JSON.stringify(allEvents, null, 2);

    // 2. Call Gemini API
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            error: 'MISSING_API_KEY',
            message: 'API key not configured. Please add GOOGLE_API_KEY to your .env file.'
        };
    }

    const prompt = `
    Analyze the following writing session telemetry data.
    The data includes keystrokes, pastes, and timestamps.
    Provide a psychological analysis of the writer's state of mind, writing flow, and potential distractions.
    Keep it concise and insightful. Use "You" to address the writer.
    
    Telemetry Data:
    ${eventsJson}
  `;

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API Error:', response.status, errorText);
            return {
                error: 'API_ERROR',
                message: `Gemini API request failed (${response.status}). Please check your API key and try again.`,
                details: errorText
            };
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis generated.';

        // 3. Save result
        await db.insert(analysisResults).values({
            sessionId,
            result: resultText,
        });

        return { success: true, analysis: resultText };

    } catch (error) {
        console.error('Analysis failed:', error);
        return {
            error: 'UNEXPECTED_ERROR',
            message: 'An unexpected error occurred during analysis. Please try again.',
            details: error instanceof Error ? error.message : String(error)
        };
    }
}
