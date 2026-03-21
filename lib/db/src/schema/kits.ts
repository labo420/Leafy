import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sustainabilityKitsTable = pgTable("sustainability_kits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  slotsJson: text("slots_json").notNull().default("[]"),
  rewardDrops: integer("reward_xp").notNull().default(50),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kitProgressTable = pgTable("kit_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  kitId: integer("kit_id").notNull().references(() => sustainabilityKitsTable.id),
  completedSlotsJson: text("completed_slots_json").notNull().default("[]"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSustainabilityKitSchema = createInsertSchema(sustainabilityKitsTable).omit({ id: true, createdAt: true });
export type InsertSustainabilityKit = z.infer<typeof insertSustainabilityKitSchema>;
export type SustainabilityKit = typeof sustainabilityKitsTable.$inferSelect;

export const insertKitProgressSchema = createInsertSchema(kitProgressTable).omit({ id: true, updatedAt: true });
export type InsertKitProgress = z.infer<typeof insertKitProgressSchema>;
export type KitProgress = typeof kitProgressTable.$inferSelect;
