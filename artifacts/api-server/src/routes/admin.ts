import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, count, sum, desc } from "drizzle-orm";
import { db, usersTable, receiptsTable, vouchersTable, challengesTable } from "@workspace/db";
import { approvePendingPoints } from "../lib/antiFraud";

const router: IRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "leafy2026";

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const pw = req.headers["x-admin-password"] as string | undefined;
  if (pw !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Password admin non valida." });
    return;
  }
  next();
}

router.post("/admin/auth", (req, res): void => {
  const { password } = req.body as { password?: string };
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Password non valida." });
  }
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [receiptCount] = await db.select({ count: count() }).from(receiptsTable);
  const [pointsTotal] = await db.select({ total: sum(receiptsTable.pointsEarned) }).from(receiptsTable);
  const [voucherCount] = await db.select({ count: count() }).from(vouchersTable);
  const [challengeCount] = await db.select({ count: count() }).from(challengesTable);

  const topUsers = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    totalPoints: usersTable.totalPoints,
    streak: usersTable.streak,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(desc(usersTable.totalPoints)).limit(10);

  res.json({
    users: userCount.count,
    receipts: receiptCount.count,
    totalPointsAwarded: pointsTotal.total ?? 0,
    vouchers: voucherCount.count,
    challenges: challengeCount.count,
    topUsers,
  });
});

router.get("/admin/vouchers", requireAdmin, async (_req, res): Promise<void> => {
  const vouchers = await db.select().from(vouchersTable).orderBy(desc(vouchersTable.createdAt));
  res.json(vouchers);
});

router.post("/admin/vouchers", requireAdmin, async (req, res): Promise<void> => {
  const { title, description, brandName, brandLogo, category, pointsCost, discount, stock } = req.body as {
    title?: string; description?: string; brandName?: string; brandLogo?: string;
    category?: string; pointsCost?: number; discount?: string; stock?: number;
  };

  if (!title || !description || !brandName || !category || !pointsCost || !discount) {
    res.status(400).json({ error: "Campi obbligatori mancanti." });
    return;
  }

  const [voucher] = await db.insert(vouchersTable).values({
    title, description, brandName, brandLogo: brandLogo ?? null,
    category, pointsCost, discount, stock: stock ?? null, isActive: true,
  }).returning();

  res.json(voucher);
});

router.put("/admin/vouchers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido." }); return; }

  const { isActive, stock, pointsCost } = req.body as { isActive?: boolean; stock?: number; pointsCost?: number };
  const updates: Record<string, unknown> = {};
  if (isActive !== undefined) updates.isActive = isActive;
  if (stock !== undefined) updates.stock = stock;
  if (pointsCost !== undefined) updates.pointsCost = pointsCost;

  const [updated] = await db.update(vouchersTable).set(updates).where(eq(vouchersTable.id, id)).returning();
  res.json(updated);
});

router.delete("/admin/vouchers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido." }); return; }
  await db.delete(vouchersTable).where(eq(vouchersTable.id, id));
  res.json({ ok: true });
});

router.get("/admin/challenges", requireAdmin, async (_req, res): Promise<void> => {
  const challenges = await db.select().from(challengesTable).orderBy(desc(challengesTable.createdAt));
  res.json(challenges);
});

router.post("/admin/challenges", requireAdmin, async (req, res): Promise<void> => {
  const { title, description, category, emoji, targetCount, rewardPoints, expiresAt } = req.body as {
    title?: string; description?: string; category?: string; emoji?: string;
    targetCount?: number; rewardPoints?: number; expiresAt?: string;
  };

  if (!title || !description || !category || !emoji || !targetCount || !rewardPoints || !expiresAt) {
    res.status(400).json({ error: "Campi obbligatori mancanti." });
    return;
  }

  const [challenge] = await db.insert(challengesTable).values({
    title, description, category, emoji,
    targetCount, rewardPoints,
    expiresAt: new Date(expiresAt),
    isActive: true,
  }).returning();

  res.json(challenge);
});

router.put("/admin/challenges/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido." }); return; }

  const { isActive } = req.body as { isActive?: boolean };
  const [updated] = await db.update(challengesTable)
    .set({ isActive })
    .where(eq(challengesTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/admin/challenges/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido." }); return; }
  await db.delete(challengesTable).where(eq(challengesTable.id, id));
  res.json({ ok: true });
});

router.get("/admin/fraud/flagged", requireAdmin, async (_req, res): Promise<void> => {
  const flagged = await db
    .select({
      id: receiptsTable.id,
      userId: receiptsTable.userId,
      storeName: receiptsTable.storeName,
      purchaseDate: receiptsTable.purchaseDate,
      pointsEarned: receiptsTable.pointsEarned,
      status: receiptsTable.status,
      flagReason: receiptsTable.flagReason,
      scannedAt: receiptsTable.scannedAt,
    })
    .from(receiptsTable)
    .where(eq(receiptsTable.status, "flagged"))
    .orderBy(desc(receiptsTable.scannedAt))
    .limit(100);

  const pending = await db
    .select({
      id: receiptsTable.id,
      userId: receiptsTable.userId,
      storeName: receiptsTable.storeName,
      pointsEarned: receiptsTable.pointsEarned,
      status: receiptsTable.status,
      scannedAt: receiptsTable.scannedAt,
    })
    .from(receiptsTable)
    .where(eq(receiptsTable.status, "pending"))
    .orderBy(desc(receiptsTable.scannedAt))
    .limit(100);

  res.json({ flagged, pending });
});

router.post("/admin/fraud/approve-pending", requireAdmin, async (_req, res): Promise<void> => {
  const count = await approvePendingPoints();
  res.json({ ok: true, approved: count });
});

router.put("/admin/fraud/receipts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido." }); return; }

  const { status } = req.body as { status?: string };
  if (!status || !["approved", "rejected", "flagged"].includes(status)) {
    res.status(400).json({ error: "Status non valido. Usa: approved, rejected, flagged." });
    return;
  }

  const [updated] = await db
    .update(receiptsTable)
    .set({ status })
    .where(eq(receiptsTable.id, id))
    .returning();

  if (status === "approved" && updated) {
    await db
      .update(usersTable)
      .set({ totalPoints: updated.pointsEarned })
      .where(eq(usersTable.id, updated.userId));
  }

  res.json(updated);
});

router.post("/admin/user/:email/add-lea", requireAdmin, async (req, res): Promise<void> => {
  const email = (req.params.email as string).toLowerCase();
  const { amount } = req.body as { amount?: number };

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Amount deve essere un numero positivo." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) {
    res.status(404).json({ error: "Utente non trovato." });
    return;
  }

  const newBalance = Math.floor((parseFloat(String(user.leaBalance ?? "0"))) + amount);
  const [updated] = await db
    .update(usersTable)
    .set({ leaBalance: newBalance })
    .where(eq(usersTable.id, user.id))
    .returning();

  res.json({ ok: true, user: updated.email, newBalance: updated.leaBalance });
});

export default router;
