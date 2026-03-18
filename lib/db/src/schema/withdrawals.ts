import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const leaWithdrawalsTable = pgTable("lea_withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  leaAmount: numeric("lea_amount", { precision: 10, scale: 2 }).notNull(),
  euroAmount: numeric("euro_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const insertLeaWithdrawalSchema = createInsertSchema(leaWithdrawalsTable).omit({ id: true, requestedAt: true });
export type InsertLeaWithdrawal = z.infer<typeof insertLeaWithdrawalSchema>;
export type LeaWithdrawal = typeof leaWithdrawalsTable.$inferSelect;
