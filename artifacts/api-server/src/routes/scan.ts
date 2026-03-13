import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, receiptsTable, challengeProgressTable, challengesTable } from "@workspace/db";
import { ScanReceiptBody, ScanReceiptResponse } from "@workspace/api-zod";
import { parseReceiptText, hashImage, extractTextViaGoogleVision, calculateLevel } from "../lib/scanner";
import { runAntiFraudChecks, approvePendingPoints } from "../lib/antiFraud";
import { requireUser } from "./profile";

const router: IRouter = Router();

const DEMO_TEXT = `
Prodotti Bio Biologici
Latte Biologico Biologica 1,29
Pomodori Pelati Bio 0,89
Pane Integrale Artigianale 2,10
Mele Bio kg 0 Km 0 1,45
Sapone Senza Plastica 3,20
Caffè Fairtrade Equo Solidale 4,50
Yogurt Vegano plant based 2,30
Pecorino DOP 5,60
`;

let lastPendingApprovalCheck = 0;

router.post("/scan", async (req, res): Promise<void> => {
  const parsed = ScanReceiptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const { imageBase64, storeName, purchaseDate, rawText } = parsed.data;

  const imageHash = hashImage(imageBase64);

  // ── Exact duplicate check (same user) ────────────────────────────────────
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

  // ── OCR / text extraction ────────────────────────────────────────────────
  let textToAnalyze = rawText || "";
  if (!textToAnalyze) {
    const visionText = await extractTextViaGoogleVision(imageBase64);
    if (visionText) {
      textToAnalyze = visionText;
    } else {
      textToAnalyze = DEMO_TEXT + " " + (storeName || "");
    }
  }

  const foundItems = parseReceiptText(textToAnalyze);
  const rawPoints = foundItems.reduce((sum, item) => sum + item.points, 0);

  // ── Anti-fraud multi-layer checks ────────────────────────────────────────
  const fraudCheck = await runAntiFraudChecks(user, imageHash, purchaseDate, rawPoints);

  if (!fraudCheck.ok) {
    res.status(400).json({ error: fraudCheck.error });
    return;
  }

  const { points: totalPoints, status, flagReason, warnings } = fraudCheck;
  const categories = [...new Set(foundItems.map((i) => i.category))];
  const oldLevel = calculateLevel(user.totalPoints).level;

  // ── Save receipt ─────────────────────────────────────────────────────────
  const [receipt] = await db
    .insert(receiptsTable)
    .values({
      userId: user.id,
      storeName: storeName ?? null,
      purchaseDate: purchaseDate ?? null,
      imageHash,
      rawText: textToAnalyze,
      pointsEarned: totalPoints,
      greenItemsCount: foundItems.length,
      categories,
      greenItemsJson: JSON.stringify(foundItems),
      status,
      flagReason: flagReason ?? null,
    })
    .returning();

  // ── Update user points ───────────────────────────────────────────────────
  const today = new Date().toDateString();
  const lastScanDate = user.lastScanDate ? new Date(user.lastScanDate).toDateString() : null;
  const newStreak = lastScanDate === today ? user.streak : user.streak + 1;

  let newTotalPoints = user.totalPoints;
  let newPendingPoints = user.pendingPoints ?? 0;

  if (status === "approved") {
    newTotalPoints += totalPoints;
  } else {
    newPendingPoints += totalPoints;
  }

  await db
    .update(usersTable)
    .set({
      totalPoints: newTotalPoints,
      pendingPoints: newPendingPoints,
      streak: newStreak,
      lastScanDate: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  // ── Challenge progress (only for approved receipts) ──────────────────────
  const updatedChallengeNames: string[] = [];

  if (status === "approved") {
    const activeChallenges = await db
      .select()
      .from(challengesTable)
      .where(eq(challengesTable.isActive, true));

    for (const challenge of activeChallenges) {
      const relevantItems = foundItems.filter(
        (item) => challenge.category === "tutti" || item.category === challenge.category,
      );
      if (relevantItems.length === 0) continue;

      const [existing] = await db
        .select()
        .from(challengeProgressTable)
        .where(
          and(
            eq(challengeProgressTable.userId, user.id),
            eq(challengeProgressTable.challengeId, challenge.id),
          ),
        );

      const increment = relevantItems.length;

      if (!existing) {
        await db.insert(challengeProgressTable).values({
          userId: user.id,
          challengeId: challenge.id,
          currentCount: increment,
          isCompleted: increment >= challenge.targetCount,
          completedAt: increment >= challenge.targetCount ? new Date() : null,
        });
      } else if (!existing.isCompleted) {
        const newCount = existing.currentCount + increment;
        const completed = newCount >= challenge.targetCount;
        await db
          .update(challengeProgressTable)
          .set({
            currentCount: newCount,
            isCompleted: completed,
            completedAt: completed ? new Date() : null,
          })
          .where(eq(challengeProgressTable.id, existing.id));

        if (completed) {
          await db
            .update(usersTable)
            .set({ totalPoints: newTotalPoints + challenge.rewardPoints })
            .where(eq(usersTable.id, user.id));
          newTotalPoints += challenge.rewardPoints;
          updatedChallengeNames.push(challenge.title);
        }
      }
    }
  }

  // ── Badges ───────────────────────────────────────────────────────────────
  const newBadges = [];
  const allUserReceipts = await db
    .select({ id: receiptsTable.id })
    .from(receiptsTable)
    .where(eq(receiptsTable.userId, user.id));

  if (allUserReceipts.length === 1) {
    newBadges.push({
      id: "first_scan",
      name: "Prima Scansione",
      emoji: "🌟",
      category: "Bio",
      earnedAt: new Date(),
    });
  }

  // ── Level up ─────────────────────────────────────────────────────────────
  const newLevel = calculateLevel(newTotalPoints).level;
  const leveledUp = newLevel !== oldLevel;

  // ── Message ──────────────────────────────────────────────────────────────
  let message: string;
  if (status === "pending") {
    message = `Scontrino ricevuto! ${totalPoints} punti in attesa di approvazione (account nuovo — verranno accreditati entro 48h) ⏳`;
  } else if (leveledUp) {
    message = `Livello aumentato! Sei ora ${newLevel}! 🎉 +${totalPoints} punti`;
  } else if (totalPoints > 0) {
    message = `Ottimo! Hai guadagnato ${totalPoints} punti Leafy! 🌿`;
  } else {
    message = "Nessun prodotto green trovato. Prova a comprare prodotti Bio o Km 0!";
  }

  // ── Background: approve old pending points (max once per hour) ────────────
  const now = Date.now();
  if (now - lastPendingApprovalCheck > 60 * 60 * 1000) {
    lastPendingApprovalCheck = now;
    approvePendingPoints().catch((e) => console.error("[pending-approval]", e));
  }

  res.json({
    ...ScanReceiptResponse.parse({
      receiptId: receipt.id,
      pointsEarned: totalPoints,
      totalPoints: newTotalPoints,
      greenItemsFound: foundItems,
      badges: newBadges,
      challengesUpdated: updatedChallengeNames,
      message,
    }),
    leveledUp,
    newLevel: leveledUp ? newLevel : undefined,
    pendingPoints: newPendingPoints,
    receiptStatus: status,
    antiFraudWarnings: warnings,
    usingRealOcr: !!process.env.GOOGLE_CLOUD_VISION_API_KEY,
  });
});

export default router;
