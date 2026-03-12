import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, receiptsTable } from "@workspace/db";
import { GetReceiptsResponse, GetReceiptResponse, GetReceiptParams } from "@workspace/api-zod";
import { getOrCreateUser } from "./profile";

const router: IRouter = Router();

router.get("/receipts", async (_req, res): Promise<void> => {
  const user = await getOrCreateUser();

  const receipts = await db.select().from(receiptsTable)
    .where(eq(receiptsTable.userId, user.id))
    .orderBy(desc(receiptsTable.scannedAt));

  const data = GetReceiptsResponse.parse(receipts.map(r => ({
    id: r.id,
    storeName: r.storeName,
    purchaseDate: r.purchaseDate,
    pointsEarned: r.pointsEarned,
    greenItemsCount: r.greenItemsCount,
    categories: r.categories,
    scannedAt: r.scannedAt,
  })));

  res.json(data);
});

router.get("/receipts/:id", async (req, res): Promise<void> => {
  const params = GetReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = await getOrCreateUser();
  const [receipt] = await db.select().from(receiptsTable)
    .where(eq(receiptsTable.id, params.data.id));

  if (!receipt || receipt.userId !== user.id) {
    res.status(404).json({ error: "Scontrino non trovato." });
    return;
  }

  let greenItems = [];
  try { greenItems = JSON.parse(receipt.greenItemsJson); } catch {}

  res.json(GetReceiptResponse.parse({
    id: receipt.id,
    storeName: receipt.storeName,
    purchaseDate: receipt.purchaseDate,
    pointsEarned: receipt.pointsEarned,
    greenItems,
    scannedAt: receipt.scannedAt,
  }));
});

export default router;
