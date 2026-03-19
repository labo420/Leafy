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
const WALKIN_SESSION_MAX_AGE_SECONDS = 7200; // 2 hours: sessions older than this cannot be completed

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Centralized XP award helper: adds XP to the user's balance and returns the new XP total.
 * All walk-in and discovery XP awards go through here for consistency.
 */
async function awardXp(userId: number, xpAmount: number): Promise<number> {
  await db
    .update(usersTable)
    .set({ xp: sql`${usersTable.xp} + ${xpAmount}` })
    .where(eq(usersTable.id, userId));
  const [updated] = await db
    .select({ xp: usersTable.xp })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return updated?.xp ?? 0;
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

  // Guard 1: max 1 completion per specific location per day
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

  // Guard 2: type-level daily cap (across all stores of that type)
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

  // Wrap the entire completion in a transaction to prevent concurrent double-awards
  const result = await db.transaction(async (tx) => {
    // Atomic transition: pending → completed. Simultaneous requests will fail here.
    const updated = await tx
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
      return { error: "Sessione walk-in non trovata o già completata.", status: 404 };
    }

    const session = updated[0];
    const nowMs = session.completedAt!.getTime();
    const startMs = session.startedAt.getTime();

    // Check session max age (anti-cheat: cannot complete a session started too long ago)
    const ageSeconds = (nowMs - startMs) / 1000;
    if (ageSeconds > WALKIN_SESSION_MAX_AGE_SECONDS) {
      await tx
        .update(walkinSessionsTable)
        .set({ status: "failed" })
        .where(eq(walkinSessionsTable.id, sessionId));
      return {
        error: `La sessione è scaduta (${Math.round(ageSeconds / 60)} minuti). Avvia un nuovo walk-in.`,
        status: 400,
      };
    }

    // Enforce 120-second minimum dwell time
    const dwellSeconds = ageSeconds;
    if (dwellSeconds < WALKIN_REQUIRED_SECONDS) {
      // Revert to pending so the user can try again
      await tx
        .update(walkinSessionsTable)
        .set({ status: "pending", completedAt: null })
        .where(eq(walkinSessionsTable.id, sessionId));
      return {
        status: 400,
        error: "Non hai trascorso abbastanza tempo nel negozio.",
        dwellSeconds: Math.round(dwellSeconds),
        requiredSeconds: WALKIN_REQUIRED_SECONDS,
        remainingSeconds: Math.ceil(WALKIN_REQUIRED_SECONDS - dwellSeconds),
      };
    }

    const [location] = await tx
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.id, session.locationId))
      .limit(1);

    if (!location) {
      await tx
        .update(walkinSessionsTable)
        .set({ status: "failed" })
        .where(eq(walkinSessionsTable.id, sessionId));
      return { error: "Negozio non trovato.", status: 404 };
    }

    const todayStart = startOfTodayUTC();

    // Double-check: per-location cap (max 1 per location per day, excluding this session)
    const [otherCompletedSameLocation] = await tx
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
      )
      .limit(1);

    if (otherCompletedSameLocation) {
      await tx
        .update(walkinSessionsTable)
        .set({ status: "failed", xpAwarded: 0 })
        .where(eq(walkinSessionsTable.id, sessionId));
      return {
        success: false,
        alreadyCompleted: true,
        reason: "location",
        message: "Hai già completato il walk-in in questo negozio oggi.",
      };
    }

    // Double-check: per-type daily cap (excluding this session)
    const typeLimit = WALKIN_DAILY_LIMIT_PER_TYPE[location.type];
    const completedTodayOfType = await tx
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
      await tx
        .update(walkinSessionsTable)
        .set({ status: "failed", xpAwarded: 0 })
        .where(eq(walkinSessionsTable.id, sessionId));
      return {
        success: false,
        alreadyCompleted: true,
        reason: "type_limit",
        message: `Limite giornaliero raggiunto per negozi di tipo "${location.type}".`,
      };
    }

    const xpToAward = WALKIN_XP[location.type];

    // Persist XP amount on session record
    await tx
      .update(walkinSessionsTable)
      .set({ xpAwarded: xpToAward })
      .where(eq(walkinSessionsTable.id, sessionId));

    // Award XP via centralized helper (within the transaction)
    await tx
      .update(usersTable)
      .set({ xp: sql`${usersTable.xp} + ${xpToAward}` })
      .where(eq(usersTable.id, user.id));

    const [updatedUser] = await tx
      .select({ xp: usersTable.xp })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    return {
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
    };
  });

  if ("error" in result && result.error) {
    const status = (result as { status?: number }).status ?? 400;
    res.status(status).json(result);
    return;
  }

  res.json(result);
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

  const bucket = todayBucket();

  // Atomic insert: the unique index (userId, challengeId, dayBucket) prevents
  // duplicate completions for the same challenge on the same day, even under concurrency.
  // ON CONFLICT DO NOTHING means the insert is silently ignored if the record already exists.
  const inserted = await db
    .insert(discoveryCompletionsTable)
    .values({
      userId: user.id,
      challengeId: challenge.id,
      dayBucket: bucket,
      xpAwarded: challenge.xpReward,
    })
    .onConflictDoNothing()
    .returning({ id: discoveryCompletionsTable.id });

  if (inserted.length === 0) {
    res.json({
      success: false,
      alreadyCompleted: true,
      message: "Hai già completato questa sfida oggi.",
    });
    return;
  }

  // Award XP via centralized helper
  const newXp = await awardXp(user.id, challenge.xpReward);

  res.json({
    success: true,
    found: true,
    xpAwarded: challenge.xpReward,
    productName: challenge.productName,
    productDescription: challenge.productDescription,
    emoji: challenge.emoji,
    newXp,
    message: `Trovato! +${challenge.xpReward} XP per aver trovato "${challenge.productName}".`,
  });
});

export default router;
