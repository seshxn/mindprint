# Mindprint: Proof of Human (PoH)

**Proof of Human (PoH)** is a privacy-first provenance system that proves human-origin creation rather than trying to detect AI after the fact.

It works by capturing creation telemetry during the “messy middle” of writing or making something, such as:

- Keystroke dynamics
- Pauses
- Revisions
- Cursor movement
- Optional think-aloud signals

The system transforms these signals into a **Human Signature** that reflects a genuinely human creative process.

### Key Features

- **Privacy-First:** The system never needs to store raw content by default.
- **Verifiable:** Issues a cryptographically verifiable **Human Origin Certificate** that binds a specific artifact to evidence of human effort.
- **Third-Party Verification:** Certificates are verifiable without revealing the content itself.
- **Architecture:** Docker-first, CPU-friendly, and modular.
- **Trust Model:** Optional blockchain anchoring for public trust, with a non-blockchain default for speed and privacy.

Conceptually, PoH treats human creation like Git treats code history: not judging the final output, but preserving and proving how it was made.

---

## Getting Started

This is a [Next.js](https://nextjs.org) project.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
