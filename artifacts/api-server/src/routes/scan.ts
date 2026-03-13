import { Router, type IRouter } from "express";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { db, usersTable, receiptsTable, barcodeScansTable } from "@workspace/db";
import { ScanReceiptBody } from "@workspace/api-zod";
import { hashImage, extractTextViaGoogleVision, calculateLevel } from "../lib/scanner";
import { runAntiFraudChecks, approvePendingPoints } from "../lib/antiFraud";
import { lookupBarcode } from "../lib/productClassifier";
import { requireUser } from "./profile";

const router: IRouter = Router();

const BARCODE_SESSION_HOURS = 24;

let lastPendingApprovalCheck = 0;

router.post("/scan", async (req, res): Promise<void> => {
  const parsed = ScanReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { imageBase64, storeName, purchaseDate } = parsed.data;
  const imageHash = hashImage(imageBase64);

  const [selfDuplicate] = await db
    .select({ id: receiptsTable.id })
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.userId, user.id),
        eq(receiptsTable.imageHash, imageHash),
      ),
    )
    .limit(1);

  if (selfDuplicate) {
    res.status(400).json({ error: "Hai già scansionato questo scontrino in precedenza. Anti-frode attivo." });
    return;
  }

  const fraudCheck = await runAntiFraudChecks(user, imageHash, purchaseDate, 0);

  if (!fraudCheck.ok) {
    res.status(400).json({ error: fraudCheck.error });
    return;
  }

  const now = new Date();
  const barcodeExpiry = new Date(now.getTime() + BARCODE_SESSION_HOURS * 60 * 60 * 1000);

  let rawText = "";
  const visionText = await extractTextViaGoogleVision(imageBase64);
  if (visionText) rawText = visionText;

  const [receipt] = await db
    .insert(receiptsTable)
    .values({
      userId: user.id,
      storeName: storeName ?? null,
      purchaseDate: purchaseDate ?? null,
      imageHash,
      rawText: rawText || null,
      pointsEarned: 0,
      greenItemsCount: 0,
      categories: [],
      greenItemsJson: "[]",
      status: "approved",
      flagReason: null,
      barcodeExpiry,
    })
    .returning();

  const today = new Date().toDateString();
  const lastScanDate = user.lastScanDate ? new Date(user.lastScanDate).toDateString() : null;
  const newStreak = lastScanDate === today ? user.streak : user.streak + 1;

  await db
    .update(usersTable)
    .set({
      streak: newStreak,
      lastScanDate: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  const now2 = Date.now();
  if (now2 - lastPendingApprovalCheck > 60 * 60 * 1000) {
    lastPendingApprovalCheck = now2;
    approvePendingPoints().catch((e) => console.error("[pending-approval]", e));
  }

  res.json({
    receiptId: receipt.id,
    barcodeExpiry: barcodeExpiry.toISOString(),
    storeName: receipt.storeName,
    message: "Scontrino confermato! Ora scansiona i codici a barre dei prodotti acquistati per guadagnare punti.",
    sessionHours: BARCODE_SESSION_HOURS,
  });
});

async function validateBarcodeRequest(req: any, res: any): Promise<{ user: any; receipt: any; barcode: string; receiptId: number } | null> {
  const { barcode, receiptId } = req.body;

  if (!barcode || typeof barcode !== "string") {
    res.status(400).json({ error: "Codice a barre mancante." });
    return null;
  }
  if (!receiptId || typeof receiptId !== "number") {
    res.status(400).json({ error: "ID scontrino mancante." });
    return null;
  }

  const user = await requireUser(req, res);
  if (!user) return null;

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.id, receiptId),
        eq(receiptsTable.userId, user.id),
      ),
    )
    .limit(1);

  if (!receipt) {
    res.status(404).json({ error: "Scontrino non trovato." });
    return null;
  }

  if (!receipt.barcodeExpiry || new Date() > new Date(receipt.barcodeExpiry)) {
    res.status(400).json({ error: "La sessione di scansione prodotti è scaduta (massimo 24 ore dallo scontrino)." });
    return null;
  }

  const [duplicate] = await db
    .select({ id: barcodeScansTable.id })
    .from(barcodeScansTable)
    .where(
      and(
        eq(barcodeScansTable.receiptId, receiptId),
        eq(barcodeScansTable.barcode, barcode.trim()),
      ),
    )
    .limit(1);

  if (duplicate) {
    res.status(400).json({ error: "Questo prodotto è già stato scansionato per questo scontrino." });
    return null;
  }

  return { user, receipt, barcode: barcode.trim(), receiptId };
}

