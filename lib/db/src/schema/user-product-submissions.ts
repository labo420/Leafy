import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userProductSubmissionsTable = pgTable("user_product_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  barcode: text("barcode"),
  productName: text("product_name").notNull(),
  weightValue: text("weight_value"),
  weightUnit: text("weight_unit"),
  ecoScore: text("eco_score"),
  pointsAwarded: integer("points_awarded"),
  classifiedByAI: boolean("classified_by_ai").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserProductSubmission = typeof userProductSubmissionsTable.$inferSelect;
