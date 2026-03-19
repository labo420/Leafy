import { Router, type IRouter } from "express";
import { sql, eq, and } from "drizzle-orm";
import { db, locationsTable, discoveryChallengesTable } from "@workspace/db";

const router: IRouter = Router();

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get("/locations/nearby", async (req, res): Promise<void> => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseFloat((req.query.radius as string) ?? "20");

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: "Parametri lat e lng richiesti." });
    return;
  }

  const clampedRadius = Math.min(radius, 50);

  const approxLatDelta = clampedRadius / 111;
  const approxLngDelta = clampedRadius / (111 * Math.cos((lat * Math.PI) / 180));

  const locations = await db
    .select()
    .from(locationsTable)
    .where(
      and(
        eq(locationsTable.isActive, true),
        sql`${locationsTable.lat} BETWEEN ${lat - approxLatDelta} AND ${lat + approxLatDelta}`,
        sql`${locationsTable.lng} BETWEEN ${lng - approxLngDelta} AND ${lng + approxLngDelta}`,
      ),
    );

  const nearby = locations.filter(
    (loc) => haversineDistanceKm(lat, lng, loc.lat, loc.lng) <= clampedRadius,
  );

  const result = await Promise.all(
    nearby.map(async (loc) => {
      const challenges = await db
        .select()
        .from(discoveryChallengesTable)
        .where(
          and(
            eq(discoveryChallengesTable.locationId, loc.id),
            eq(discoveryChallengesTable.isActive, true),
          ),
        );

      return {
        id: loc.id,
        name: loc.name,
        chain: loc.chain,
        type: loc.type,
        address: loc.address,
        city: loc.city,
        province: loc.province,
        lat: loc.lat,
        lng: loc.lng,
        distanceKm: Math.round(haversineDistanceKm(lat, lng, loc.lat, loc.lng) * 10) / 10,
        challenges: challenges.map((ch) => ({
          id: ch.id,
          barcode: ch.barcode,
          productName: ch.productName,
          productDescription: ch.productDescription,
          emoji: ch.emoji,
          xpReward: ch.xpReward,
        })),
      };
    }),
  );

  result.sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({ locations: result, count: result.length });
});

export default router;
