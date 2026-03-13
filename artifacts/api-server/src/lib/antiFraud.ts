import { db, receiptsTable, usersTable } from "@workspace/db";
import { eq, and, gte, ne, sql } from "drizzle-orm";
import type { User } from "@workspace/db";

export const ANTI_FRAUD = {
  MAX_RECEIPT_AGE_DAYS: 7,
  MAX_SCANS_PER_DAY: 10,
  MAX_POINTS_PER_DAY: 200,
  NEW_ACCOUNT_DAYS_STRICT: 7,
  NEW_ACCOUNT_DAYS_REDUCED: 30,
  NEW_ACCOUNT_MULTIPLIER_STRICT: 0.5,
  NEW_ACCOUNT_MULTIPLIER_REDUCED: 0.7,
  STAGING_THRESHOLD_DAYS: 7,
  HIGH_VALUE_SCAN_THRESHOLD: 80,
} as const;

export type AntiFraudResult =
  | { ok: true; points: number; status: "approved" | "pending"; flagReason?: string; warnings: string[] }
  | { ok: false; error: string };

export async function runAntiFraudChecks(
  user: User,
  imageHash: string,
  purchaseDate: Date | string | null | undefined,
  rawPoints: number,
): Promise<AntiFraudResult> {
  const warnings: string[] = [];
  const now = new Date();

  // ── 1. Receipt date validation (max 7 days) ──────────────────────────────
  if (purchaseDate) {
    const parsed = purchaseDate instanceof Date ? purchaseDate : parsePurchaseDate(purchaseDate);
    if (parsed) {
      const ageMs = now.getTime() - parsed.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 0) {
        return { ok: false, error: "La data dello scontrino è nel futuro. Anti-frode attivo." };
      }
      if (ageDays > ANTI_FRAUD.MAX_RECEIPT_AGE_DAYS) {
        return {
          ok: false,
          error: `Scontrino troppo vecchio (${Math.floor(ageDays)} giorni). Accettiamo solo scontrini degli ultimi ${ANTI_FRAUD.MAX_RECEIPT_AGE_DAYS} giorni.`,
        };
      }
    }
  }

  // ── 2. Cross-user duplicate detection (same image hash any user) ─────────
  const [crossUserDuplicate] = await db
    .select({ id: receiptsTable.id, userId: receiptsTable.userId })
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.imageHash, imageHash),
        ne(receiptsTable.userId, user.id),
      ),
    )
    .limit(1);

  if (crossUserDuplicate) {
    return {
      ok: false,
      error: "Questo scontrino è già stato scansionato da un altro utente. Anti-frode attivo.",
    };
  }

  // ── 3. Rate limiting: max 10 scans per 24h ───────────────────────────────
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [scanCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.userId, user.id),
        gte(receiptsTable.scannedAt, oneDayAgo),
      ),
    );

  const scansToday = scanCountRow?.count ?? 0;
  if (scansToday >= ANTI_FRAUD.MAX_SCANS_PER_DAY) {
    return {
      ok: false,
      error: `Hai raggiunto il limite di ${ANTI_FRAUD.MAX_SCANS_PER_DAY} scansioni al giorno. Riprova domani!`,
    };
  }

  // ── 4. Daily points cap: max 200 pts per 24h ────────────────────────────
  const [pointsSumRow] = await db
    .select({ total: sql<number>`coalesce(sum(points_earned), 0)::int` })
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.userId, user.id),
        gte(receiptsTable.scannedAt, oneDayAgo),
        eq(receiptsTable.status, "approved"),
      ),
    );

  const pointsEarnedToday = pointsSumRow?.total ?? 0;
  const remainingCapToday = ANTI_FRAUD.MAX_POINTS_PER_DAY - pointsEarnedToday;

  if (remainingCapToday <= 0) {
    return {
      ok: false,
      error: `Hai raggiunto il limite di ${ANTI_FRAUD.MAX_POINTS_PER_DAY} punti al giorno. Torna domani per guadagnarne altri!`,
    };
  }

  // ── 5. Account reputation multiplier ────────────────────────────────────
  const accountAgeDays = (now.getTime() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  let multiplier = 1.0;
  let reputationNote: string | undefined;

  if (accountAgeDays < ANTI_FRAUD.NEW_ACCOUNT_DAYS_STRICT) {
    multiplier = ANTI_FRAUD.NEW_ACCOUNT_MULTIPLIER_STRICT;
    reputationNote = `Account nuovo (moltiplicatore punti: 50%) — cresce entro ${ANTI_FRAUD.NEW_ACCOUNT_DAYS_REDUCED} giorni`;
  } else if (accountAgeDays < ANTI_FRAUD.NEW_ACCOUNT_DAYS_REDUCED) {
    multiplier = ANTI_FRAUD.NEW_ACCOUNT_MULTIPLIER_REDUCED;
    reputationNote = `Account in crescita (moltiplicatore punti: 70%) — diventa 100% dopo ${ANTI_FRAUD.NEW_ACCOUNT_DAYS_REDUCED} giorni`;
  }

  if (reputationNote) warnings.push(reputationNote);

  // ── 6. Apply cap and multiplier ──────────────────────────────────────────
  let finalPoints = Math.floor(rawPoints * multiplier);
  finalPoints = Math.min(finalPoints, remainingCapToday);
  finalPoints = Math.max(finalPoints, 0);

  // ── 7. Points staging for very new accounts ──────────────────────────────
  const isNewAccount = accountAgeDays < ANTI_FRAUD.STAGING_THRESHOLD_DAYS;
  const status: "approved" | "pending" = isNewAccount ? "pending" : "approved";
  if (isNewAccount) {
    warnings.push("Punti in attesa di approvazione (account nuovo — approvati automaticamente dopo 48h)");
  }

  // ── 8. Flag suspicious patterns ──────────────────────────────────────────
  let flagReason: string | undefined;

  if (finalPoints >= ANTI_FRAUD.HIGH_VALUE_SCAN_THRESHOLD) {
    flagReason = `Scansione ad alto valore (${finalPoints} punti) — revisione automatica`;
    warnings.push("Scansione inviata in revisione per alto valore");
  }

  if (scansToday >= 7) {
    const existingFlag = flagReason ? `${flagReason}; ` : "";
    flagReason = `${existingFlag}Molte scansioni oggi (${scansToday + 1}/${ANTI_FRAUD.MAX_SCANS_PER_DAY})`;
    warnings.push("Attività intensa rilevata — controlla la tua casella notifiche");
  }

  return { ok: true, points: finalPoints, status, flagReason, warnings };
}

