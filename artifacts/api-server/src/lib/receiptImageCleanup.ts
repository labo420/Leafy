import { db, receiptsTable } from "@workspace/db";
import { isNotNull, lte, eq, and } from "drizzle-orm";
import { deleteReceiptImage } from "./receiptImages";

export async function cleanupExpiredReceiptImages(): Promise<number> {
  const now = new Date();

  const toClean = await db
    .select({ id: receiptsTable.id, imageUrl: receiptsTable.imageUrl })
    .from(receiptsTable)
    .where(and(
      isNotNull(receiptsTable.imageUrl),
      lte(receiptsTable.imageExpiresAt, now),
    ));

  let cleaned = 0;
  for (const receipt of toClean) {
    try {
      const deleted = await deleteReceiptImage(receipt.imageUrl!);
      if (deleted) {
        await db
          .update(receiptsTable)
          .set({ imageUrl: null, imageExpiresAt: null })
          .where(eq(receiptsTable.id, receipt.id));
        cleaned++;
      }
    } catch (e) {
      console.error(`[receipt-cleanup] Failed to clean receipt ${receipt.id}:`, e);
    }
  }

  if (cleaned > 0) {
    console.log(`[receipt-cleanup] Cleaned ${cleaned} expired receipt images`);
  }

  return cleaned;
}
