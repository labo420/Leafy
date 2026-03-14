CREATE TYPE "public"."badge_type" AS ENUM('lifetime', 'weekly', 'monthly', 'seasonal');--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"replit_id" varchar,
	"password_hash" varchar,
	"username" text DEFAULT 'Utente Leafy' NOT NULL,
	"email" text DEFAULT 'demo@leafy.app' NOT NULL,
	"profile_image_url" text,
	"total_points" integer DEFAULT 0 NOT NULL,
	"pending_points" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"last_scan_date" timestamp with time zone,
	"referral_code" text NOT NULL,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"referral_points_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_replit_id_unique" UNIQUE("replit_id"),
	CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "green_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"category" text NOT NULL,
	"certifications" text[] DEFAULT '{}' NOT NULL,
	"sustainability_score" integer DEFAULT 5 NOT NULL,
	"points_value" integer DEFAULT 10 NOT NULL,
	"emoji" text DEFAULT '🌿' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"store_name" text,
	"purchase_date" text,
	"image_hash" text NOT NULL,
	"raw_text" text,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"green_items_count" integer DEFAULT 0 NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"green_items_json" text DEFAULT '[]' NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"flag_reason" text,
	"barcode_expiry" timestamp with time zone,
	"barcode_mode" integer DEFAULT 1 NOT NULL,
	"receipt_date" text,
	"receipt_total" integer
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"voucher_id" integer NOT NULL,
	"code" text NOT NULL,
	"points_spent" integer NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "redemptions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"brand_name" text NOT NULL,
	"brand_logo" text,
	"category" text NOT NULL,
	"points_cost" integer NOT NULL,
	"discount" text NOT NULL,
	"expires_at" timestamp with time zone,
	"stock" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"challenge_id" integer NOT NULL,
	"current_count" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"emoji" text NOT NULL,
	"target_count" integer NOT NULL,
	"reward_points" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_name_normalized" text NOT NULL,
	"product_name_original" text NOT NULL,
	"eco_score" text,
	"points" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '🌿' NOT NULL,
	"cached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_cache_product_name_normalized_unique" UNIQUE("product_name_normalized")
);
--> statement-breakpoint
CREATE TABLE "barcode_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"barcode" text NOT NULL,
	"product_name" text DEFAULT '' NOT NULL,
	"eco_score" text,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"emoji" text DEFAULT '' NOT NULL,
	"reasoning" text DEFAULT '' NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barcode_scans_receipt_barcode_unique" UNIQUE("receipt_id","barcode")
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"unlock_hint" text NOT NULL,
	"badge_type" "badge_type" DEFAULT 'lifetime' NOT NULL,
	"period_key" text,
	"target_count" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"badge_id" integer NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"period_key" text,
	"current_progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_progress" ADD CONSTRAINT "challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_progress" ADD CONSTRAINT "challenge_progress_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barcode_scans" ADD CONSTRAINT "barcode_scans_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barcode_scans" ADD CONSTRAINT "barcode_scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");