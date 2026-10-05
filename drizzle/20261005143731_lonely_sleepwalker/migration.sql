ALTER TABLE "sticker_set" ADD COLUMN "sticker_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sticker_set" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sticker_set" ADD COLUMN "archived_reason" varchar(32);