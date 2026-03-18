import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, gt, ne, desc, sql } from "drizzle-orm";
import { db, usersTable, receiptsTable, barcodeScansTable, productCacheTable, userProductSubmissionsTable } from "@workspace/db";
import { ScanReceiptBody } from "@workspace/api-zod";
import { hashImage, extractTextViaGoogleVision, calculateLevel } from "../lib/scanner";
import { XP_TO_LEA_RATE } from "../lib/economy";
import { runAntiFraudChecks, approvePendingPoints, getUserTrustLevel, normalizeDocumentNumber } from "../lib/antiFraud";
import { lookupBarcode, validateReceiptWithAI, classifyProductsBatch, validateBarcodeImage, isValidBarcode, matchProductToReceipt, classifyManualProduct, analyzeEnvironmentContext, type PendingProduct } from "../lib/productClassifier";
import { uploadReceiptImage } from "../lib/receiptImages";
import { matchChain, isAcceptedStore } from "../lib/supermarketWhitelist";
import { requireUser } from "./profile";

const router: IRouter = Router();

const BARCODE_SESSION_HOURS = 48;

let lastPendingApprovalCheck = 0;
let lastFinalizeCheck: Record<number, number> = {};

async function finalizeReceipt(receiptId: number): Promise<void> {
  await db
    .update(receiptsTable)
    .set({ status: "approved" })
    .where(and(eq(receiptsTable.id, receiptId), eq(receiptsTable.status, "pending_barcode")));
}

