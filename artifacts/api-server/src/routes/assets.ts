import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.get("/assets/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await pool.query(
      "SELECT data, mime_type FROM assets WHERE name = $1",
      [name],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Asset not found" });
    }
    const { data, mime_type } = result.rows[0];
    res.set("Content-Type", mime_type);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(data);
  } catch (err) {
    console.error("Error serving asset:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
