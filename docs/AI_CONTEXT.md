# Mindprint: Project Context & Knowledge Base

## 1. The Core Mission

Mindprint is a forensic telemetry engine. It does not "detect" AI text; it verifies human effort.
We record the "messy middle" of creation (keystrokes, pauses, deletes) to create a "Proof of Human" biometric certificate.

## 2. The Architecture

- **The Synapse (Frontend):** A Tiptap editor captures keystroke dynamics (speed, hesitation, paste events).
- **The Cortex (Backend):** Next.js Server Actions ingest logs into Supabase.
- **The Brain (AI):** Gemini 3 Pro analyzes the logs for "Intent Density" (struggle = human).
- **The Artifact (Output):** We generate a "Biometric ID Card" image using Nano Banana Pro and Satori. (This may evolve over time)

## 3. Key Terminology

- **Telemetry:** The raw JSON log of keystrokes.
- **Cognitive Load:** When a user pauses for >3 seconds (Human behavior).
- **Injection:** A large paste event (Suspicious/External behavior).
- **Mindprint ID:** The final shareable certificate.
