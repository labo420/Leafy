import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, vouchersTable, redemptionsTable } from "@workspace/db";
import {
  GetVouchersResponse,
  GetVouchersQueryParams,
  RedeemVoucherParams,
  RedeemVoucherResponse,
  GetRedemptionsResponse,
} from "@workspace/api-zod";
import { generateVoucherCode } from "../lib/scanner";
import { getOrCreateUser } from "./profile";

const router: IRouter = Router();

router.get("/vouchers", async (req, res): Promise<void> => {
  const queryParams = GetVouchersQueryParams.safeParse(req.query);
  const category = queryParams.success ? queryParams.data.category : undefined;

  const allVouchers = await db.select().from(vouchersTable)
    .where(eq(vouchersTable.isActive, true));

  const filtered = category
    ? allVouchers.filter(v => v.category === category)
    : allVouchers;

  res.json(GetVouchersResponse.parse(filtered.map(v => ({
    id: v.id,
    title: v.title,
    description: v.description,
    brandName: v.brandName,
    brandLogo: v.brandLogo,
    category: v.category,
    pointsCost: v.pointsCost,
    discount: v.discount,
    expiresAt: v.expiresAt ?? null,
    stock: v.stock,
    isAvailable: v.stock === null || v.stock > 0,
  }))));
});

router.post("/vouchers/:id/redeem", async (req, res): Promise<void> => {
  const params = RedeemVoucherParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = await getOrCreateUser();
  const [voucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, params.data.id));

  if (!voucher || !voucher.isActive) {
    res.status(404).json({ error: "Voucher non trovato." });
    return;
  }

  if (user.totalPoints < voucher.pointsCost) {
    res.status(400).json({ error: `Punti insufficienti. Hai ${user.totalPoints} punti, ne servono ${voucher.pointsCost}.` });
    return;
  }

  const existing = await db.select().from(redemptionsTable)
    .where(and(
      eq(redemptionsTable.userId, user.id),
      eq(redemptionsTable.voucherId, voucher.id)
    ));

  if (existing.length > 0) {
    res.status(400).json({ error: "Hai già riscattato questo voucher." });
    return;
  }

  const code = generateVoucherCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const [redemption] = await db.insert(redemptionsTable).values({
    userId: user.id,
    voucherId: voucher.id,
    code,
    pointsSpent: voucher.pointsCost,
    expiresAt,
  }).returning();

  const newPoints = user.totalPoints - voucher.pointsCost;
  await db.update(usersTable).set({ totalPoints: newPoints }).where(eq(usersTable.id, user.id));

  if (voucher.stock !== null) {
    await db.update(vouchersTable).set({ stock: voucher.stock - 1 }).where(eq(vouchersTable.id, voucher.id));
  }

  res.json(RedeemVoucherResponse.parse({
    redemptionId: redemption.id,
    voucherId: voucher.id,
    code,
    expiresAt,
    remainingPoints: newPoints,
    instructions: `Mostra questo codice in cassa presso ${voucher.brandName} entro 30 giorni.`,
  }));
});

router.get("/redemptions", async (_req, res): Promise<void> => {
  const user = await getOrCreateUser();

  const redemptions = await db.select({
    id: redemptionsTable.id,
    voucherId: redemptionsTable.voucherId,
    code: redemptionsTable.code,
    pointsSpent: redemptionsTable.pointsSpent,
    isUsed: redemptionsTable.isUsed,
    redeemedAt: redemptionsTable.redeemedAt,
    expiresAt: redemptionsTable.expiresAt,
    voucherTitle: vouchersTable.title,
    brandName: vouchersTable.brandName,
  })
    .from(redemptionsTable)
    .leftJoin(vouchersTable, eq(redemptionsTable.voucherId, vouchersTable.id))
    .where(eq(redemptionsTable.userId, user.id));

  res.json(GetRedemptionsResponse.parse(redemptions.map(r => ({
    id: r.id,
    voucherId: r.voucherId,
    voucherTitle: r.voucherTitle ?? "",
    brandName: r.brandName ?? "",
    code: r.code,
    pointsSpent: r.pointsSpent,
    redeemedAt: r.redeemedAt,
    expiresAt: r.expiresAt ?? null,
    isUsed: r.isUsed,
  }))));
});

export default router;