async function finalizeExpiredReceipts(userId: number): Promise<void> {
  const now = Date.now();
  if ((lastFinalizeCheck[userId] ?? 0) > now - 5 * 60 * 1000) return;
  lastFinalizeCheck[userId] = now;

  const expired = await db
    .select({ id: receiptsTable.id })
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.userId, userId),
        eq(receiptsTable.status, "pending_barcode"),
        sql`${receiptsTable.barcodeExpiry} < ${new Date()}`,
      ),
    );

  for (const r of expired) {
    await finalizeReceipt(r.id);
  }
}

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
    .select({ id: receiptsTable.id, pointsEarned: receiptsTable.pointsEarned, greenItemsCount: receiptsTable.greenItemsCount, status: receiptsTable.status })
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.userId, user.id),
        eq(receiptsTable.imageHash, imageHash),
        ne(receiptsTable.status, "cancelled"),
      ),
    )
    .limit(1);

  if (selfDuplicate && (selfDuplicate.pointsEarned > 0 || selfDuplicate.status === "pending_barcode")) {
    const msg = selfDuplicate.status === "pending_barcode"
      ? "Questo scontrino è già stato registrato. Vai nello storico per continuare la verifica dei prodotti."
      : "Questo scontrino è già stato scansionato.";
    res.status(400).json({ error: msg });
    return;
  }

  const validation = await validateReceiptWithAI(imageBase64);

  if (!validation.valid) {
    res.status(400).json({ error: "Non sembra uno scontrino. Riprova." });
    return;
  }

  const fallbackDate = new Date().toISOString().slice(0, 10);
  const effectiveDate = validation.date ?? fallbackDate;
  const effectiveTotal: number | null = validation.totalCents ?? null;

  if (!validation.complete) {
    console.log(`[scan] Receipt accepted with fallbacks — date: ${validation.date ?? `null→${fallbackDate}`}, total: ${validation.totalCents ?? "null"}`);
  }

  const resolvedChain = matchChain(validation.storeChain) ?? matchChain(validation.store);
  if (!isAcceptedStore(resolvedChain)) {
    console.log(`[scan] Store matching failed: storeChain="${validation.storeChain}", store="${validation.store}", resolvedChain="${resolvedChain}"`);
    res.status(400).json({
      error: "Scontrino non accettato — Leafy funziona con i principali supermercati italiani. Controlla la lista dei negozi accettati nella schermata Scansiona.",
    });
    return;
  }
  if (resolvedChain) {
    console.log(`[scan] Store matched: ${resolvedChain}`);
  }

  if (validation.date && validation.totalCents !== null) {
    const dupConditions = [
      eq(receiptsTable.userId, user.id),
      eq(receiptsTable.receiptDate, validation.date!),
      eq(receiptsTable.receiptTotal, validation.totalCents!),
      sql`(${receiptsTable.pointsEarned} > 0 OR ${receiptsTable.status} = 'pending_barcode')`,
      ne(receiptsTable.status, "cancelled"),
    ];
    if (validation.store) {
      dupConditions.push(
        sql`lower(trim(coalesce(${receiptsTable.storeName}, ''))) = ${validation.store.toLowerCase().trim()}`
      );
    }
    if (selfDuplicate) {
      dupConditions.push(ne(receiptsTable.id, selfDuplicate.id));
    }

    const [semanticDuplicate] = await db
      .select({ id: receiptsTable.id })
      .from(receiptsTable)
      .where(and(...dupConditions))
      .limit(1);

    if (semanticDuplicate) {
      res.status(400).json({ error: "Questo scontrino è già stato scansionato." });
      return;
    }
  }

  // ── Document number cross-user watermark check ────────────────────────────
  const normalizedDocNumber = validation.documentNumber ? normalizeDocumentNumber(validation.documentNumber) : null;
  // Require at least 5 chars after normalization to avoid accidental collision
  // on short/common OCR tokens (e.g. "1", "N/A", "42")
  if (normalizedDocNumber && normalizedDocNumber.length >= 5) {
    const [docDuplicate] = await db
      .select({ id: receiptsTable.id, userId: receiptsTable.userId })
      .from(receiptsTable)
      .where(
        and(
          eq(receiptsTable.documentNumber, normalizedDocNumber),
          ne(receiptsTable.userId, user.id),
        ),
      )
      .limit(1);

    if (docDuplicate) {
      return void res.status(400).json({
        error: "Questo scontrino è già stato scansionato da un altro utente. Anti-frode attivo.",
      });
    }
  }

  const now = new Date();
  const barcodeExpiry = new Date(now.getTime() + BARCODE_SESSION_HOURS * 60 * 60 * 1000);

  const RECEIPT_SCAN_BONUS = 5;
  const WELCOME_BONUS = 100;

  let receipt: typeof receiptsTable.$inferSelect;
  let welcomeBonus = false;
  let receiptBonusAwarded = false;

  if (selfDuplicate) {
    const [existing] = await db
      .select()
      .from(receiptsTable)
      .where(eq(receiptsTable.id, selfDuplicate.id))
      .limit(1);
    if (!existing) {
      res.status(400).json({ error: "Questo scontrino è già stato scansionato." });
      return;
    }
    receipt = existing;
  } else {
    const fraudCheck = await runAntiFraudChecks(user, imageHash, purchaseDate, 0);
    if (!fraudCheck.ok) {
      res.status(400).json({ error: fraudCheck.error });
      return;
    }

    let rawText = "";
    const visionText = await extractTextViaGoogleVision(imageBase64);
    if (visionText) rawText = visionText;

    const [newReceipt] = await db
      .insert(receiptsTable)
      .values({
        userId: user.id,
        storeName: validation.store ?? storeName ?? null,
        purchaseDate: purchaseDate instanceof Date ? purchaseDate.toISOString() : null,
        imageHash,
        rawText: rawText || null,
        pointsEarned: 0,
        greenItemsCount: 0,
        categories: [],
        greenItemsJson: "[]",
        status: "pending_barcode",
        flagReason: null,
        barcodeExpiry,
        barcodeMode: 1,
        receiptDate: effectiveDate,
        receiptTotal: effectiveTotal,
        storeChain: resolvedChain,
        province: validation.province ?? null,
        documentNumber: normalizedDocNumber,
      })
      .returning();
    receipt = newReceipt;

    try {
      const { imageUrl, imageExpiresAt } = await uploadReceiptImage(user.id, newReceipt.id, imageBase64);
      await db
        .update(receiptsTable)
        .set({ imageUrl, imageExpiresAt })
        .where(eq(receiptsTable.id, newReceipt.id));
    } catch (e) {
      console.error("[receipt-image] Upload failed:", e);
    }

    const [receiptCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(receiptsTable)
      .where(eq(receiptsTable.userId, user.id));
    const totalReceiptsNow = receiptCountRow?.count ?? 1;
    welcomeBonus = totalReceiptsNow === 1;
    receiptBonusAwarded = true;

    const bonusTotal = RECEIPT_SCAN_BONUS + (welcomeBonus ? WELCOME_BONUS : 0);
    const leaMultiplier = user.hasBattlePass ? 2 : 1;
    const bonusLeaDelta = Math.round(bonusTotal * XP_TO_LEA_RATE * leaMultiplier * 100) / 100;
    await db
      .update(usersTable)
      .set({
        totalPoints: sql`total_points + ${bonusTotal}`,
        xp: sql`xp + ${bonusTotal}`,
        leaBalance: sql`lea_balance + ${bonusLeaDelta}`,
      })
      .where(eq(usersTable.id, user.id));
    await db
      .update(receiptsTable)
      .set({ pointsEarned: sql`points_earned + ${RECEIPT_SCAN_BONUS}` })
      .where(eq(receiptsTable.id, newReceipt.id));
  }

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

  const productNames = validation.products.length > 0 ? validation.products : [];
  const pendingProducts: PendingProduct[] = productNames.map((name) => ({
    name,
    matched: false,
    barcode: null,
    ecoScore: null,
    points: 0,
    emoji: null,
    category: null,
  }));

  if (pendingProducts.length > 0) {
    await db
      .update(receiptsTable)
      .set({
        greenItemsCount: pendingProducts.length,
        greenItemsJson: JSON.stringify(pendingProducts),
      })
      .where(eq(receiptsTable.id, receipt.id));
  }

  finalizeExpiredReceipts(user.id).catch((e) => console.error("[finalize-expired]", e));

  const now2 = Date.now();
  if (now2 - lastPendingApprovalCheck > 60 * 60 * 1000) {
    lastPendingApprovalCheck = now2;
    approvePendingPoints().catch((e) => console.error("[pending-approval]", e));
  }

  const message = pendingProducts.length > 0
    ? `${pendingProducts.length} prodott${pendingProducts.length === 1 ? "o" : "i"} trovat${pendingProducts.length === 1 ? "o" : "i"} — scansiona i barcode per guadagnare XP!`
    : "Scontrino registrato. Scansiona i codici a barre dei tuoi prodotti per guadagnare XP.";

  const [refreshedUser] = await db.select({ xp: usersTable.xp, leaBalance: usersTable.leaBalance }).from(usersTable).where(eq(usersTable.id, user.id));

  const totalXpEarned = receiptBonusAwarded ? (RECEIPT_SCAN_BONUS + (welcomeBonus ? WELCOME_BONUS : 0)) : 0;
  const leaMultiplierResp = user.hasBattlePass ? 2 : 1;
  const totalLeaEarned = Math.round(totalXpEarned * XP_TO_LEA_RATE * leaMultiplierResp * 100) / 100;

  res.json({
    receiptId: receipt.id,
    barcodeExpiry: barcodeExpiry.toISOString(),
    storeName: receipt.storeName,
    message,
    sessionHours: BARCODE_SESSION_HOURS,
    pointsEarned: receiptBonusAwarded ? RECEIPT_SCAN_BONUS : 0,
    receiptBonusPts: receiptBonusAwarded ? RECEIPT_SCAN_BONUS : 0,
    welcomeBonus,
    welcomeBonusPts: welcomeBonus ? WELCOME_BONUS : 0,
    xpEarned: totalXpEarned,
    leaEarned: totalLeaEarned,
    xp: refreshedUser?.xp ?? 0,
    leaBalance: parseFloat(String(refreshedUser?.leaBalance ?? "0")),
    greenItemsFound: pendingProducts.map((p) => ({
      name: p.name,
      matched: false,
      barcode: null,
      ecoScore: null,
      points: 0,
      emoji: null,
      category: null,
    })),
    leveledUp: false,
    newLevel: null,
    badges: [] as Array<{ name: string; emoji: string }>,
    challengesUpdated: [] as string[],
  });
});

