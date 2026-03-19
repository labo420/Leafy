CREATE TYPE "public"."badge_type" AS ENUM('lifetime', 'weekly', 'monthly', 'seasonal');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('oasi', 'standard');--> statement-breakpoint
CREATE TYPE "public"."walkin_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
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
	"xp" integer DEFAULT 0 NOT NULL,
	"lea_balance" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"pending_points" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"last_scan_date" timestamp with time zone,
	"has_battle_pass" boolean DEFAULT false NOT NULL,
	"battle_pass_expiry" timestamp with time zone,
	"referral_code" text NOT NULL,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"referral_points_earned" integer DEFAULT 0 NOT NULL,
	"referral_xp_multiplier_remaining" integer DEFAULT 0 NOT NULL,
	"login_streak" integer DEFAULT 0 NOT NULL,
	"last_login_date" timestamp with time zone,
	"bp_streak_day" integer DEFAULT 0 NOT NULL,
	"bp_streak_claimed" integer DEFAULT 0 NOT NULL,
	"bp_streak_completed" boolean DEFAULT false NOT NULL,
	"bp_streak_completed_month" varchar(7),
	"bp_last_login_date" timestamp with time zone,
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
	"receipt_total" integer,
	"image_url" text,
	"image_expires_at" timestamp with time zone,
	"store_chain" text,
	"province" text,
	"document_number" text
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
	"co2_per_unit" real,
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
CREATE TABLE "user_product_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"barcode" text,
	"product_name" text NOT NULL,
	"weight_value" text,
	"weight_unit" text,
	"eco_score" text,
	"points_awarded" integer,
	"classified_by_ai" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lea_withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lea_amount" numeric(10, 2) NOT NULL,
	"euro_amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kit_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kit_id" integer NOT NULL,
	"completed_slots_json" text DEFAULT '[]' NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sustainability_kits" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"slots_json" text DEFAULT '[]' NOT NULL,
	"reward_xp" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"barcode" text NOT NULL,
	"product_name" text NOT NULL,
	"product_description" text,
	"emoji" text DEFAULT '🌿' NOT NULL,
	"xp_reward" integer DEFAULT 20 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"challenge_id" integer NOT NULL,
	"day_bucket" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"xp_awarded" integer DEFAULT 20 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"chain" text NOT NULL,
	"type" "location_type" NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walkin_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"day_bucket" text NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walkin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"status" "walkin_status" DEFAULT 'pending' NOT NULL
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
ALTER TABLE "user_product_submissions" ADD CONSTRAINT "user_product_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lea_withdrawals" ADD CONSTRAINT "lea_withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_progress" ADD CONSTRAINT "kit_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_progress" ADD CONSTRAINT "kit_progress_kit_id_sustainability_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."sustainability_kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_challenges" ADD CONSTRAINT "discovery_challenges_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_completions" ADD CONSTRAINT "discovery_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_completions" ADD CONSTRAINT "discovery_completions_challenge_id_discovery_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."discovery_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkin_completions" ADD CONSTRAINT "walkin_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkin_completions" ADD CONSTRAINT "walkin_completions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkin_completions" ADD CONSTRAINT "walkin_completions_session_id_walkin_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."walkin_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkin_sessions" ADD CONSTRAINT "walkin_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "walkin_sessions" ADD CONSTRAINT "walkin_sessions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_receipts_document_number" ON "receipts" USING btree ("document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_discovery_completion_per_day" ON "discovery_completions" USING btree ("user_id","challenge_id","day_bucket");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_walkin_completion_per_day" ON "walkin_completions" USING btree ("user_id","location_id","day_bucket");