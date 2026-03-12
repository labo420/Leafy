import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, greenProductsTable } from "@workspace/db";
import { GetProductsResponse, GetProductsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const queryParams = GetProductsQueryParams.safeParse(req.query);
  const category = queryParams.success ? queryParams.data.category : undefined;

  const allProducts = await db.select().from(greenProductsTable);
  const filtered = category
    ? allProducts.filter(p => p.category === category)
    : allProducts;

  res.json(GetProductsResponse.parse(filtered.map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    certifications: p.certifications,
    sustainabilityScore: p.sustainabilityScore,
    pointsValue: p.pointsValue,
    emoji: p.emoji,
    description: p.description,
  }))));
});

export default router;
