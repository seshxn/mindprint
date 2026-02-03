'use server';

import { db } from '@/db';
import { analysisResults, telemetryEvents } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const analyzeSession = async (sessionId: string) => {
    if (!sessionId) {
        throw new Error('Session ID is required');
    }

    // 1. Fetch telemetry events
    const eventsRecords = await db.select()
        .from(telemetryEvents)
        .where(eq(telemetryEvents.sessionId, sessionId))
        .orderBy(desc(telemetryEvents.createdAt));

    if (eventsRecords.length === 0) {
        return { error: 'No telemetry found for this session' };
    }

    // Aggregate all events
    const allEvents = eventsRecords.flatMap(record => record.events);
    const eventsJson = JSON.stringify(allEvents, null, 2);

    // 2. Call Gemini API
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('API Key not found');
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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
            throw new Error(`Gemini API Error: ${response.status}`);
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
        return { error: 'Analysis failed' };
    }
}
