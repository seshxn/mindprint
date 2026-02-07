CREATE TABLE "certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"text" text NOT NULL,
	"score" integer NOT NULL,
	"seed" text NOT NULL,
	"sparkline" jsonb NOT NULL,
	"validation_status" text
);
--> statement-breakpoint
CREATE INDEX "certificate_issued_at_idx" ON "certificates" USING btree ("issued_at");