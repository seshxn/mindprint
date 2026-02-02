CREATE TABLE "telemetry_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now(),
	"events" jsonb
);
