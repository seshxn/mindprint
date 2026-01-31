# 001. Use Drizzle ORM

Date: 2026-01-31

## Context

We need an ORM to interact with our Supabase (Postgres) database. The project uses TypeScript and Next.js. We require a solution that provides strong type safety, good performance (especially in serverless/edge environments), and ease of use. Prisma is a common choice but can be heavy and has had cold start issues in serverless environments.

## Decision

We will use **Drizzle ORM**.

## Rationale

- **Type Safety**: Drizzle offers best-in-class TypeScript inference directly from the schema definition.
- **Performance**: It is lightweight and has zero dependencies at runtime (except the driver), making it ideal for Server Actions and potential Edge usage.
- **SQL-Like**: The API is close to SQL, reducing the learning curve for those who know SQL and avoiding the "black box" query generation of some ORMs.
- **Migration Management**: `drizzle-kit` provides a robust toolchain for managing schema migrations.

## Consequences

- We need to manage the DB connection manually (e.g., creating the client).
- We assume we are using a Postgres-compatible driver (`postgres` or `postgres.js`).
