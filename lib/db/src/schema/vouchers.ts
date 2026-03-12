import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  brandName: text("brand_name").notNull(),
  brandLogo: text("brand_logo"),
  category: text("category").notNull(),
  pointsCost: integer("points_cost").notNull(),
  discount: text("discount").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  stock: integer("stock"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redemptionsTable = pgTable("redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  voucherId: integer("voucher_id").notNull().references(() => vouchersTable.id),
  code: text("code").notNull().unique(),
  pointsSpent: integer("points_spent").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, createdAt: true });
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;

export const insertRedemptionSchema = createInsertSchema(redemptionsTable).omit({ id: true, redeemedAt: true });
export type InsertRedemption = z.infer<typeof insertRedemptionSchema>;
export type Redemption = typeof redemptionsTable.$inferSelect;
