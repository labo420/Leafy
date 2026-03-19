import {
  pgTable, text, serial, timestamp, integer, boolean,
  doublePrecision, pgEnum, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const locationTypeEnum = pgEnum("location_type", ["oasi", "standard"]);
export const walkinStatusEnum = pgEnum("walkin_status", ["pending", "completed", "failed"]);

export const locationsTable = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  chain: text("chain").notNull(),
  type: locationTypeEnum("type").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walkinSessionsTable = pgTable("walkin_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  xpAwarded: integer("xp_awarded").notNull().default(0),
  status: walkinStatusEnum("status").notNull().default("pending"),
});

// One completion per (user, location, day) enforced at DB level via unique index
export const walkinCompletionsTable = pgTable(
  "walkin_completions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    locationId: integer("location_id").notNull().references(() => locationsTable.id),
    sessionId: integer("session_id").notNull().references(() => walkinSessionsTable.id),
    dayBucket: text("day_bucket").notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uniq_walkin_completion_per_day").on(t.userId, t.locationId, t.dayBucket),
  ],
);

export const discoveryChallengesTable = pgTable("discovery_challenges", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  barcode: text("barcode").notNull(),
  productName: text("product_name").notNull(),
  productDescription: text("product_description"),
  emoji: text("emoji").notNull().default("🌿"),
  xpReward: integer("xp_reward").notNull().default(20),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One completion per (user, challenge, day) enforced at DB level via unique index
export const discoveryCompletionsTable = pgTable(
  "discovery_completions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    challengeId: integer("challenge_id").notNull().references(() => discoveryChallengesTable.id),
    dayBucket: text("day_bucket").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    xpAwarded: integer("xp_awarded").notNull().default(20),
  },
  (t) => [
    uniqueIndex("uniq_discovery_completion_per_day").on(t.userId, t.challengeId, t.dayBucket),
  ],
);

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;

export const insertWalkinSessionSchema = createInsertSchema(walkinSessionsTable).omit({ id: true, startedAt: true });
export type InsertWalkinSession = z.infer<typeof insertWalkinSessionSchema>;
export type WalkinSession = typeof walkinSessionsTable.$inferSelect;

export const insertDiscoveryChallengeSchema = createInsertSchema(discoveryChallengesTable).omit({ id: true, createdAt: true });
export type InsertDiscoveryChallenge = z.infer<typeof insertDiscoveryChallengeSchema>;
export type DiscoveryChallenge = typeof discoveryChallengesTable.$inferSelect;
