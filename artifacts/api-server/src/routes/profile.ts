import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, receiptsTable } from "@workspace/db";
import {
  GetProfileResponse,
  GetImpactResponse,
  GetReferralResponse,
  ApplyReferralBody,
  ApplyReferralResponse,
} from "@workspace/api-zod";
import { calculateLevel } from "../lib/scanner";

const router: IRouter = Router();

const ALL_BADGES = [
  { id: "first_scan", name: "Prima Scansione", emoji: "🌟", category: "Bio" },
  { id: "bio_master", name: "Master Bio", emoji: "🌱", category: "Bio" },
  { id: "km0_lover", name: "Km 0 Lover", emoji: "📍", category: "Km 0" },
  { id: "plastic_free", name: "Plastic Free", emoji: "♻️", category: "Senza Plastica" },
  { id: "fair_hero", name: "Eroe Equo", emoji: "❤️", category: "Equo Solidale" },
  { id: "vegan_champ", name: "Campione Vegano", emoji: "🌿", category: "Vegano" },
  { id: "streak_7", name: "7 Giorni di Fila", emoji: "🔥", category: "Bio" },
  { id: "green_500", name: "500 Punti Verdi", emoji: "🥈", category: "Bio" },
  { id: "green_2000", name: "2000 Punti Verdi", emoji: "🥇", category: "Bio" },
  { id: "artisan_fan", name: "Fan Artigianale", emoji: "🏺", category: "Artigianale" },
];

export async function requireUser(
  req: Request,
  res: Response,
): Promise<typeof usersTable.$inferSelect | null> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Accesso richiesto. Effettua il login." });
    return null;
  }
  const userId = parseInt(req.user.id, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utente non trovato." });
    return null;
  }
  return user;
}

router.put("/profile/username", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { username } = req.body;
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    res.status(400).json({ error: "Nome utente non valido." });
    return;
  }
  
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 30) {
    res.status(400).json({ error: "Il nome utente deve avere tra 3 e 30 caratteri." });
    return;
  }

  await db.update(usersTable).set({ username: trimmed }).where(eq(usersTable.id, user.id));
  res.json({ username: trimmed });
});

router.get("/profile", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { level, nextLevelPoints, progressPercent } = calculateLevel(user.totalPoints);

  const receipts = await db.select().from(receiptsTable).where(eq(receiptsTable.userId, user.id));
  const categories = [...new Set(receipts.flatMap(r => r.categories))];

  const earnedBadges: string[] = [];
  if (receipts.length > 0) earnedBadges.push("first_scan");
  if (categories.includes("Bio")) earnedBadges.push("bio_master");
  if (categories.includes("Km 0")) earnedBadges.push("km0_lover");
  if (categories.includes("Senza Plastica")) earnedBadges.push("plastic_free");
  if (categories.includes("Equo Solidale")) earnedBadges.push("fair_hero");
  if (categories.includes("Vegano")) earnedBadges.push("vegan_champ");
  if (user.streak >= 7) earnedBadges.push("streak_7");
  if (user.totalPoints >= 500) earnedBadges.push("green_500");
  if (user.totalPoints >= 2000) earnedBadges.push("green_2000");

  const badges = ALL_BADGES.map(b => ({
    ...b,
    earnedAt: earnedBadges.includes(b.id) ? new Date() : null,
  }));

  const data = GetProfileResponse.parse({
    id: user.id,
    username: user.username,
    email: user.email,
    totalPoints: user.totalPoints,
    level,
    levelProgress: progressPercent,
    nextLevelPoints,
    streak: user.streak,
    badgesCount: earnedBadges.length,
    badges,
  });
  res.json(data);
});

router.get("/profile/impact", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const receipts = await db.select().from(receiptsTable).where(eq(receiptsTable.userId, user.id));

  let co2 = 0, plastic = 0, water = 0, greenItems = 0;
  for (const r of receipts) {
    greenItems += r.greenItemsCount;
    for (const cat of r.categories) {
      if (cat === "Bio") { co2 += 0.3; water += 50; }
      if (cat === "Km 0") { co2 += 0.5; water += 20; }
      if (cat === "Senza Plastica") { plastic += 0.05; }
      if (cat === "Vegano") { co2 += 0.8; water += 100; }
      if (cat === "Equo Solidale") { co2 += 0.1; }
    }
  }

  res.json(GetImpactResponse.parse({
    co2SavedKg: Math.round(co2 * 100) / 100,
    plasticAvoidedKg: Math.round(plastic * 1000) / 1000,
    waterSavedLiters: Math.round(water),
    greenProductsCount: greenItems,
    receiptsScanned: receipts.length,
  }));
});

router.get("/profile/referral", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  res.json(GetReferralResponse.parse({
    code: user.referralCode,
    referralUrl: `https://leafy.app/join?ref=${user.referralCode}`,
    referralCount: user.referralCount,
    pointsEarned: user.referralPointsEarned,
  }));
});

router.post("/profile/referral", async (req, res): Promise<void> => {
  const parsed = ApplyReferralBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await requireUser(req, res);
  if (!user) return;

  if (parsed.data.code === user.referralCode) {
    res.status(400).json({ error: "Non puoi usare il tuo stesso codice referral." });
    return;
  }

  const REFERRAL_BONUS = 50;
  await db.update(usersTable)
    .set({ totalPoints: user.totalPoints + REFERRAL_BONUS })
    .where(eq(usersTable.id, user.id));

  res.json(ApplyReferralResponse.parse({
    success: true,
    pointsAwarded: REFERRAL_BONUS,
    message: `Referral applicato! Hai guadagnato ${REFERRAL_BONUS} punti bonus. 🎉`,
  }));
});

export default router;
