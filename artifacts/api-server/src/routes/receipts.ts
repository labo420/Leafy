import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, receiptsTable, barcodeScansTable } from "@workspace/db";
import { GetReceiptsResponse, GetReceiptParams } from "@workspace/api-zod";
import { requireUser } from "./profile";

const router: IRouter = Router();

router.get("/receipts", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

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

  const user = await requireUser(req, res);
  if (!user) return;

  const [receipt] = await db.select().from(receiptsTable)
    .where(eq(receiptsTable.id, params.data.id));

  if (!receipt || receipt.userId !== user.id) {
    res.status(404).json({ error: "Scontrino non trovato." });
    return;
  }

  let greenItems = [];
  try { greenItems = JSON.parse(receipt.greenItemsJson); } catch {}

  const barcodeScans = await db.select().from(barcodeScansTable)
    .where(eq(barcodeScansTable.receiptId, receipt.id))
    .orderBy(desc(barcodeScansTable.scannedAt));

  res.json({
    id: receipt.id,
    storeName: receipt.storeName,
    purchaseDate: receipt.purchaseDate,
    pointsEarned: receipt.pointsEarned,
    greenItems,
    scannedAt: receipt.scannedAt,
    barcodeExpiry: receipt.barcodeExpiry,
    barcodeScans: barcodeScans.map(s => ({
      id: s.id,
      barcode: s.barcode,
      productName: s.productName,
      ecoScore: s.ecoScore,
      pointsEarned: s.pointsEarned,
      category: s.category,
      emoji: s.emoji,
      reasoning: s.reasoning,
      scannedAt: s.scannedAt,
    })),
  });
});

export default router;
