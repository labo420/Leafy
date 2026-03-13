import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import passport from "passport";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";

const app: Express = express();

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(authMiddleware);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(process.cwd(), "artifacts/leafy/dist/public");
  app.use(express.static(staticDir));
  app.get(/(.*)/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[unhandled error]", err?.message ?? err, err?.stack);
  res.status(500).json({ error: "Errore interno del server. Riprova tra poco." });
});

export default app;
