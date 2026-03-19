import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  db,
  locationsTable,
  walkinSessionsTable,
  walkinCompletionsTable,
  discoveryChallengesTable,
  discoveryCompletionsTable,
} from "@workspace/db";
import { requireUser } from "./profile";
import { addXp } from "../lib/economy";

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
const WALKIN_SESSION_MAX_AGE_SECONDS = 7200; // 2 hours max before session is stale

function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
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

  const bucket = todayBucket();

  // Guard 1: max 1 completion per specific location per day (via walkin_completions)
  const [completedThisLocation] = await db
    .select({ id: walkinCompletionsTable.id })
    .from(walkinCompletionsTable)
    .where(
      and(
        eq(walkinCompletionsTable.userId, user.id),
        eq(walkinCompletionsTable.locationId, locationId),
        eq(walkinCompletionsTable.dayBucket, bucket),
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

  // Guard 2: per-type daily cap across all locations of that type
  const typeLimit = WALKIN_DAILY_LIMIT_PER_TYPE[location.type];
  const completedTodayOfType = await db
    .select({ id: walkinCompletionsTable.id })
    .from(walkinCompletionsTable)
    .innerJoin(locationsTable, eq(walkinCompletionsTable.locationId, locationsTable.id))
    .where(
      and(
        eq(walkinCompletionsTable.userId, user.id),
        eq(walkinCompletionsTable.dayBucket, bucket),
        eq(locationsTable.type, location.type),
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

  const result = await db.transaction(async (tx) => {
    // Step 1: Atomic pending→completed transition. Concurrent requests will conflict here.
    const now = new Date();
    const updated = await tx
      .update(walkinSessionsTable)
      .set({ status: "completed", completedAt: now })
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
    const ageSeconds = (now.getTime() - session.startedAt.getTime()) / 1000;

    // Step 2: Session max-age check (stale session anti-cheat)
    if (ageSeconds > WALKIN_SESSION_MAX_AGE_SECONDS) {
      await tx
        .update(walkinSessionsTable)
        .set({ status: "failed" })
        .where(eq(walkinSessionsTable.id, sessionId));
      return {
        error: `Sessione scaduta (${Math.round(ageSeconds / 60)} min). Avvia un nuovo walk-in.`,
        status: 400,
      };
    }

    // Step 3: Minimum dwell time check
    if (ageSeconds < WALKIN_REQUIRED_SECONDS) {
      await tx
        .update(walkinSessionsTable)
        .set({ status: "pending", completedAt: null })
        .where(eq(walkinSessionsTable.id, sessionId));
      return {
        error: "Non hai trascorso abbastanza tempo nel negozio.",
        status: 400,
        dwellSeconds: Math.round(ageSeconds),
        requiredSeconds: WALKIN_REQUIRED_SECONDS,
        remainingSeconds: Math.ceil(WALKIN_REQUIRED_SECONDS - ageSeconds),
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

    const bucket = todayBucket();
    const xpToAward = WALKIN_XP[location.type];
    const typeLimit = WALKIN_DAILY_LIMIT_PER_TYPE[location.type];

    // Step 4: Check per-type daily cap inside the transaction
    const completedOfType = await tx
      .select({ id: walkinCompletionsTable.id })
      .from(walkinCompletionsTable)
      .innerJoin(locationsTable, eq(walkinCompletionsTable.locationId, locationsTable.id))
      .where(
        and(
          eq(walkinCompletionsTable.userId, user.id),
          eq(walkinCompletionsTable.dayBucket, bucket),
          eq(locationsTable.type, location.type),
        ),
      );

    if (completedOfType.length >= typeLimit) {
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

    // Step 5: Persist XP amount on session record
    await tx
      .update(walkinSessionsTable)
      .set({ xpAwarded: xpToAward })
      .where(eq(walkinSessionsTable.id, sessionId));

    // Step 6: DB-level unique gate — INSERT ON CONFLICT DO NOTHING.
    // The unique index on (userId, locationId, dayBucket) is the authoritative anti-cheat guard.
    // If two concurrent transactions both reach here for the same user/location/day, only one
    // insert will succeed; the other will silently be dropped (idempotent, race-safe).
    const inserted = await tx
      .insert(walkinCompletionsTable)
      .values({
        userId: user.id,
        locationId: location.id,
        sessionId: session.id,
        dayBucket: bucket,
        xpAwarded: xpToAward,
      })
      .onConflictDoNothing()
      .returning({ id: walkinCompletionsTable.id });

    if (inserted.length === 0) {
      // Another concurrent request already claimed this slot
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

    // Step 7: Award XP via centralized economy helper (inside the same transaction)
    const newXp = await addXp(tx, user.id, xpToAward);

    return {
      success: true,
      xpAwarded: xpToAward,
      locationType: location.type,
      locationName: location.name,
      dwellSeconds: Math.round(ageSeconds),
      newXp,
      message:
        location.type === "oasi"
          ? `Benvenuto in un'Oasi Green! +${xpToAward} XP per te.`
          : `Walk-in completato! +${xpToAward} XP.`,
    };
  });

  if ("error" in result && result.error) {
    res.status((result as { status?: number }).status ?? 400).json(result);
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

  // Atomic insert: unique index (userId, challengeId, dayBucket) prevents concurrent double-awards.
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

  // Award XP via centralized economy helper
  const newXp = await addXp(db, user.id, challenge.xpReward);

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
