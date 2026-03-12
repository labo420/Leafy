import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, receiptsTable, challengeProgressTable, challengesTable } from "@workspace/db";
import { ScanReceiptBody, ScanReceiptResponse } from "@workspace/api-zod";
import { parseReceiptText, hashImage, extractTextViaGoogleVision, calculateLevel } from "../lib/scanner";
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

  const existing = await db.select().from(receiptsTable)
    .where(and(
      eq(receiptsTable.userId, user.id),
      eq(receiptsTable.imageHash, imageHash)
    ));

  if (existing.length > 0) {
    res.status(400).json({ error: "Scontrino già scansionato in precedenza. Anti-frode attivo." });
    return;
  }

  const oldLevel = calculateLevel(user.totalPoints).level;

  let textToAnalyze = rawText || "";
  if (!textToAnalyze) {
    const visionText = await extractTextViaGoogleVision(imageBase64);
    if (visionText) {
      textToAnalyze = visionText;
      console.log("[Vision OCR] Testo estratto:", textToAnalyze.slice(0, 200));
    } else {
      textToAnalyze = DEMO_TEXT + " " + (storeName || "");
    }
  }

  const foundItems = parseReceiptText(textToAnalyze);

  const totalPoints = foundItems.reduce((sum, item) => sum + item.points, 0);
  const categories = [...new Set(foundItems.map(i => i.category))];

  const [receipt] = await db.insert(receiptsTable).values({
    userId: user.id,
    storeName: storeName ?? null,
    purchaseDate: purchaseDate ?? null,
    imageHash,
    rawText: textToAnalyze,
    pointsEarned: totalPoints,
    greenItemsCount: foundItems.length,
    categories,
    greenItemsJson: JSON.stringify(foundItems),
  }).returning();

  const newTotalPoints = user.totalPoints + totalPoints;
  const today = new Date().toDateString();
  const lastScanDate = user.lastScanDate ? new Date(user.lastScanDate).toDateString() : null;
  const newStreak = lastScanDate === today ? user.streak : user.streak + 1;

  await db.update(usersTable)
    .set({ totalPoints: newTotalPoints, streak: newStreak, lastScanDate: new Date() })
    .where(eq(usersTable.id, user.id));

  const activeChallenges = await db.select().from(challengesTable)
    .where(eq(challengesTable.isActive, true));

  const updatedChallengeNames: string[] = [];

  for (const challenge of activeChallenges) {
    const relevantItems = foundItems.filter(item => {
      if (challenge.category === "tutti") return true;
      return item.category === challenge.category;
    });

    if (relevantItems.length === 0) continue;

    const existing = await db.select().from(challengeProgressTable)
      .where(and(
        eq(challengeProgressTable.userId, user.id),
        eq(challengeProgressTable.challengeId, challenge.id)
      ));

    const increment = relevantItems.length;

    if (existing.length === 0) {
      await db.insert(challengeProgressTable).values({
        userId: user.id,
        challengeId: challenge.id,
        currentCount: increment,
        isCompleted: increment >= challenge.targetCount,
        completedAt: increment >= challenge.targetCount ? new Date() : null,
      });
    } else {
      const current = existing[0];
      if (!current.isCompleted) {
        const newCount = current.currentCount + increment;
        const completed = newCount >= challenge.targetCount;
        await db.update(challengeProgressTable)
          .set({
            currentCount: newCount,
            isCompleted: completed,
            completedAt: completed ? new Date() : null,
          })
          .where(eq(challengeProgressTable.id, current.id));

        if (completed) {
          await db.update(usersTable)
            .set({ totalPoints: newTotalPoints + challenge.rewardPoints })
            .where(eq(usersTable.id, user.id));
          updatedChallengeNames.push(challenge.title);
        }
      }
    }
  }

  const newBadges = [];
  if ((await db.select().from(receiptsTable).where(eq(receiptsTable.userId, user.id))).length === 1) {
    newBadges.push({ id: "first_scan", name: "Prima Scansione", emoji: "🌟", category: "Bio", earnedAt: new Date() });
  }

  const newLevel = calculateLevel(newTotalPoints).level;
  const leveledUp = newLevel !== oldLevel;

  let message = totalPoints > 0
    ? `Ottimo! Hai guadagnato ${totalPoints} punti Leafy! 🌿`
    : "Nessun prodotto green trovato. Prova a comprare prodotti Bio o Km 0!";
  if (leveledUp) {
    message = `Livello aumentato! Sei ora ${newLevel}! 🎉 +${totalPoints} punti`;
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
    usingRealOcr: !!process.env.GOOGLE_CLOUD_VISION_API_KEY,
  });
});

export default router;
