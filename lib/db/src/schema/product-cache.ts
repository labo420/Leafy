import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productCacheTable = pgTable("product_cache", {
  id: serial("id").primaryKey(),
  productNameNormalized: text("product_name_normalized").notNull().unique(),
  productNameOriginal: text("product_name_original").notNull(),
  ecoScore: text("eco_score"),
  points: integer("points").notNull().default(0),
  category: text("category").notNull().default(""),
  source: text("source").notNull().default("ai"),
  reasoning: text("reasoning").notNull().default(""),
  emoji: text("emoji").notNull().default("🌿"),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductCacheSchema = createInsertSchema(productCacheTable).omit({ id: true, cachedAt: true });
export type InsertProductCache = z.infer<typeof insertProductCacheSchema>;
export type ProductCache = typeof productCacheTable.$inferSelect;
