import { db, receiptsTable } from "@workspace/db";
import { isNotNull, lte, eq } from "drizzle-orm";
import { deleteReceiptImage } from "./receiptImages";

export async function cleanupExpiredReceiptImages(): Promise<number> {
  const now = new Date();

  const expiredReceipts = await db
    .select({ id: receiptsTable.id, imageUrl: receiptsTable.imageUrl })
    .from(receiptsTable)
    .where(lte(receiptsTable.imageExpiresAt, now));

  const toClean = expiredReceipts.filter(r => r.imageUrl !== null);

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
