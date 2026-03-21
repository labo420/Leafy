import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, sustainabilityKitsTable, kitProgressTable } from "@workspace/db";
import { requireUser } from "./profile";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

export interface KitSlot {
  id: string;
  label: string;
  matchCategories: string[];
}

router.get("/kits", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const kits = await db.select().from(sustainabilityKitsTable)
    .where(eq(sustainabilityKitsTable.isActive, true));

  const result = await Promise.all(kits.map(async (kit) => {
    const slots: KitSlot[] = (() => { try { return JSON.parse(kit.slotsJson); } catch { return []; } })();

    const [progress] = await db.select().from(kitProgressTable)
      .where(and(
        eq(kitProgressTable.userId, user.id),
        eq(kitProgressTable.kitId, kit.id),
      ));

    const completedSlots: string[] = (() => {
      try { return JSON.parse(progress?.completedSlotsJson ?? "[]"); } catch { return []; }
    })();

    return {
      id: kit.id,
      name: kit.name,
      description: kit.description,
      rewardDrops: kit.rewardDrops,
      isCompleted: progress?.isCompleted ?? false,
      completedAt: progress?.completedAt?.toISOString() ?? null,
      slots: slots.map((s) => ({
        id: s.id,
        label: s.label,
        matchCategories: s.matchCategories,
        completed: completedSlots.includes(s.id),
      })),
      completedCount: completedSlots.length,
      totalCount: slots.length,
      progressPercent: slots.length > 0 ? Math.round((completedSlots.length / slots.length) * 100) : 0,
    };
  }));

  res.json(result);
});

export async function checkKitProgress(
  userId: number,
  productCategory: string,
): Promise<{ kitCompleted: boolean; kitName?: string; rewardDrops?: number } | null> {
  const kits = await db.select().from(sustainabilityKitsTable)
    .where(eq(sustainabilityKitsTable.isActive, true));

  for (const kit of kits) {
    const slots: KitSlot[] = (() => { try { return JSON.parse(kit.slotsJson); } catch { return []; } })();
    if (slots.length === 0) continue;

    const [progress] = await db.select().from(kitProgressTable)
      .where(and(
        eq(kitProgressTable.userId, userId),
        eq(kitProgressTable.kitId, kit.id),
      ));

    if (progress?.isCompleted) continue;

    const completedSlots: string[] = (() => {
      try { return JSON.parse(progress?.completedSlotsJson ?? "[]"); } catch { return []; }
    })();

    const matchingSlot = slots.find(
      (s) => !completedSlots.includes(s.id) && s.matchCategories.includes(productCategory),
    );

    if (!matchingSlot) continue;

    const newCompletedSlots = [...completedSlots, matchingSlot.id];
    const allDone = newCompletedSlots.length >= slots.length;

    if (progress) {
      await db.update(kitProgressTable).set({
        completedSlotsJson: JSON.stringify(newCompletedSlots),
        isCompleted: allDone,
        completedAt: allDone ? new Date() : null,
      }).where(eq(kitProgressTable.id, progress.id));
    } else {
      await db.insert(kitProgressTable).values({
        userId,
        kitId: kit.id,
        completedSlotsJson: JSON.stringify(newCompletedSlots),
        isCompleted: allDone,
        completedAt: allDone ? new Date() : null,
      });
    }

    if (allDone) {
      await db.update(usersTable).set({
        drops: sql`xp + ${kit.rewardDrops}`,
        totalPoints: sql`total_points + ${kit.rewardDrops}`,
      }).where(eq(usersTable.id, userId));

      return { kitCompleted: true, kitName: kit.name, rewardDrops: kit.rewardDrops };
    }

    return { kitCompleted: false };
  }

  return null;
}

export default router;
