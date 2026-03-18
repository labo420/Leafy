import { pgTable, text, serial, timestamp, integer, varchar, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  replitId: varchar("replit_id").unique(),
  passwordHash: varchar("password_hash"),
  username: text("username").notNull().default("Utente Leafy"),
  email: text("email").notNull().default("demo@leafy.app"),
  profileImageUrl: text("profile_image_url"),
  totalPoints: integer("total_points").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  leaBalance: numeric("lea_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  pendingPoints: integer("pending_points").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastScanDate: timestamp("last_scan_date", { withTimezone: true }),
  hasBattlePass: boolean("has_battle_pass").notNull().default(false),
  battlePassExpiry: timestamp("battle_pass_expiry", { withTimezone: true }),
  referralCode: text("referral_code").notNull().unique(),
  referralCount: integer("referral_count").notNull().default(0),
  referralPointsEarned: integer("referral_points_earned").notNull().default(0),
  referralXpMultiplierRemaining: integer("referral_xp_multiplier_remaining").notNull().default(0),
  loginStreak: integer("login_streak").notNull().default(0),
  lastLoginDate: timestamp("last_login_date", { withTimezone: true }),
  bpStreakDay: integer("bp_streak_day").notNull().default(0),
  bpStreakClaimed: integer("bp_streak_claimed").notNull().default(0),
  bpStreakCompleted: boolean("bp_streak_completed").notNull().default(false),
  bpStreakCompletedMonth: varchar("bp_streak_completed_month", { length: 7 }),
  bpLastLoginDate: timestamp("bp_last_login_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
