import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const greenProductsTable = pgTable("green_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  certifications: text("certifications").array().notNull().default([]),
  sustainabilityScore: integer("sustainability_score").notNull().default(5),
  pointsValue: integer("points_value").notNull().default(10),
  emoji: text("emoji").notNull().default("🌿"),
  description: text("description").notNull().default(""),
  keywords: text("keywords").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGreenProductSchema = createInsertSchema(greenProductsTable).omit({ id: true, createdAt: true });
export type InsertGreenProduct = z.infer<typeof insertGreenProductSchema>;
export type GreenProduct = typeof greenProductsTable.$inferSelect;
