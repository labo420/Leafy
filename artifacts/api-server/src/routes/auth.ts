import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateReferralCode } from "../lib/scanner";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const replitId = claims.sub as string;
  const firstName = (claims.first_name as string) || null;
  const lastName = (claims.last_name as string) || null;
  const email = (claims.email as string) || null;
  const profileImageUrl = (
    (claims.profile_image_url || claims.picture) as string | null
  ) || null;

  const username =
    [firstName, lastName].filter(Boolean).join(" ") ||
    email?.split("@")[0] ||
    "Utente Leafy";

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.replitId, replitId));

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({ username, email: email || existing.email })
      .where(eq(usersTable.replitId, replitId))
      .returning();
    return updated;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      replitId,
      username,
      email: email || "utente@leafy.app",
      totalPoints: 0,
      streak: 0,
      referralCode: generateReferralCode(),
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
    });
  } catch (err) {
    console.error("OIDC callback error:", err);
    res.redirect("/api/login");
    return;
  }

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  const firstName = (claims.first_name as string) || null;
  const lastName = (claims.last_name as string) || null;
  const profileImageUrl =
    ((claims.profile_image_url || claims.picture) as string | null) || null;

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: String(dbUser.id),
      email: dbUser.email,
      firstName,
      lastName,
      profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });

  try {
    const config = await getOidcConfig();
    const endSessionUrl = oidc.buildEndSessionUrl(config, {
      post_logout_redirect_uri: `${getOrigin(req)}/`,
    });
    res.redirect(endSessionUrl.href);
  } catch {
    res.redirect("/");
  }
});

export default router;