function parsePurchaseDate(dateStr: string): Date | null {
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];

  for (const pattern of patterns) {
    const m = dateStr.match(pattern);
    if (m) {
      const [, a, b, c] = m;
      const isYearFirst = pattern === patterns[0];
      const year = parseInt(isYearFirst ? a : c, 10);
      const month = parseInt(isYearFirst ? b : b, 10) - 1;
      const day = parseInt(isYearFirst ? c : a, 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const generic = new Date(dateStr);
  return isNaN(generic.getTime()) ? null : generic;
}

export async function approvePendingPoints(): Promise<number> {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const pendingReceipts = await db
    .select()
    .from(receiptsTable)
    .where(
      and(
        eq(receiptsTable.status, "pending"),
        sql`${receiptsTable.scannedAt} <= ${twoDaysAgo}`,
      ),
    );

  let approvedCount = 0;
  for (const receipt of pendingReceipts) {
    await db
      .update(receiptsTable)
      .set({ status: "approved" })
      .where(eq(receiptsTable.id, receipt.id));

    await db
      .update(usersTable)
      .set({
        totalPoints: sql`total_points + ${receipt.pointsEarned}`,
        pendingPoints: sql`greatest(pending_points - ${receipt.pointsEarned}, 0)`,
      })
      .where(eq(usersTable.id, receipt.userId));

    approvedCount++;
  }

  return approvedCount;
}
