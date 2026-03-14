import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, receiptsTable, barcodeScansTable } from "@workspace/db";
import { GetReceiptParams } from "@workspace/api-zod";
import { requireUser } from "./profile";
import { getReceiptImageStream } from "../lib/receiptImages";
import { getAcceptedStoresList } from "../lib/supermarketWhitelist";

const router: IRouter = Router();

router.get("/receipts", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const receipts = await db.select().from(receiptsTable)
    .where(eq(receiptsTable.userId, user.id))
    .orderBy(desc(receiptsTable.scannedAt));

  const now = new Date();
  const data = receipts.map(r => {
    const imageActive = !!r.imageUrl && !!r.imageExpiresAt && r.imageExpiresAt > now;
    const isPending = r.status === "pending_barcode" && !!r.barcodeExpiry && r.barcodeExpiry > now;
    const remainingMs = isPending ? new Date(r.barcodeExpiry!).getTime() - now.getTime() : 0;
    const remainingHours = isPending ? Math.max(0, Math.floor(remainingMs / 3600000)) : 0;

    let pendingProductsCount = 0;
    if (r.status === "pending_barcode") {
      try {
        const items = JSON.parse(r.greenItemsJson ?? "[]") as Array<{ matched?: boolean }>;
        pendingProductsCount = items.filter(i => !i.matched).length;
      } catch {}
    }

    return {
      id: r.id,
      storeName: r.storeChain ?? r.storeName,
      storeChain: r.storeChain ?? null,
      province: r.province ?? null,
      purchaseDate: r.purchaseDate,
      pointsEarned: r.pointsEarned,
      greenItemsCount: r.greenItemsCount,
      categories: r.categories,
      scannedAt: r.scannedAt,
      hasImage: imageActive,
      imageExpiresAt: imageActive ? r.imageExpiresAt!.toISOString() : null,
      status: r.status,
      barcodeExpiry: r.barcodeExpiry ? r.barcodeExpiry.toISOString() : null,
      isPending,
      remainingHours,
      pendingProductsCount,
    };
  });

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

  let greenItems: Array<{ name: string; matched?: boolean; barcode?: string | null; ecoScore?: string | null; points: number; emoji?: string | null; category?: string | null }> = [];
  try { greenItems = JSON.parse(receipt.greenItemsJson); } catch {}

  const barcodeScans = await db.select().from(barcodeScansTable)
    .where(eq(barcodeScansTable.receiptId, receipt.id))
    .orderBy(desc(barcodeScansTable.scannedAt));

  const imageActive = !!receipt.imageUrl && !!receipt.imageExpiresAt && receipt.imageExpiresAt > new Date();
  const now = new Date();
  const isPending = receipt.status === "pending_barcode" && !!receipt.barcodeExpiry && receipt.barcodeExpiry > now;
  const remainingMs = isPending ? new Date(receipt.barcodeExpiry!).getTime() - now.getTime() : 0;
  const remainingHours = isPending ? Math.max(0, Math.floor(remainingMs / 3600000)) : 0;

  res.json({
    id: receipt.id,
    storeName: receipt.storeChain ?? receipt.storeName,
    storeChain: receipt.storeChain ?? null,
    province: receipt.province ?? null,
    purchaseDate: receipt.purchaseDate,
    pointsEarned: receipt.pointsEarned,
    greenItems,
    scannedAt: receipt.scannedAt,
    barcodeExpiry: receipt.barcodeExpiry ? receipt.barcodeExpiry.toISOString() : null,
    hasImage: imageActive,
    imageExpiresAt: imageActive ? receipt.imageExpiresAt!.toISOString() : null,
    status: receipt.status,
    isPending,
    remainingHours,
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

router.get("/receipts/:id/image", async (req, res): Promise<void> => {
  const receiptId = parseInt(req.params.id, 10);
  if (isNaN(receiptId)) {
    res.status(400).json({ error: "ID non valido." });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const [receipt] = await db.select().from(receiptsTable)
    .where(eq(receiptsTable.id, receiptId));

  if (!receipt || receipt.userId !== user.id) {
    res.status(404).json({ error: "Scontrino non trovato." });
    return;
  }

  if (!receipt.imageUrl) {
    res.status(404).json({ error: "Nessuna foto disponibile." });
    return;
  }

  if (receipt.imageExpiresAt && new Date() > receipt.imageExpiresAt) {
    res.status(410).json({ error: "La foto è scaduta ed è stata rimossa." });
    return;
  }

  const result = await getReceiptImageStream(receipt.imageUrl);
  if (!result) {
    res.status(404).json({ error: "Foto non trovata." });
    return;
  }

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  result.stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Errore nel caricamento della foto." });
    } else {
      res.end();
    }
  });
  result.stream.pipe(res);
});

router.get("/accepted-stores", (_req, res): void => {
  res.json(getAcceptedStoresList());
});

export default router;
