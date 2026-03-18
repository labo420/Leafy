import app from "./app";
import { seedAllBadges } from "./seed-badges";
import { seedKits } from "./seed-kits";
import { cleanupExpiredReceiptImages } from "./lib/receiptImageCleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await seedAllBadges();
    await seedKits();
  } catch (e) {
    console.error("Failed to seed badges/kits:", e);
  }

  cleanupExpiredReceiptImages().catch(e =>
    console.error("[receipt-cleanup] Initial cleanup failed:", e)
  );

  setInterval(() => {
    cleanupExpiredReceiptImages().catch(e =>
      console.error("[receipt-cleanup] Scheduled cleanup failed:", e)
    );
  }, CLEANUP_INTERVAL_MS);
});
