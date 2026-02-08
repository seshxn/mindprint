import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
const MISSING_DB_ERROR = "DATABASE_URL environment variable is not set";
const createDb = () => drizzle(postgres(DATABASE_URL as string), { schema });
type Database = ReturnType<typeof createDb>;

const unavailableDb = new Proxy(
  {},
  {
    get() {
      throw new Error(MISSING_DB_ERROR);
    },
  },
) as unknown as Database;

export const hasDatabaseUrl = Boolean(DATABASE_URL);

export const db: Database = hasDatabaseUrl ? createDb() : unavailableDb;
