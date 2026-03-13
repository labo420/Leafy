import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import fs from "fs";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/expo-tunnel", (_req, res) => {
  try {
    const url = fs.readFileSync("/tmp/expo-tunnel-url.txt", "utf8").trim();
    res.json({ url });
  } catch {
    res.json({ url: null });
  }
});

export default router;
