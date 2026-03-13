import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
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
  streak: integer("streak").notNull().default(0),
  lastScanDate: timestamp("last_scan_date", { withTimezone: true }),
  referralCode: text("referral_code").notNull().unique(),
  referralCount: integer("referral_count").notNull().default(0),
  referralPointsEarned: integer("referral_points_earned").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
