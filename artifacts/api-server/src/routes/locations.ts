import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 20;

router.get("/locations/nearby", async (req, res): Promise<void> => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const rawRadius = parseFloat((req.query.radius as string) ?? String(DEFAULT_RADIUS_KM));
  const radius = Math.min(rawRadius, MAX_RADIUS_KM);

  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "Parametri lat e lng richiesti (valori numerici validi)." });
    return;
  }
  if (!isFinite(rawRadius) || rawRadius <= 0) {
    res.status(400).json({ error: "Il parametro radius deve essere un numero positivo." });
    return;
  }

  const approxLatDelta = radius / 111;
  const approxLngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

  // Haversine distance in SQL + challenges via json_agg — single query, no N+1
  const rows = await db.execute(sql`
    SELECT
      l.id,
      l.name,
      l.chain,
      l.type,
      l.address,
      l.city,
      l.province,
      l.lat,
      l.lng,
      ROUND(
        (6371 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS(l.lat - ${lat}) / 2), 2)
          + COS(RADIANS(${lat})) * COS(RADIANS(l.lat))
            * POWER(SIN(RADIANS(l.lng - ${lng}) / 2), 2)
        )))::numeric,
        1
      ) AS distance_km,
      COALESCE(
        json_agg(
          json_build_object(
            'id',                 dc.id,
            'barcode',            dc.barcode,
            'productName',        dc.product_name,
            'productDescription', dc.product_description,
            'emoji',              dc.emoji,
            'dropsReward',        dc.xp_reward
          )
        ) FILTER (WHERE dc.id IS NOT NULL AND dc.is_active = TRUE),
        '[]'::json
      ) AS challenges
    FROM locations l
    LEFT JOIN discovery_challenges dc ON dc.location_id = l.id
    WHERE
      l.is_active = TRUE
      AND l.lat BETWEEN ${lat - approxLatDelta} AND ${lat + approxLatDelta}
      AND l.lng BETWEEN ${lng - approxLngDelta} AND ${lng + approxLngDelta}
    GROUP BY l.id, l.name, l.chain, l.type, l.address, l.city, l.province, l.lat, l.lng
    HAVING
      (6371 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(l.lat - ${lat}) / 2), 2)
        + COS(RADIANS(${lat})) * COS(RADIANS(l.lat))
          * POWER(SIN(RADIANS(l.lng - ${lng}) / 2), 2)
      ))) <= ${radius}
    ORDER BY distance_km ASC
  `);

  res.json({ locations: rows.rows, count: rows.rows.length });
});

export default router;
