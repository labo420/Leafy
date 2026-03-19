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

// Extract the Drizzle transaction type from db.transaction without using `any`
type DbTransaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

async function _addXpImpl(
  dbOrTx: typeof db | DbTransaction,
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

/** Award XP outside a transaction (e.g. standalone reward actions). */
export function addXp(userId: number, amount: number): Promise<number> {
  return _addXpImpl(db, userId, amount);
}

/** Award XP inside an existing Drizzle transaction to keep award atomic. */
export function addXpInTx(tx: DbTransaction, userId: number, amount: number): Promise<number> {
  return _addXpImpl(tx, userId, amount);
}
