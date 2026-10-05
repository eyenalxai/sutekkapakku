CREATE TYPE "sticker_set_type" AS ENUM('REGULAR', 'ANIMATED', 'VIDEO');--> statement-breakpoint
CREATE TABLE "sticker_set" (
	"id" serial PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(256) NOT NULL CONSTRAINT "sticker_set_name_key" UNIQUE,
	"title" varchar(256) NOT NULL CONSTRAINT "sticker_set_title_key" UNIQUE,
	"sticker_set_type" "sticker_set_type" NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"telegram_id" varchar(512) NOT NULL CONSTRAINT "user_telegram_id_key" UNIQUE
);
--> statement-breakpoint
ALTER TABLE "sticker_set" ADD CONSTRAINT "sticker_set_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");