import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  locationsTable,
  walkinSessionsTable,
  discoveryChallengesTable,
  discoveryCompletionsTable,
} from "@workspace/db";
import { requireUser } from "./profile";

const router: IRouter = Router();

const WALKIN_XP: Record<"oasi" | "standard", number> = {
  oasi: 15,
  standard: 5,
};

const WALKIN_DAILY_LIMIT: Record<"oasi" | "standard", number> = {
  oasi: 2,
  standard: 1,
};

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

router.post("/walkin/start", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { locationId } = req.body;
  if (!locationId || typeof locationId !== "number") {
    res.status(400).json({ error: "locationId richiesto." });
    return;
  }

  const [location] = await db
    .select()
    .from(locationsTable)
    .where(and(eq(locationsTable.id, locationId), eq(locationsTable.isActive, true)))
    .limit(1);

  if (!location) {
    res.status(404).json({ error: "Negozio non trovato." });
    return;
  }

  const todayStart = startOfTodayUTC();
  const limit = WALKIN_DAILY_LIMIT[location.type];

  const completedToday = await db
    .select({ id: walkinSessionsTable.id })
    .from(walkinSessionsTable)
    .where(
      and(
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.locationId, locationId),
        eq(walkinSessionsTable.status, "completed"),
        gte(walkinSessionsTable.completedAt, todayStart),
      ),
    );

  if (completedToday.length >= limit) {
    res.json({
      sessionId: null,
      alreadyCompleted: true,
      message: `Hai già completato il walk-in per questo negozio oggi (limite: ${limit}).`,
    });
    return;
  }

  const [session] = await db
    .insert(walkinSessionsTable)
    .values({
      userId: user.id,
      locationId,
      status: "pending",
    })
    .returning({ id: walkinSessionsTable.id });

  res.json({
    sessionId: session.id,
    alreadyCompleted: false,
    location: {
      id: location.id,
      name: location.name,
      chain: location.chain,
      type: location.type,
    },
  });
});

router.post("/walkin/complete", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== "number") {
    res.status(400).json({ error: "sessionId richiesto." });
    return;
  }

  const [session] = await db
    .select()
    .from(walkinSessionsTable)
    .where(
      and(
        eq(walkinSessionsTable.id, sessionId),
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.status, "pending"),
      ),
    )
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Sessione walk-in non trovata o già completata." });
    return;
  }

  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, session.locationId))
    .limit(1);

  if (!location) {
    res.status(404).json({ error: "Negozio non trovato." });
    return;
  }

  const todayStart = startOfTodayUTC();
  const limit = WALKIN_DAILY_LIMIT[location.type];

  const completedToday = await db
    .select({ id: walkinSessionsTable.id })
    .from(walkinSessionsTable)
    .where(
      and(
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.locationId, location.id),
        eq(walkinSessionsTable.status, "completed"),
        gte(walkinSessionsTable.completedAt, todayStart),
      ),
    );

  if (completedToday.length >= limit) {
    await db
      .update(walkinSessionsTable)
      .set({ status: "failed" })
      .where(eq(walkinSessionsTable.id, sessionId));

    res.json({
      success: false,
      alreadyCompleted: true,
      message: `Limite giornaliero già raggiunto per questo negozio.`,
    });
    return;
  }

  const xpToAward = WALKIN_XP[location.type];

  await db
    .update(walkinSessionsTable)
    .set({ status: "completed", completedAt: new Date(), xpAwarded: xpToAward })
    .where(eq(walkinSessionsTable.id, sessionId));

  await db
    .update(usersTable)
    .set({ xp: sql`${usersTable.xp} + ${xpToAward}` })
    .where(eq(usersTable.id, user.id));

  const [updatedUser] = await db
    .select({ xp: usersTable.xp, leaBalance: usersTable.leaBalance })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  res.json({
    success: true,
    xpAwarded: xpToAward,
    locationType: location.type,
    locationName: location.name,
    newXp: updatedUser?.xp ?? user.xp + xpToAward,
    message:
      location.type === "oasi"
        ? `Benvenuto in un'Oasi Green! +${xpToAward} XP per te.`
        : `Walk-in completato! +${xpToAward} XP.`,
  });
});

router.post("/discovery/scan", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { barcode, locationId } = req.body;
  if (!barcode || typeof barcode !== "string") {
    res.status(400).json({ error: "barcode richiesto." });
    return;
  }
  if (!locationId || typeof locationId !== "number") {
    res.status(400).json({ error: "locationId richiesto." });
    return;
  }

  const [challenge] = await db
    .select()
    .from(discoveryChallengesTable)
    .where(
      and(
        eq(discoveryChallengesTable.locationId, locationId),
        eq(discoveryChallengesTable.barcode, barcode),
        eq(discoveryChallengesTable.isActive, true),
      ),
    )
    .limit(1);

  if (!challenge) {
    res.status(404).json({
      error: "Nessuna sfida Discovery attiva per questo prodotto in questo negozio.",
      found: false,
    });
    return;
  }

  const todayStart = startOfTodayUTC();

  const [alreadyCompleted] = await db
    .select({ id: discoveryCompletionsTable.id })
    .from(discoveryCompletionsTable)
    .where(
      and(
        eq(discoveryCompletionsTable.userId, user.id),
        eq(discoveryCompletionsTable.challengeId, challenge.id),
        gte(discoveryCompletionsTable.completedAt, todayStart),
      ),
    )
    .limit(1);

  if (alreadyCompleted) {
    res.json({
      success: false,
      alreadyCompleted: true,
      message: "Hai già completato questa sfida oggi.",
    });
    return;
  }

  const xpToAward = challenge.xpReward;

  await db.insert(discoveryCompletionsTable).values({
    userId: user.id,
    challengeId: challenge.id,
    xpAwarded: xpToAward,
  });

  await db
    .update(usersTable)
    .set({ xp: sql`${usersTable.xp} + ${xpToAward}` })
    .where(eq(usersTable.id, user.id));

  const [updatedUser] = await db
    .select({ xp: usersTable.xp })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  res.json({
    success: true,
    found: true,
    xpAwarded: xpToAward,
    productName: challenge.productName,
    productDescription: challenge.productDescription,
    emoji: challenge.emoji,
    newXp: updatedUser?.xp ?? user.xp + xpToAward,
    message: `Trovato! +${xpToAward} XP per aver trovato "${challenge.productName}".`,
  });
});

export default router;
