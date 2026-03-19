import { eq, and } from "drizzle-orm";
import { db, locationsTable, discoveryChallengesTable } from "@workspace/db";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const locationsData: Array<{
  name: string;
  chain: string;
  type: "oasi" | "standard";
  address: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  challenges: Array<{
    barcode: string;
    productName: string;
    productDescription?: string;
    emoji: string;
    xpReward: number;
  }>;
}> = require("./data/locations.json");

export async function seedLocations() {
  let seeded = 0;
  let skipped = 0;

  for (const loc of locationsData) {
    const [existing] = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(and(eq(locationsTable.name, loc.name), eq(locationsTable.city, loc.city)))
      .limit(1);

    let locationId: number;

    if (existing) {
      locationId = existing.id;
      skipped++;
    } else {
      const [inserted] = await db
        .insert(locationsTable)
        .values({
          name: loc.name,
          chain: loc.chain,
          type: loc.type,
          address: loc.address,
          city: loc.city,
          province: loc.province,
          lat: loc.lat,
          lng: loc.lng,
          isActive: true,
        })
        .returning({ id: locationsTable.id });
      locationId = inserted.id;
      seeded++;
    }

    for (const ch of loc.challenges) {
      const [existingCh] = await db
        .select({ id: discoveryChallengesTable.id })
        .from(discoveryChallengesTable)
        .where(
          and(
            eq(discoveryChallengesTable.locationId, locationId),
            eq(discoveryChallengesTable.barcode, ch.barcode),
          ),
        )
        .limit(1);

      if (!existingCh) {
        await db.insert(discoveryChallengesTable).values({
          locationId,
          barcode: ch.barcode,
          productName: ch.productName,
          productDescription: ch.productDescription ?? null,
          emoji: ch.emoji,
          xpReward: ch.xpReward,
          isActive: true,
        });
      }
    }
  }

  console.log(`[seed-locations] Locations seeded: ${seeded}, skipped (already exist): ${skipped}`);
}
