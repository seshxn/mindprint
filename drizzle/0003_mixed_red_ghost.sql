DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'validation_status_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."validation_status_enum" AS ENUM('VERIFIED_HUMAN', 'SUSPICIOUS', 'LOW_EFFORT', 'INSUFFICIENT_DATA');
  END IF;
END
$$;
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "certificate_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"certificate_id" text NOT NULL,
	"prev_hash" text,
	"entry_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telemetry_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
UPDATE "certificates"
SET "validation_status" = NULL
WHERE "validation_status" IS NOT NULL
  AND "validation_status" NOT IN ('VERIFIED_HUMAN', 'SUSPICIOUS', 'LOW_EFFORT', 'INSUFFICIENT_DATA');
--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "validation_status" SET DATA TYPE "public"."validation_status_enum" USING "validation_status"::"public"."validation_status_enum";--> statement-breakpoint
UPDATE "telemetry_events"
SET "session_id" = CONCAT('legacy-', "id"::text)
WHERE "session_id" IS NULL;
--> statement-breakpoint
UPDATE "telemetry_events"
SET "events" = '[]'::jsonb
WHERE "events" IS NULL;
--> statement-breakpoint
ALTER TABLE "telemetry_events" ALTER COLUMN "session_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "telemetry_events" ALTER COLUMN "events" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "replay" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "proof" jsonb DEFAULT '{"version":"legacy","artifactSha256":"","telemetryDigestSha256":"","issuedAt":"","validationStatus":null,"riskScore":null,"confidence":null,"signature":"","logEntryHash":null,"prevLogEntryHash":null}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "telemetry_events" ADD COLUMN "batch_sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "replay" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "certificates" ALTER COLUMN "proof" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "telemetry_events" ALTER COLUMN "batch_sequence" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "certificate_log_certificate_id_idx" ON "certificate_log" USING btree ("certificate_id");--> statement-breakpoint
CREATE INDEX "certificate_log_created_at_idx" ON "certificate_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "telemetry_session_expires_at_idx" ON "telemetry_sessions" USING btree ("expires_at");
