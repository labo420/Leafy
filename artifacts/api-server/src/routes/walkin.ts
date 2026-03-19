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

const WALKIN_DAILY_LIMIT_PER_TYPE: Record<"oasi" | "standard", number> = {
  oasi: 2,
  standard: 1,
};

const WALKIN_REQUIRED_SECONDS = 120;

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
  const typeLimit = WALKIN_DAILY_LIMIT_PER_TYPE[location.type];

  // Check 1: has this specific location already been completed today? (max 1 per location/day)
  const [completedThisLocation] = await db
    .select({ id: walkinSessionsTable.id })
    .from(walkinSessionsTable)
    .where(
      and(
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.locationId, locationId),
        eq(walkinSessionsTable.status, "completed"),
        gte(walkinSessionsTable.completedAt, todayStart),
      ),
    )
    .limit(1);

  if (completedThisLocation) {
    res.json({
      sessionId: null,
      alreadyCompleted: true,
      reason: "location",
      message: "Hai già completato il walk-in in questo negozio oggi.",
    });
    return;
  }

  // Check 2: has the type-level daily limit been reached?
  // Join with locations to filter by type
  const completedTodayOfType = await db
    .select({ id: walkinSessionsTable.id })
    .from(walkinSessionsTable)
    .innerJoin(locationsTable, eq(walkinSessionsTable.locationId, locationsTable.id))
    .where(
      and(
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.status, "completed"),
        eq(locationsTable.type, location.type),
        gte(walkinSessionsTable.completedAt, todayStart),
      ),
    );

  if (completedTodayOfType.length >= typeLimit) {
    res.json({
      sessionId: null,
      alreadyCompleted: true,
      reason: "type_limit",
      message: `Hai raggiunto il limite giornaliero di ${typeLimit} walk-in per negozi di tipo "${location.type}".`,
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
    requiredSeconds: WALKIN_REQUIRED_SECONDS,
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

  // Atomic update: only transition from 'pending' to 'completed'.
  // This prevents race conditions — only one concurrent request can update a pending session.
  const updated = await db
    .update(walkinSessionsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(
      and(
        eq(walkinSessionsTable.id, sessionId),
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.status, "pending"),
      ),
    )
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Sessione walk-in non trovata o già completata." });
    return;
  }

  const session = updated[0];

  // Enforce 120-second minimum dwell time
  const dwellSeconds = (session.completedAt!.getTime() - session.startedAt.getTime()) / 1000;
  if (dwellSeconds < WALKIN_REQUIRED_SECONDS) {
    // Revert to pending so the user can try again
    await db
      .update(walkinSessionsTable)
      .set({ status: "pending", completedAt: null })
      .where(eq(walkinSessionsTable.id, sessionId));

    res.status(400).json({
      error: "Non hai trascorso abbastanza tempo nel negozio.",
      dwellSeconds: Math.round(dwellSeconds),
      requiredSeconds: WALKIN_REQUIRED_SECONDS,
      remainingSeconds: Math.ceil(WALKIN_REQUIRED_SECONDS - dwellSeconds),
    });
    return;
  }

  const [location] = await db
    .select()
    .from(locationsTable)
    .where(eq(locationsTable.id, session.locationId))
    .limit(1);

  if (!location) {
    // Roll back the status change
    await db
      .update(walkinSessionsTable)
      .set({ status: "failed" })
      .where(eq(walkinSessionsTable.id, sessionId));
    res.status(404).json({ error: "Negozio non trovato." });
    return;
  }

  const todayStart = startOfTodayUTC();

  // Double-check: per-location cap (max 1 completion per location per day)
  const completedSameLocation = await db
    .select({ id: walkinSessionsTable.id })
    .from(walkinSessionsTable)
    .where(
      and(
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.locationId, location.id),
        eq(walkinSessionsTable.status, "completed"),
        gte(walkinSessionsTable.completedAt, todayStart),
        sql`${walkinSessionsTable.id} != ${sessionId}`,
      ),
    );

  if (completedSameLocation.length > 0) {
    await db
      .update(walkinSessionsTable)
      .set({ status: "failed", xpAwarded: 0 })
      .where(eq(walkinSessionsTable.id, sessionId));
    res.json({
      success: false,
      alreadyCompleted: true,
      reason: "location",
      message: "Hai già completato il walk-in in questo negozio oggi.",
    });
    return;
  }

  // Double-check: per-type daily cap
  const typeLimit = WALKIN_DAILY_LIMIT_PER_TYPE[location.type];
  const completedTodayOfType = await db
    .select({ id: walkinSessionsTable.id })
    .from(walkinSessionsTable)
    .innerJoin(locationsTable, eq(walkinSessionsTable.locationId, locationsTable.id))
    .where(
      and(
        eq(walkinSessionsTable.userId, user.id),
        eq(walkinSessionsTable.status, "completed"),
        eq(locationsTable.type, location.type),
        gte(walkinSessionsTable.completedAt, todayStart),
        sql`${walkinSessionsTable.id} != ${sessionId}`,
      ),
    );

  if (completedTodayOfType.length >= typeLimit) {
    await db
      .update(walkinSessionsTable)
      .set({ status: "failed", xpAwarded: 0 })
      .where(eq(walkinSessionsTable.id, sessionId));
    res.json({
      success: false,
      alreadyCompleted: true,
      reason: "type_limit",
      message: `Limite giornaliero raggiunto per negozi di tipo "${location.type}".`,
    });
    return;
  }

  const xpToAward = WALKIN_XP[location.type];

  // Finalize XP on the session record
  await db
    .update(walkinSessionsTable)
    .set({ xpAwarded: xpToAward })
    .where(eq(walkinSessionsTable.id, sessionId));

  // Award XP to user
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
    dwellSeconds: Math.round(dwellSeconds),
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

  // Atomic insert + check: prevent duplicate completions for the same challenge today
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
