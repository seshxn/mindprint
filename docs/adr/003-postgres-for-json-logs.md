# 003. Postgres for JSON Logs

Date: 2026-01-31

## Context

Telemetry events vary in structure. A 'keystroke' has a `key` and `timestamp`, while a 'paste' has `charCount` and `source`. Future events might have completely different fields. We need a storage solution that allows for this flexibility without requiring constant schema migrations for every new event field.

## Decision

We will store telemetry batches in a **Postgres `jsonb` column** within a `telemetry_events` table.

## Rationale

- **Flexibility**: `jsonb` allows us to store arbitrary structured data. We can evolve the event schema in the application code without touching the database.
- **Queryability**: Postgres supports indexing and querying JSON data efficiently if we need to do light analytics directly in SQL.
- **Unified Infrastructure**: We are already using Supabase (Postgres). Using it for logs avoids adding a new piece of infrastructure (like MongoDB, ElasticSearch, or specialized analytics SaaS) at this early stage.

## Consequences

- **Storage Size**: JSONB is slightly more overhead than flat columns, but negligible for our current scale.
- **Analytics**: Complex analytical queries might eventually require moving this data to an OLAP warehouse (e.g., ClickHouse or BigQuery) if the volume grows massively.
