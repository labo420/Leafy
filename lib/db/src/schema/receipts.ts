import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const receiptsTable = pgTable("receipts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  storeName: text("store_name"),
  purchaseDate: text("purchase_date"),
  imageHash: text("image_hash").notNull(),
  rawText: text("raw_text"),
  pointsEarned: integer("points_earned").notNull().default(0),
  greenItemsCount: integer("green_items_count").notNull().default(0),
  categories: text("categories").array().notNull().default([]),
  greenItemsJson: text("green_items_json").notNull().default("[]"),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("approved"),
  flagReason: text("flag_reason"),
  barcodeExpiry: timestamp("barcode_expiry", { withTimezone: true }),
});

export const insertReceiptSchema = createInsertSchema(receiptsTable).omit({ id: true, scannedAt: true });
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receiptsTable.$inferSelect;