router.post("/scan/barcode/lookup", async (req, res): Promise<void> => {
  const validated = await validateBarcodeRequest(req, res);
  if (!validated) return;

  const { user, barcode } = validated;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pointsSumRow] = await db
    .select({ total: sql<number>`coalesce(sum(points_earned), 0)::int` })
    .from(barcodeScansTable)
    .where(
      and(
        eq(barcodeScansTable.userId, user.id),
        gte(barcodeScansTable.scannedAt, oneDayAgo),
      ),
    );

  const pointsEarnedToday = pointsSumRow?.total ?? 0;
  const MAX_DAILY_POINTS = 200;
  const remainingCap = MAX_DAILY_POINTS - pointsEarnedToday;

  if (remainingCap <= 0) {
    res.status(400).json({ error: `Hai raggiunto il limite di ${MAX_DAILY_POINTS} punti al giorno. Torna domani!` });
    return;
  }

  const product = await lookupBarcode(barcode);

  if (!product) {
    res.status(404).json({ error: "Prodotto non trovato su Open Food Facts. Verifica che il codice a barre sia leggibile." });
    return;
  }

  const pointsToAward = Math.min(product.points, remainingCap);

  res.json({
    barcode,
    productName: product.productName,
    ecoScore: product.ecoScore,
    pointsToAward,
    category: product.category,
    emoji: product.emoji,
    reasoning: product.reasoning,
    source: product.source,
    remainingDailyPoints: remainingCap,
  });
});

router.post("/scan/barcode/confirm", async (req, res): Promise<void> => {
  const validated = await validateBarcodeRequest(req, res);
  if (!validated) return;

  const { user, barcode, receiptId } = validated;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pointsSumRow] = await db
    .select({ total: sql<number>`coalesce(sum(points_earned), 0)::int` })
    .from(barcodeScansTable)
    .where(
      and(
        eq(barcodeScansTable.userId, user.id),
        gte(barcodeScansTable.scannedAt, oneDayAgo),
      ),
    );

  const pointsEarnedToday = pointsSumRow?.total ?? 0;
  const MAX_DAILY_POINTS = 200;
  const remainingCap = MAX_DAILY_POINTS - pointsEarnedToday;

  if (remainingCap <= 0) {
    res.status(400).json({ error: `Hai raggiunto il limite di ${MAX_DAILY_POINTS} punti al giorno. Torna domani!` });
    return;
  }

  const product = await lookupBarcode(barcode);

  if (!product) {
    res.status(404).json({ error: "Prodotto non trovato. Verifica che il codice a barre sia leggibile." });
    return;
  }

  const finalPoints = Math.min(product.points, remainingCap);

  const txResult = await db.transaction(async (tx) => {
    const [existingDup] = await tx
      .select({ id: barcodeScansTable.id })
      .from(barcodeScansTable)
      .where(
        and(
          eq(barcodeScansTable.receiptId, receiptId),
          eq(barcodeScansTable.barcode, barcode),
        ),
      )
      .limit(1);

    if (existingDup) return { error: "Questo prodotto è già stato scansionato per questo scontrino." };

    const [scan] = await tx
      .insert(barcodeScansTable)
      .values({
        receiptId,
        userId: user.id,
        barcode,
        productName: product.productName,
        ecoScore: product.ecoScore,
        pointsEarned: finalPoints,
        category: product.category,
        emoji: product.emoji,
        reasoning: product.reasoning,
      })
      .returning();

    await tx
      .update(usersTable)
      .set({ totalPoints: sql`total_points + ${finalPoints}` })
      .where(eq(usersTable.id, user.id));

    await tx
      .update(receiptsTable)
      .set({
        pointsEarned: sql`points_earned + ${finalPoints}`,
        greenItemsCount: sql`green_items_count + 1`,
      })
      .where(eq(receiptsTable.id, receiptId));

    const [updatedUser] = await tx
      .select({ totalPoints: usersTable.totalPoints })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    return { scan, updatedUser };
  });

  if ("error" in txResult) {
    res.status(400).json({ error: txResult.error });
    return;
  }

  const { scan, updatedUser } = txResult;
  const level = calculateLevel(updatedUser?.totalPoints ?? 0);

  res.json({
    scanId: scan.id,
    productName: product.productName,
    ecoScore: product.ecoScore,
    pointsEarned: finalPoints,
    category: product.category,
    emoji: product.emoji,
    reasoning: product.reasoning,
    source: product.source,
    totalPoints: updatedUser?.totalPoints ?? 0,
    level: level.level,
    remainingDailyPoints: remainingCap - finalPoints,
  });
});

router.get("/scan/active-session", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const now = new Date();

  const [activeReceipt] = await db
    .select()
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.userId, user.id),
        gte(receiptsTable.barcodeExpiry, now),
      ),
    )
    .orderBy(desc(receiptsTable.scannedAt))
    .limit(1);

  if (!activeReceipt) {
    res.json({ active: false, receipt: null, barcodeScans: [] });
    return;
  }

  const barcodeScans = await db
    .select()
    .from(barcodeScansTable)
    .where(eq(barcodeScansTable.receiptId, activeReceipt.id))
    .orderBy(desc(barcodeScansTable.scannedAt));

  const remainingMs = new Date(activeReceipt.barcodeExpiry!).getTime() - now.getTime();
  const remainingMinutes = Math.max(0, Math.floor(remainingMs / 60000));

  res.json({
    active: true,
    receipt: {
      id: activeReceipt.id,
      storeName: activeReceipt.storeName,
      scannedAt: activeReceipt.scannedAt,
      barcodeExpiry: activeReceipt.barcodeExpiry,
      pointsEarned: activeReceipt.pointsEarned,
      greenItemsCount: activeReceipt.greenItemsCount,
    },
    remainingMinutes,
    barcodeScans: barcodeScans.map((s) => ({
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
