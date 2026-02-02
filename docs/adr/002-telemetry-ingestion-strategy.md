# 002. Telemetry Ingestion Strategy

Date: 2026-01-31

## Context

We need to capture high-frequency user events (keystrokes, cursor movements, pastes) from the editor to analyze usage patterns. Sending an HTTP request for every event would degrade client performance and flood the server. We need a strategy to ingest this data efficiently.

## Decision

We will use **Client-Side Batching** with **Server Action Ingestion**.

1.  **Client-Side Batching**: The `useMindprintTelemetry` hook accumulates events in memory and flushes them every 5 seconds (or when the batch reaches a size limit).
2.  **Server Action**: A Next.js Server Action (`ingestTelemetry`) receives the batch and writes it to the database in a single transaction.

## Rationale

- **Performance**: Reduces the number of network requests significantly (e.g., 1 request per 5 seconds vs. 50 requests if typing fast).
- **Simplicity**: Next.js Server Actions provide a zero-setup API layer. We don't need to configure a separate API route handler or external ingestion service yet.
- **Reliability**: Using `navigator.sendBeacon` (future optimization) or `fetch` in `useEffect` cleanup provides reasonable reliability for closing sessions.

## Consequences

- Potential data loss if the browser crash/closes before the 5-second flush. (Accepted risk for gathering general usage metrics).
- We need to ensure the payload size doesn't exceed Server Action limits (default is usually generous for text logs).
