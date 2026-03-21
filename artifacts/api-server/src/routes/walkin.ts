import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  locationsTable,
  walkinSessionsTable,
  walkinCompletionsTable,
  discoveryChallengesTable,
  discoveryCompletionsTable,
} from "@workspace/db";
import { requireUser } from "./profile";
import { addDrops, addDropsInTx } from "../lib/economy";

const router: IRouter = Router();

const WALKIN_DROPS: Record<"oasi" | "standard", number> = { oasi: 15, standard: 5 };
const WALKIN_DAILY_LIMIT: Record<"oasi" | "standard", number> = { oasi: 2, standard: 1 };
const ADVISORY_KEY: Record<"oasi" | "standard", number> = { oasi: 1, standard: 2 };
const REQUIRED_SECONDS = 120;
const MAX_AGE_SECONDS = 7200;

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

  const [completedHere] = await db
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

  if (completedHere) {
    res.json({ sessionId: null, alreadyCompleted: true, reason: "location", message: "Hai già completato il walk-in in questo negozio oggi." });
    return;
  }

  const typeLimit = WALKIN_DAILY_LIMIT[location.type];
  const completedOfType = await db
    .select({ id: walkinCompletionsTable.id })
    .from(walkinCompletionsTable)
    .innerJoin(locationsTable, eq(walkinCompletionsTable.locationId, locationsTable.id))
    .where(and(eq(walkinCompletionsTable.userId, user.id), eq(walkinCompletionsTable.dayBucket, bucket), eq(locationsTable.type, location.type)));

  if (completedOfType.length >= typeLimit) {
    res.json({ sessionId: null, alreadyCompleted: true, reason: "type_limit", message: `Hai raggiunto il limite giornaliero di ${typeLimit} walk-in per negozi di tipo "${location.type}".` });
    return;
  }

  const [session] = await db
    .insert(walkinSessionsTable)
    .values({ userId: user.id, locationId, status: "pending" })
    .returning({ id: walkinSessionsTable.id });

  res.json({ sessionId: session.id, alreadyCompleted: false, location: { id: location.id, name: location.name, chain: location.chain, type: location.type }, requiredSeconds: REQUIRED_SECONDS });
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
    const now = new Date();
    const updated = await tx
      .update(walkinSessionsTable)
      .set({ status: "completed", completedAt: now })
      .where(and(eq(walkinSessionsTable.id, sessionId), eq(walkinSessionsTable.userId, user.id), eq(walkinSessionsTable.status, "pending")))
      .returning();

    if (updated.length === 0) {
      return { error: "Sessione walk-in non trovata o già completata.", status: 404 };
    }

    const session = updated[0];
    const ageSeconds = (now.getTime() - session.startedAt.getTime()) / 1000;

    if (ageSeconds > MAX_AGE_SECONDS) {
      await tx.update(walkinSessionsTable).set({ status: "failed" }).where(eq(walkinSessionsTable.id, sessionId));
      return { error: `Sessione scaduta (${Math.round(ageSeconds / 60)} min). Avvia un nuovo walk-in.`, status: 400 };
    }

    if (ageSeconds < REQUIRED_SECONDS) {
      await tx.update(walkinSessionsTable).set({ status: "pending", completedAt: null }).where(eq(walkinSessionsTable.id, sessionId));
      return { error: "Non hai trascorso abbastanza tempo nel negozio.", status: 400, dwellSeconds: Math.round(ageSeconds), requiredSeconds: REQUIRED_SECONDS, remainingSeconds: Math.ceil(REQUIRED_SECONDS - ageSeconds) };
    }

    const [location] = await tx.select().from(locationsTable).where(eq(locationsTable.id, session.locationId)).limit(1);
    if (!location) {
      await tx.update(walkinSessionsTable).set({ status: "failed" }).where(eq(walkinSessionsTable.id, sessionId));
      return { error: "Negozio non trovato.", status: 404 };
    }

    const bucket = todayBucket();
    const typeLimit = WALKIN_DAILY_LIMIT[location.type];
    const dropsToAward = WALKIN_DROPS[location.type];

    // Serialize per-type cap checks across concurrent requests for different locations of the same type
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${user.id}, ${ADVISORY_KEY[location.type]})`);

    const completedOfType = await tx
      .select({ id: walkinCompletionsTable.id })
      .from(walkinCompletionsTable)
      .innerJoin(locationsTable, eq(walkinCompletionsTable.locationId, locationsTable.id))
      .where(and(eq(walkinCompletionsTable.userId, user.id), eq(walkinCompletionsTable.dayBucket, bucket), eq(locationsTable.type, location.type)));

    if (completedOfType.length >= typeLimit) {
      await tx.update(walkinSessionsTable).set({ status: "failed", xpAwarded: 0 }).where(eq(walkinSessionsTable.id, sessionId));
      return { success: false, alreadyCompleted: true, reason: "type_limit", message: `Limite giornaliero raggiunto per negozi di tipo "${location.type}".` };
    }

    const inserted = await tx
      .insert(walkinCompletionsTable)
      .values({ userId: user.id, locationId: location.id, sessionId: session.id, dayBucket: bucket, xpAwarded: dropsToAward })
      .onConflictDoNothing()
      .returning({ id: walkinCompletionsTable.id });

    if (inserted.length === 0) {
      await tx.update(walkinSessionsTable).set({ status: "failed", xpAwarded: 0 }).where(eq(walkinSessionsTable.id, sessionId));
      return { success: false, alreadyCompleted: true, reason: "location", message: "Hai già completato il walk-in in questo negozio oggi." };
    }

    await tx.update(walkinSessionsTable).set({ xpAwarded: dropsToAward }).where(eq(walkinSessionsTable.id, sessionId));
    const newDrops = await addDropsInTx(tx, user.id, dropsToAward);

    return {
      success: true,
      dropsAwarded: dropsToAward,
      locationType: location.type,
      locationName: location.name,
      dwellSeconds: Math.round(ageSeconds),
      newDrops,
      message: location.type === "oasi" ? `Benvenuto in un'Oasi Green! +${dropsToAward} drops per te.` : `Walk-in completato! +${dropsToAward} drops.`,
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
    .where(and(eq(discoveryChallengesTable.locationId, locationId), eq(discoveryChallengesTable.barcode, barcode), eq(discoveryChallengesTable.isActive, true)))
    .limit(1);

  if (!challenge) {
    res.status(404).json({ error: "Nessuna sfida Discovery attiva per questo prodotto in questo negozio.", found: false });
    return;
  }

  const bucket = todayBucket();

  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(discoveryCompletionsTable)
      .values({ userId: user.id, challengeId: challenge.id, dayBucket: bucket, xpAwarded: challenge.xpReward })
      .onConflictDoNothing()
      .returning({ id: discoveryCompletionsTable.id });

    if (inserted.length === 0) {
      return { success: false, alreadyCompleted: true, message: "Hai già completato questa sfida oggi." };
    }

    const newDrops = await addDropsInTx(tx, user.id, challenge.xpReward);
    return { success: true, found: true, dropsAwarded: challenge.xpReward, productName: challenge.productName, productDescription: challenge.productDescription, emoji: challenge.emoji, newDrops, message: `Trovato! +${challenge.xpReward} drops per aver trovato "${challenge.productName}".` };
  });

  res.json(result);
});

export default router;