type UserRow = typeof usersTable.$inferSelect;
type ReceiptRow = typeof receiptsTable.$inferSelect;

const MAX_BARCODE_IMAGE_SIZE = 500_000;

async function validateBarcodeRequest(req: Request, res: Response): Promise<{ user: UserRow; receipt: ReceiptRow; barcode: string; receiptId: number } | null> {
  const { barcode, receiptId } = req.body;

  if (!barcode || typeof barcode !== "string") {
    res.status(400).json({ error: "Codice a barre mancante." });
    return null;
  }

  const cleanedBarcode = barcode.trim().replace(/[^0-9]/g, "");
  if (!isValidBarcode(cleanedBarcode)) {
    res.status(400).json({ error: "Codice a barre non valido. Verifica che sia un codice EAN/UPC corretto." });
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
    res.status(400).json({ error: "La sessione di scansione prodotti è scaduta (massimo 48 ore dallo scontrino)." });
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

const MAX_DAILY_POINTS = 200;
const MAX_RECEIPT_POINTS = 150;

router.post("/scan/barcode/lookup", async (req, res): Promise<void> => {
  const validated = await validateBarcodeRequest(req, res);
  if (!validated) return;

  const { user, barcode, receiptId } = validated;
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (imageBase64 && typeof imageBase64 === "string" && imageBase64.length > 100 && imageBase64.length <= MAX_BARCODE_IMAGE_SIZE) {
    const validation = await validateBarcodeImage(imageBase64);
    if (!validation.legitimate && validation.confidence >= 0.7) {
      console.log(`[anti-fraud] Barcode image rejected for user ${user.id}: ${validation.reason}`);
      res.status(400).json({
        error: "Inquadra un prodotto reale — sembra che tu stia fotografando uno schermo o un'immagine stampata.",
        fraudDetected: true,
      });
      return;
    }
  }

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
  const remainingDailyCap = MAX_DAILY_POINTS - pointsEarnedToday;

  if (remainingDailyCap <= 0) {
    res.status(400).json({ error: `Hai raggiunto il limite di ${MAX_DAILY_POINTS} XP al giorno. Torna domani!` });
    return;
  }

  const [receiptPtsSumRow] = await db
    .select({ total: sql<number>`coalesce(sum(points_earned), 0)::int` })
    .from(barcodeScansTable)
    .where(eq(barcodeScansTable.receiptId, receiptId));
  const pointsEarnedThisReceipt = receiptPtsSumRow?.total ?? 0;
  const remainingReceiptCap = MAX_RECEIPT_POINTS - pointsEarnedThisReceipt;

  if (remainingReceiptCap <= 0) {
    res.status(400).json({
      error: `Hai raggiunto il limite di ${MAX_RECEIPT_POINTS} XP per questo scontrino. Ottimo lavoro! 🌿`,
      receiptCapReached: true,
    });
    return;
  }

  const validImage = imageBase64 && typeof imageBase64 === "string" && imageBase64.length > 100 && imageBase64.length <= MAX_BARCODE_IMAGE_SIZE ? imageBase64 : undefined;
  const product = await lookupBarcode(barcode, validImage);

  if (!product) {
    res.status(404).json({ error: "Impossibile classificare questo prodotto. Riprova o inserisci il codice manualmente." });
    return;
  }

  const effectiveCap = Math.min(remainingDailyCap, remainingReceiptCap);
  const pointsToAward = Math.min(product.points, effectiveCap);

  res.json({
    barcode,
    productName: product.productName,
    ecoScore: product.ecoScore,
    pointsToAward,
    category: product.category,
    emoji: product.emoji,
    reasoning: product.reasoning,
    source: product.source,
    remainingDailyPoints: remainingDailyCap,
    remainingReceiptPoints: remainingReceiptCap,
    receiptCapPts: MAX_RECEIPT_POINTS,
    dailyCapPts: MAX_DAILY_POINTS,
  });
});

router.post("/scan/barcode/preview", async (req, res): Promise<void> => {
  const { barcode, imageBase64 } = req.body as { barcode?: string; imageBase64?: string };

  if (!barcode || typeof barcode !== "string") {
    res.status(400).json({ error: "Codice a barre mancante." });
    return;
  }

  const cleanedBarcode = barcode.trim().replace(/[^0-9]/g, "");
  if (!isValidBarcode(cleanedBarcode)) {
    res.status(400).json({ error: "Codice a barre non valido. Verifica che sia un codice EAN/UPC corretto." });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  if (imageBase64 && typeof imageBase64 === "string" && imageBase64.length > 100 && imageBase64.length <= MAX_BARCODE_IMAGE_SIZE) {
    const validation = await validateBarcodeImage(imageBase64);
    if (!validation.legitimate && validation.confidence >= 0.7) {
      console.log(`[anti-fraud] Shopping scan image rejected for user ${user.id}: ${validation.reason}`);
      res.status(400).json({
        error: "Inquadra un prodotto reale — sembra che tu stia fotografando uno schermo o un'immagine stampata.",
        fraudDetected: true,
      });
      return;
    }
  }

  const validImage = imageBase64 && typeof imageBase64 === "string" && imageBase64.length > 100 && imageBase64.length <= MAX_BARCODE_IMAGE_SIZE ? imageBase64 : undefined;
  const product = await lookupBarcode(barcode.trim(), validImage);

  if (!product) {
    res.status(404).json({ error: "Impossibile classificare questo prodotto. Riprova o inserisci il codice manualmente." });
    return;
  }

  res.json({
    barcode: barcode.trim(),
    productName: product.productName,
    ecoScore: product.ecoScore,
    pointsEstimate: product.points,
    category: product.category,
    emoji: product.emoji,
    reasoning: product.reasoning,
    source: product.source,
    found: true,
  });
});

router.post("/scan/barcode/manual-classify", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { barcode, receiptId: receiptIdRaw, name, weightValue, weightUnit, frontImageBase64, backImageBase64 } = req.body as {
    barcode?: string;
    receiptId?: string | number;
    name?: string;
    weightValue?: number;
    weightUnit?: string;
    frontImageBase64?: string;
    backImageBase64?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Nome prodotto obbligatorio (minimo 2 caratteri)." });
    return;
  }
  if (typeof weightValue !== "number" || weightValue <= 0 || weightValue > 100000) {
    res.status(400).json({ error: "Peso non valido. Inserisci un valore tra 1 e 100000." });
    return;
  }
  if (!["g", "kg"].includes(weightUnit ?? "")) {
    res.status(400).json({ error: "Unità di peso non valida. Usa 'g' o 'kg'." });
    return;
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [pointsSumRow] = await db
    .select({ total: sql<number>`coalesce(sum(points_earned), 0)::int` })
    .from(barcodeScansTable)
    .where(and(eq(barcodeScansTable.userId, user.id), gte(barcodeScansTable.scannedAt, oneDayAgo)));
  const pointsEarnedToday = pointsSumRow?.total ?? 0;
  const remainingDailyCap = MAX_DAILY_POINTS - pointsEarnedToday;

  if (remainingDailyCap <= 0) {
    res.status(400).json({ error: `Hai raggiunto il limite di ${MAX_DAILY_POINTS} XP al giorno. Torna domani!` });
    return;
  }

  const receiptIdParsed = typeof receiptIdRaw === "number" ? receiptIdRaw : parseInt(String(receiptIdRaw ?? "0"), 10);
  let remainingReceiptCap = MAX_RECEIPT_POINTS;
  if (receiptIdParsed && !isNaN(receiptIdParsed)) {
    const [receiptPtsSumRow] = await db
      .select({ total: sql<number>`coalesce(sum(points_earned), 0)::int` })
      .from(barcodeScansTable)
      .where(eq(barcodeScansTable.receiptId, receiptIdParsed));
    remainingReceiptCap = MAX_RECEIPT_POINTS - (receiptPtsSumRow?.total ?? 0);
  }

  const effectiveCap = Math.min(remainingDailyCap, remainingReceiptCap);

  if (effectiveCap <= 0) {
    res.status(400).json({
      error: remainingReceiptCap <= 0
        ? `Hai raggiunto il limite di ${MAX_RECEIPT_POINTS} XP per questo scontrino.`
        : `Hai raggiunto il limite di ${MAX_DAILY_POINTS} XP al giorno. Torna domani!`,
    });
    return;
  }

  const cleanBarcode = (barcode ?? "").trim().replace(/[^0-9]/g, "") || `manual_${user.id}_${Date.now()}`;

  if (cleanBarcode && cleanBarcode.startsWith("manual") === false) {
    await db.delete(productCacheTable).where(eq(productCacheTable.productNameNormalized, `barcode:${cleanBarcode}`));
  }

  const result = await classifyManualProduct(
    cleanBarcode,
    name.trim(),
    weightValue,
    weightUnit as "g" | "kg",
    frontImageBase64 && typeof frontImageBase64 === "string" && frontImageBase64.length > 100 ? frontImageBase64 : undefined,
    backImageBase64 && typeof backImageBase64 === "string" && backImageBase64.length > 100 ? backImageBase64 : undefined,
  );

  await db.insert(productCacheTable).values({
    productNameNormalized: `barcode:${cleanBarcode}`,
    productNameOriginal: result.productName,
    ecoScore: result.ecoScore,
    points: result.points,
    category: result.category,
    source: result.source,
    reasoning: result.reasoning,
    emoji: result.emoji,
    co2PerUnit: 0.1,
  }).onConflictDoNothing();

  await db.insert(userProductSubmissionsTable).values({
    userId: user.id,
    barcode: cleanBarcode.startsWith("manual_") ? null : cleanBarcode,
    productName: result.productName,
    weightValue: String(weightValue),
    weightUnit: (weightUnit as string) ?? "g",
    ecoScore: result.ecoScore,
    pointsAwarded: Math.min(result.points, effectiveCap),
    classifiedByAI: true,
  }).onConflictDoNothing();

  res.json({
    barcode: cleanBarcode,
    productName: result.productName,
    ecoScore: result.ecoScore,
    pointsToAward: Math.min(result.points, effectiveCap),
    category: result.category,
    emoji: result.emoji,
    reasoning: result.reasoning,
    source: result.source,
    remainingDailyPoints: remainingDailyCap,
    remainingReceiptPoints: remainingReceiptCap,
    receiptCapPts: MAX_RECEIPT_POINTS,
    dailyCapPts: MAX_DAILY_POINTS,
    isManual: true,
  });
});

router.post("/scan/barcode/confirm", async (req, res): Promise<void> => {
  const validated = await validateBarcodeRequest(req, res);
  if (!validated) return;

  const { user, receipt, barcode, receiptId } = validated;

  // ── AI Environment Background Check (silent, risk-based) ─────────────────
  const { contextImageBase64 } = req.body;
  const trustLevel = await getUserTrustLevel(user);
  const MAX_IMAGE_B64_LEN = 2_800_000; // ~2 MB
  const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;
  const hasImage =
    typeof contextImageBase64 === "string" &&
    contextImageBase64.length > 100 &&
    contextImageBase64.length <= MAX_IMAGE_B64_LEN &&
    BASE64_RE.test(contextImageBase64.slice(0, 64));

  if (trustLevel === "strict" && !hasImage) {
    // Strict users must provide a context frame captured by the mobile app.
    // Absence of the image on a strict account indicates a scripted/non-app call.
    console.log(JSON.stringify({ event: "env_check", outcome: "blocked_no_image", userId: user.id, trustLevel }));
    res.status(400).json({ error: "Impossibile convalidare questa scansione. Assicurati di usare l'app aggiornata." });
    return;
  }

  if (hasImage) {
    const shouldCheck =
      trustLevel === "strict" ||
      (trustLevel === "moderate" && Math.random() < 0.3);

    if (!shouldCheck) {
      console.log(JSON.stringify({ event: "env_check", outcome: "skipped", userId: user.id, trustLevel }));
    } else {
      try {
        const envResult = await analyzeEnvironmentContext(contextImageBase64!);
        if (envResult.environment === "store" && envResult.confidence > 0.75) {
          console.log(JSON.stringify({ event: "env_check", outcome: "blocked_store", userId: user.id, trustLevel, env: envResult.environment, confidence: envResult.confidence }));
          res.status(400).json({ error: "Impossibile convalidare questa scansione. Assicurati di essere in un ambiente idoneo." });
          return;
        }
        console.log(JSON.stringify({ event: "env_check", outcome: "passed", userId: user.id, trustLevel, env: envResult.environment, confidence: envResult.confidence }));
      } catch (err) {
        // Never block on AI error — fail open
        console.log(JSON.stringify({ event: "env_check", outcome: "ai_error_fail_open", userId: user.id, trustLevel, error: String(err) }));
      }
    }
  } else {
    // trusted or moderate without image — no check needed
    console.log(JSON.stringify({ event: "env_check", outcome: "no_image_skipped", userId: user.id, trustLevel }));
  }

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
  const remainingDailyCap = MAX_DAILY_POINTS - pointsEarnedToday;

  if (remainingDailyCap <= 0) {
    res.status(400).json({ error: `Hai raggiunto il limite di ${MAX_DAILY_POINTS} XP al giorno. Torna domani!` });
    return;
  }

  const [receiptPtsSumRow] = await db
    .select({ total: sql<number>`coalesce(sum(points_earned), 0)::int` })
    .from(barcodeScansTable)
    .where(eq(barcodeScansTable.receiptId, receiptId));
  const pointsEarnedThisReceipt = receiptPtsSumRow?.total ?? 0;
  const remainingReceiptCap = MAX_RECEIPT_POINTS - pointsEarnedThisReceipt;

  if (remainingReceiptCap <= 0) {
    res.status(400).json({
      error: `Hai raggiunto il limite di ${MAX_RECEIPT_POINTS} XP per questo scontrino. Ottimo lavoro! 🌿`,
      receiptCapReached: true,
    });
    return;
  }

  const product = await lookupBarcode(barcode);

  if (!product) {
    res.status(404).json({ error: "Impossibile classificare questo prodotto. Riprova." });
    return;
  }

  let matchedProductName: string | null = null;

  if (receipt.status === "pending_barcode") {
    let pendingProducts: PendingProduct[] = [];
    try { pendingProducts = JSON.parse(receipt.greenItemsJson ?? "[]"); } catch {}

    if (pendingProducts.length > 0) {
      const matchResult = await matchProductToReceipt(product.productName, pendingProducts);
      if (!matchResult.matched) {
        res.status(400).json({
          error: "Questo prodotto non sembra essere nel tuo scontrino. Verifica di stare scansionando un prodotto che hai acquistato.",
          notInReceipt: true,
        });
        return;
      }
      matchedProductName = matchResult.productName;
    }
  }

  const effectiveCap = Math.min(remainingDailyCap, remainingReceiptCap);
  const finalPoints = Math.min(product.points, effectiveCap);

  const SCONTRINO_VIRTUOSO_BONUS = 20;
  const SCONTRINO_VIRTUOSO_THRESHOLD = 3;
  const isGreenProduct = (product.points ?? 0) >= 10;

  const [greenCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(barcodeScansTable)
    .where(and(
      eq(barcodeScansTable.receiptId, receiptId),
      gte(barcodeScansTable.pointsEarned, 10),
    ));
  const greenCountBefore = greenCountRow?.count ?? 0;
  const willTriggerVirtuoso = isGreenProduct && greenCountBefore === SCONTRINO_VIRTUOSO_THRESHOLD - 1;
  const virtuosoAlreadyGiven = greenCountBefore >= SCONTRINO_VIRTUOSO_THRESHOLD;

  const bonusVirtuosoPoints = (willTriggerVirtuoso && !virtuosoAlreadyGiven) ? SCONTRINO_VIRTUOSO_BONUS : 0;

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

    const totalPointsDelta = finalPoints + bonusVirtuosoPoints;
    const leaMultiplierBarcode = user.hasBattlePass ? 2 : 1;
    const leaDelta = Math.round(totalPointsDelta * XP_TO_LEA_RATE * leaMultiplierBarcode * 100) / 100;
    await tx
      .update(usersTable)
      .set({
        totalPoints: sql`total_points + ${totalPointsDelta}`,
        xp: sql`xp + ${totalPointsDelta}`,
        leaBalance: sql`lea_balance + ${leaDelta}`,
      })
      .where(eq(usersTable.id, user.id));

    let updatedGreenItemsJson = receipt.greenItemsJson;
    if (matchedProductName) {
      let items: PendingProduct[] = [];
      try { items = JSON.parse(receipt.greenItemsJson ?? "[]"); } catch {}
      const updatedItems = items.map((item) =>
        item.name === matchedProductName
          ? { ...item, matched: true, barcode, ecoScore: product.ecoScore, points: finalPoints, emoji: product.emoji, category: product.category }
          : item,
      );
      updatedGreenItemsJson = JSON.stringify(updatedItems);
    }

    const newCategories = [...new Set([...(receipt.categories ?? []), product.category])];

    await tx
      .update(receiptsTable)
      .set({
        pointsEarned: sql`points_earned + ${finalPoints + bonusVirtuosoPoints}`,
        greenItemsCount: sql`green_items_count + 1`,
        categories: newCategories,
        greenItemsJson: updatedGreenItemsJson,
      })
      .where(eq(receiptsTable.id, receiptId));

    const [updatedUser] = await tx
      .select({ totalPoints: usersTable.totalPoints, xp: usersTable.xp, leaBalance: usersTable.leaBalance })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    return { scan, updatedUser, updatedGreenItemsJson };
  }).catch((err: Error & { code?: string }) => {
    if (err.code === "23505") {
      return { error: "Questo prodotto è già stato scansionato per questo scontrino." } as const;
    }
    throw err;
  });

  if ("error" in txResult) {
    res.status(400).json({ error: txResult.error });
    return;
  }

  const { scan, updatedUser, updatedGreenItemsJson } = txResult;

  if (receipt.status === "pending_barcode") {
    let updatedItems: PendingProduct[] = [];
    try { updatedItems = JSON.parse(updatedGreenItemsJson ?? "[]"); } catch {}
    const allMatched = updatedItems.length > 0 && updatedItems.every((p) => p.matched);
    if (allMatched) {
      finalizeReceipt(receiptId).catch((e) => console.error("[finalize-receipt]", e));
    }
  }

  const userXp = updatedUser?.xp ?? updatedUser?.totalPoints ?? 0;
  const userLeaBalance = parseFloat(String(updatedUser?.leaBalance ?? "0"));
  const level = calculateLevel(userXp);

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
    xp: userXp,
    leaBalance: userLeaBalance,
    level: level.level,
    remainingDailyPoints: remainingDailyCap - finalPoints,
    remainingReceiptPoints: remainingReceiptCap - finalPoints,
    receiptCapPts: MAX_RECEIPT_POINTS,
    dailyCapPts: MAX_DAILY_POINTS,
    bonusVirtuoso: bonusVirtuosoPoints > 0,
    bonusVirtuosoPts: bonusVirtuosoPoints,
  });
});

