import { pgTable, text, serial, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { receiptsTable } from "./receipts";

export const barcodeScansTable = pgTable("barcode_scans", {
  id: serial("id").primaryKey(),
  receiptId: integer("receipt_id").notNull().references(() => receiptsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  barcode: text("barcode").notNull(),
  productName: text("product_name").notNull().default(""),
  ecoScore: text("eco_score"),
  pointsEarned: integer("points_earned").notNull().default(0),
  category: text("category").notNull().default(""),
  emoji: text("emoji").notNull().default(""),
  reasoning: text("reasoning").notNull().default(""),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("barcode_scans_receipt_barcode_unique").on(table.receiptId, table.barcode),
]);

export const insertBarcodeScanSchema = createInsertSchema(barcodeScansTable).omit({ id: true, scannedAt: true });
export type InsertBarcodeScan = z.infer<typeof insertBarcodeScanSchema>;
export type BarcodeScan = typeof barcodeScansTable.$inferSelect;
