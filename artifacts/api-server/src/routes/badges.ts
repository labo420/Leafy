import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, badgesTable, userBadgesTable } from "@workspace/db";
import { GetMyBadgesResponse } from "@workspace/api-zod";
import { requireUser } from "./profile";

const router: IRouter = Router();

function getCurrentPeriodKey(badgeType: string): string {
  const now = new Date();
  const year = now.getFullYear();
  if (badgeType === "weekly") {
    const startOfYear = new Date(year, 0, 1);
    const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNum).padStart(2, "0")}`;
  }
  if (badgeType === "monthly") {
    return `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `${year}-Q${quarter}`;
}

function isPeriodExpired(periodKey: string, badgeType: string): boolean {
  return periodKey !== getCurrentPeriodKey(badgeType);
}

router.get("/badges/my", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const allBadges = await db.select().from(badgesTable).where(eq(badgesTable.isActive, true));
  const userBadges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, user.id));

  const lifetimeBadges = allBadges.filter(b => b.badgeType === "lifetime");
  const temporalBadges = allBadges.filter(b => b.badgeType !== "lifetime");

  const lifetime = lifetimeBadges.map(badge => {
    const ub = userBadges.find(u => u.badgeId === badge.id);
    return {
      id: badge.id,
      name: badge.name,
      emoji: badge.emoji,
      category: badge.category,
      description: badge.description,
      unlockHint: badge.unlockHint,
      isUnlocked: !!ub,
      unlockedAt: ub?.unlockedAt ?? null,
      currentProgress: ub?.currentProgress ?? 0,
      targetCount: badge.targetCount,
    };
  });

  const temporal = temporalBadges.flatMap(badge => {
    const currentPeriod = getCurrentPeriodKey(badge.badgeType);
    const relatedUserBadges = userBadges.filter(u => u.badgeId === badge.id);

    const periods: string[] = [currentPeriod];
    relatedUserBadges.forEach(ub => {
      if (ub.periodKey && !periods.includes(ub.periodKey)) {
        periods.push(ub.periodKey);
      }
    });

    return periods.map(periodKey => {
      const ub = relatedUserBadges.find(u => u.periodKey === periodKey);
      return {
        id: badge.id,
        name: badge.name,
        emoji: badge.emoji,
        category: badge.category,
        description: badge.description,
        unlockHint: badge.unlockHint,
        badgeType: badge.badgeType as "weekly" | "monthly" | "seasonal",
        periodKey,
        isUnlocked: !!ub,
        unlockedAt: ub?.unlockedAt ?? null,
        currentProgress: ub?.currentProgress ?? 0,
        targetCount: badge.targetCount,
        isExpired: isPeriodExpired(periodKey, badge.badgeType),
      };
    });
  });

  res.json(GetMyBadgesResponse.parse({ lifetime, temporal }));
});

export default router;