router.get("/scan/active-session", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  finalizeExpiredReceipts(user.id).catch((e) => console.error("[finalize-expired]", e));

  const now = new Date();

  const [activeReceipt] = await db
    .select()
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.userId, user.id),
        eq(receiptsTable.status, "pending_barcode"),
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

  let greenItems: PendingProduct[] = [];
  try { greenItems = JSON.parse(activeReceipt.greenItemsJson ?? "[]"); } catch {}

  res.json({
    active: true,
    receipt: {
      id: activeReceipt.id,
      storeName: activeReceipt.storeName,
      scannedAt: activeReceipt.scannedAt,
      barcodeExpiry: activeReceipt.barcodeExpiry,
      pointsEarned: activeReceipt.pointsEarned,
      greenItemsCount: activeReceipt.greenItemsCount,
      greenItems,
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

router.post("/scan/products/correct", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { receiptId, originalName, correctedName } = req.body as {
    receiptId?: number;
    originalName?: string;
    correctedName?: string;
  };

  if (!receiptId || !originalName?.trim() || !correctedName?.trim()) {
    res.status(400).json({ error: "receiptId, originalName e correctedName sono obbligatori" });
    return;
  }

  const trimmedCorrection = correctedName.trim();

  const [receipt] = await db
    .select()
    .from(receiptsTable)
    .where(and(eq(receiptsTable.id, receiptId), eq(receiptsTable.userId, user.id)))
    .limit(1);

  if (!receipt) {
    res.status(404).json({ error: "Scontrino non trovato" });
    return;
  }

  const normalizeProductName = (name: string) =>
    name.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9àèéìòù ]/g, "");

  const normalizedOld = normalizeProductName(originalName.trim());
  await db.delete(productCacheTable).where(eq(productCacheTable.productNameNormalized, normalizedOld));

  const classified = await classifyProductsBatch([trimmedCorrection]);
  const newItem = classified[0] ?? { name: trimmedCorrection, category: "Altro", points: 5, emoji: "🌿" };

  let greenItems: Array<{ name: string; category: string; points: number; emoji: string }> = [];
  try { greenItems = JSON.parse(receipt.greenItemsJson ?? "[]"); } catch {}

  const updatedItems = greenItems.map((item) =>
    item.name === originalName.trim()
      ? { ...item, name: newItem.name, category: newItem.category, points: newItem.points, emoji: newItem.emoji }
      : item
  );

  await db
    .update(receiptsTable)
    .set({ greenItemsJson: JSON.stringify(updatedItems) })
    .where(eq(receiptsTable.id, receiptId));

  res.json({ success: true, item: newItem });
});

router.post("/scan/cancel-session", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const activeReceipt = await db
    .select()
    .from(receiptsTable)
    .where(and(eq(receiptsTable.userId, user.id), eq(receiptsTable.status, "pending_barcode")))
    .orderBy(desc(receiptsTable.scannedAt))
    .limit(1);

  if (activeReceipt.length === 0) {
    res.json({ success: true, message: "Nessuna sessione attiva" });
    return;
  }

  await db
    .update(receiptsTable)
    .set({ status: "approved" })
    .where(eq(receiptsTable.id, activeReceipt[0].id));

  res.json({ success: true, message: "Sessione cancellata" });
});

export default router;
