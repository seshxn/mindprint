import { GoogleGenAI } from '@google/genai';

// Ensure the API key is present
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.warn('GOOGLE_API_KEY is not defined in the environment variables. The AI features will not work.');
}

export const gemini = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-build' });
