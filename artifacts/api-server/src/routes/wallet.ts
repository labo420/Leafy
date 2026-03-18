import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, usersTable, leaWithdrawalsTable, type LeaWithdrawal } from "@workspace/db";
import { requireUser } from "./profile";

const router: IRouter = Router();

const LEA_TO_EUR = 0.01;
const MIN_LEA_BATTLE_PASS = 500;
const MIN_LEA_STANDARD = 1000;

router.post("/wallet/withdraw", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { leaAmount } = req.body;

  const amount = typeof leaAmount === "string" ? parseFloat(leaAmount) : leaAmount;

  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: "Importo non valido." });
    return;
  }

  const minLea = user.hasBattlePass ? MIN_LEA_BATTLE_PASS : MIN_LEA_STANDARD;
  if (amount < minLea) {
    const minEur = (minLea * LEA_TO_EUR).toLocaleString("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    res.status(400).json({
      error: `Importo minimo: ${minLea.toLocaleString("it-IT")} $LEA (${minEur} €)${user.hasBattlePass ? " con Battle Pass" : ""}.`,
    });
    return;
  }

  const currentBalance = parseFloat(user.leaBalance as string);
  if (amount > currentBalance) {
    res.status(400).json({ error: "Saldo $LEA insufficiente." });
    return;
  }

  const euroAmount = amount * LEA_TO_EUR;

  const withdrawal = await db.transaction(async (tx) => {
    await tx
      .update(usersTable)
      .set({ leaBalance: sql`lea_balance - ${amount.toFixed(2)}::numeric` })
      .where(eq(usersTable.id, user.id));

    const [record] = await tx
      .insert(leaWithdrawalsTable)
      .values({
        userId: user.id,
        leaAmount: amount.toFixed(2),
        euroAmount: euroAmount.toFixed(2),
        status: "pending",
      })
      .returning();

    return record;
  });

  res.json({
    id: withdrawal.id,
    leaAmount: withdrawal.leaAmount,
    euroAmount: withdrawal.euroAmount,
    status: withdrawal.status,
    requestedAt: withdrawal.requestedAt,
  });
});

router.get("/wallet/withdrawals", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const withdrawals = await db
    .select()
    .from(leaWithdrawalsTable)
    .where(eq(leaWithdrawalsTable.userId, user.id))
    .orderBy(desc(leaWithdrawalsTable.requestedAt))
    .limit(10);

  res.json(
    withdrawals.map((w: LeaWithdrawal) => ({
      id: w.id,
      leaAmount: w.leaAmount,
      euroAmount: w.euroAmount,
      status: w.status,
      requestedAt: w.requestedAt,
      processedAt: w.processedAt,
    })),
  );
});

export default router;
