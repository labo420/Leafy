import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, challengesTable, challengeProgressTable } from "@workspace/db";
import { GetChallengesResponse } from "@workspace/api-zod";
import { requireUser } from "./profile";

const router: IRouter = Router();

router.get("/challenges", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const challenges = await db.select().from(challengesTable)
    .where(eq(challengesTable.isActive, true));

  const result = await Promise.all(challenges.map(async (c) => {
    const [progress] = await db.select().from(challengeProgressTable)
      .where(and(
        eq(challengeProgressTable.userId, user.id),
        eq(challengeProgressTable.challengeId, c.id)
      ));

    const currentCount = progress?.currentCount ?? 0;
    const isCompleted = progress?.isCompleted ?? false;
    const progressPercent = Math.min(100, Math.round((currentCount / c.targetCount) * 100));

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      emoji: c.emoji,
      targetCount: c.targetCount,
      currentCount,
      rewardPoints: c.rewardPoints,
      expiresAt: c.expiresAt,
      isCompleted,
      progressPercent,
    };
  }));

  res.json(GetChallengesResponse.parse(result));
});

export default router;
