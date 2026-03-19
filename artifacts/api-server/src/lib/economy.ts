import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { PgTransaction } from "drizzle-orm/pg-core";

export const XP_TO_LEA_RATE = 0.01;
export const LEA_TO_EUR_RATE = 1.0;

export function xpToLea(xp: number): number {
  return Math.round(xp * XP_TO_LEA_RATE * 100) / 100;
}

export function leaToEur(lea: number): number {
  return Math.round(lea * LEA_TO_EUR_RATE * 100) / 100;
}

/**
 * Centralized XP award helper for all XP-earning actions (walk-in, discovery, receipts, etc.).
 * Accepts either the global `db` instance or a Drizzle transaction so callers can ensure
 * XP updates are part of the same atomic transaction as the action that earns them.
 *
 * Returns the user's updated XP total.
 */
export async function addXp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbOrTx: typeof db | PgTransaction<any, any, any>,
  userId: number,
  amount: number,
): Promise<number> {
  await dbOrTx
    .update(usersTable)
    .set({ xp: sql`${usersTable.xp} + ${amount}` })
    .where(eq(usersTable.id, userId));

  const [updated] = await dbOrTx
    .select({ xp: usersTable.xp })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return updated?.xp ?? 0;
}
