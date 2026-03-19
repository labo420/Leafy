import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export const XP_TO_LEA_RATE = 0.01;
export const LEA_TO_EUR_RATE = 1.0;

export function xpToLea(xp: number): number {
  return Math.round(xp * XP_TO_LEA_RATE * 100) / 100;
}

export function leaToEur(lea: number): number {
  return Math.round(lea * LEA_TO_EUR_RATE * 100) / 100;
}

/**
 * Centralized XP award helper for all XP-earning actions (receipts, discovery, etc.).
 * Uses the global db connection. For callers inside a Drizzle transaction, use the
 * transaction-local SQL pattern directly (see addXpInTx) to keep the award atomic.
 *
 * Returns the user's updated XP total.
 */
export async function addXp(userId: number, amount: number): Promise<number> {
  await db
    .update(usersTable)
    .set({ xp: sql`${usersTable.xp} + ${amount}` })
    .where(eq(usersTable.id, userId));

  const [updated] = await db
    .select({ xp: usersTable.xp })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return updated?.xp ?? 0;
}
