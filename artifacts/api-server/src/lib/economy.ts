import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

export const DROPS_TO_LEA_RATE = 0.01;
export const LEA_TO_EUR_RATE = 1.0;

export function dropsToLea(drops: number): number {
  return Math.floor(drops * DROPS_TO_LEA_RATE);
}

export function leaToEur(lea: number): number {
  return Math.floor(lea) * LEA_TO_EUR_RATE;
}

// Extract the Drizzle transaction type from db.transaction without using `any`
type DbTransaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

async function _addDropsImpl(
  dbOrTx: typeof db | DbTransaction,
  userId: number,
  amount: number,
): Promise<number> {
  await dbOrTx
    .update(usersTable)
    .set({ drops: sql`${usersTable.drops} + ${amount}` })
    .where(eq(usersTable.id, userId));
  const [updated] = await dbOrTx
    .select({ drops: usersTable.drops })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return updated?.drops ?? 0;
}

/** Award drops outside a transaction (e.g. standalone reward actions). */
export function addDrops(userId: number, amount: number): Promise<number> {
  return _addDropsImpl(db, userId, amount);
}

/** Award drops inside an existing Drizzle transaction to keep award atomic. */
export function addDropsInTx(tx: DbTransaction, userId: number, amount: number): Promise<number> {
  return _addDropsImpl(tx, userId, amount);
}

