import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { GetLeaderboardResponse, GetLeaderboardQueryParams } from "@workspace/api-zod";
import { requireUser } from "./profile";

const router: IRouter = Router();

router.get("/leaderboard", async (req, res): Promise<void> => {
  const queryParams = GetLeaderboardQueryParams.safeParse(req.query);
  const _type = queryParams.success ? queryParams.data.type ?? "points" : "points";

  const user = await requireUser(req, res);
  if (!user) return;

  const allUsers = await db.select().from(usersTable);

  const FAKE_USERS = [
    { id: 101, username: "GreenStar", totalPoints: 3420, streak: 12 },
    { id: 102, username: "EcoLucia", totalPoints: 2810, streak: 8 },
    { id: 103, username: "BioPaolo", totalPoints: 2100, streak: 5 },
    { id: 104, username: "KmZeroFan", totalPoints: 1850, streak: 15 },
    { id: 105, username: "VerdeAnna", totalPoints: 1600, streak: 3 },
    { id: 106, username: "PlasticFree99", totalPoints: 1200, streak: 6 },
    { id: 107, username: "LeafyFan", totalPoints: 980, streak: 2 },
    { id: 108, username: "NaturaViva", totalPoints: 750, streak: 4 },
    { id: 109, username: "EcoMario", totalPoints: 620, streak: 1 },
  ];

  const combined = [
    ...allUsers.map(u => ({ id: u.id, username: u.username, totalPoints: u.totalPoints, streak: u.streak })),
    ...FAKE_USERS,
  ];

  combined.sort((a, b) => b.totalPoints - a.totalPoints);

  const entries = combined.slice(0, 10).map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    username: u.username,
    level: u.totalPoints >= 5000 ? "Platino" : u.totalPoints >= 2000 ? "Oro" : u.totalPoints >= 500 ? "Argento" : "Bronzo",
    score: u.totalPoints,
    co2SavedKg: Math.round(u.totalPoints * 0.008 * 100) / 100,
    isCurrentUser: u.id === user.id,
  }));

  res.json(GetLeaderboardResponse.parse(entries));
});

export default router;
