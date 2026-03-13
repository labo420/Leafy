import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import bcryptjs from "bcryptjs";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable, oauthAccountsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { generateReferralCode } from "../lib/scanner";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

const router: IRouter = Router();

function getOrigin(req: Request): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
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

function makeLocalSession(dbUser: { id: number; email: string; username: string }): SessionData {
  const nameParts = dbUser.username.split(" ");
  return {
    user: {
      id: String(dbUser.id),
      email: dbUser.email,
      firstName: nameParts[0] ?? dbUser.username,
      lastName: nameParts.slice(1).join(" ") || null,
      profileImageUrl: null,
    },
    access_token: "",
  };
}

async function upsertSocialUser(
  provider: string,
  providerAccountId: string,
  profile: { email?: string | null; displayName?: string | null },
): Promise<{ id: number; email: string; username: string }> {
  const [existing] = await db
    .select()
    .from(oauthAccountsTable)
    .where(
      and(
        eq(oauthAccountsTable.provider, provider),
        eq(oauthAccountsTable.providerAccountId, providerAccountId),
      ),
    );

  if (existing) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, existing.userId));
    return user;
  }

  let user: { id: number; email: string; username: string } | undefined;

  if (profile.email) {
    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, profile.email));
    user = byEmail;
  }

  if (!user) {
    const username =
      profile.displayName ||
      profile.email?.split("@")[0] ||
      "Utente Leafy";
    const [newUser] = await db
      .insert(usersTable)
      .values({
        username,
        email: profile.email || "utente@leafy.app",
        totalPoints: 0,
        streak: 0,
        referralCode: generateReferralCode(),
      })
      .returning();
    user = newUser;
  }

  await db
    .insert(oauthAccountsTable)
    .values({ userId: user.id, provider, providerAccountId })
    .onConflictDoNothing();

  return user;
}

async function upsertReplitUser(claims: Record<string, unknown>) {
  const replitId = claims.sub as string;
  const firstName = (claims.first_name as string) || null;
  const lastName = (claims.last_name as string) || null;
  const email = (claims.email as string) || null;

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

// ─── Configure social strategies (lazily, only if env vars set) ──────────────

function configureGoogleStrategy(callbackURL: string) {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientID || !clientSecret) return false;
  passport.use(
    "google",
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL, passReqToCallback: false },
      (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value ?? null;
        upsertSocialUser("google", profile.id, {
          email,
          displayName: profile.displayName,
        })
          .then((user) => done(null, user))
          .catch((err) => done(err));
      },
    ),
  );
  return true;
}

function configureFacebookStrategy(callbackURL: string) {
  const clientID = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;
  if (!clientID || !clientSecret) return false;
  passport.use(
    "facebook",
    new FacebookStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        profileFields: ["id", "emails", "displayName"],
        passReqToCallback: false,
      },
      (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value ?? null;
        upsertSocialUser("facebook", profile.id, {
          email,
          displayName: profile.displayName,
        })
          .then((user) => done(null, user))
          .catch((err) => done(err));
      },
    ),
  );
  return true;
}

// ─── GET /auth/user ──────────────────────────────────────────────────────────

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/auth/me", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// ─── POST /auth/register ─────────────────────────────────────────────────────

router.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password, username } = req.body as Record<string, unknown>;

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof username !== "string" ||
    !email.trim() ||
    !password ||
    !username.trim()
  ) {
    res.status(400).json({ error: "Email, username e password sono obbligatori." });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "La password deve essere di almeno 8 caratteri." });
    return;
  }

  const [existingByEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()));

  if (existingByEmail) {
    res.status(409).json({ error: "Esiste già un account con questa email." });
    return;
  }

  const passwordHash = await bcryptjs.hash(password, BCRYPT_ROUNDS);

  const [newUser] = await db
    .insert(usersTable)
    .values({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      totalPoints: 0,
      streak: 0,
      referralCode: generateReferralCode(),
    })
    .returning();

  const sessionData = makeLocalSession(newUser);
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json({ user: sessionData.user, sid });
});

// ─── POST /auth/login ────────────────────────────────────────────────────────

router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as Record<string, unknown>;

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email e password sono obbligatorie." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()));

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Credenziali non valide." });
    return;
  }

  const valid = await bcryptjs.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenziali non valide." });
    return;
  }

  const sessionData = makeLocalSession(user);
  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.json({ user: sessionData.user, sid });
});

// ─── GET /auth/google ────────────────────────────────────────────────────────

router.get("/auth/google", (req: Request, res: Response) => {
  const callbackURL = `${getOrigin(req)}/api/auth/google/callback`;
  const ok = configureGoogleStrategy(callbackURL);
  if (!ok) {
    res.status(503).json({ error: "Google login non configurato." });
    return;
  }
  if (req.query.mobile === "1") {
    res.cookie("auth_mobile", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 10 * 60 * 1000 });
  }
  passport.authenticate("google", {
    session: false,
    scope: ["openid", "email", "profile"],
  })(req, res, () => {});
});

router.get("/auth/google/callback", (req: Request, res: Response) => {
  const callbackURL = `${getOrigin(req)}/api/auth/google/callback`;
  const isMobile = req.query.mobile === "1" || req.cookies?.auth_mobile === "1";
  configureGoogleStrategy(callbackURL);
  passport.authenticate(
    "google",
    { session: false, failureRedirect: "/?auth_error=google" },
    async (_err: unknown, user: { id: number; email: string; username: string } | false) => {
      if (!user) {
        if (isMobile) {
          res.clearCookie("auth_mobile", { path: "/" });
          res.redirect("leafy-mobile://auth?error=google");
          return;
        }
        res.redirect("/?auth_error=google");
        return;
      }
      const sessionData = makeLocalSession(user);
      const sid = await createSession(sessionData);
      setSessionCookie(res, sid);
      if (isMobile) {
        res.clearCookie("auth_mobile", { path: "/" });
        res.redirect(`leafy-mobile://auth?sid=${sid}`);
        return;
      }
      res.redirect("/");
    },
  )(req, res, () => {});
});

// ─── GET /auth/facebook ──────────────────────────────────────────────────────

router.get("/auth/facebook", (req: Request, res: Response) => {
  const callbackURL = `${getOrigin(req)}/api/auth/facebook/callback`;
  const ok = configureFacebookStrategy(callbackURL);
  if (!ok) {
    res.status(503).json({ error: "Facebook login non configurato." });
    return;
  }
  if (req.query.mobile === "1") {
    res.cookie("auth_mobile", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 10 * 60 * 1000 });
  }
  passport.authenticate("facebook", {
    session: false,
    scope: ["email"],
  })(req, res, () => {});
});

router.get("/auth/facebook/callback", (req: Request, res: Response) => {
  const callbackURL = `${getOrigin(req)}/api/auth/facebook/callback`;
  const isMobile = req.query.mobile === "1" || req.cookies?.auth_mobile === "1";
  configureFacebookStrategy(callbackURL);
  passport.authenticate(
    "facebook",
    { session: false, failureRedirect: "/?auth_error=facebook" },
    async (_err: unknown, user: { id: number; email: string; username: string } | false) => {
      if (!user) {
        if (isMobile) {
          res.clearCookie("auth_mobile", { path: "/" });
          res.redirect("leafy-mobile://auth?error=facebook");
          return;
        }
        res.redirect("/?auth_error=facebook");
        return;
      }
      const sessionData = makeLocalSession(user);
      const sid = await createSession(sessionData);
      setSessionCookie(res, sid);
      if (isMobile) {
        res.clearCookie("auth_mobile", { path: "/" });
        res.redirect(`leafy-mobile://auth?sid=${sid}`);
        return;
      }
      res.redirect("/");
    },
  )(req, res, () => {});
});

// ─── GET /login  (Replit OIDC) ───────────────────────────────────────────────

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

// ─── GET /callback  (Replit OIDC) ────────────────────────────────────────────

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

  const dbUser = await upsertReplitUser(claims as unknown as Record<string, unknown>);

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
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);

  res.redirect(returnTo);
});

// ─── GET /logout ─────────────────────────────────────────────────────────────

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  let isOidcSession = false;

  if (sid) {
    const session = await getSession(sid);
    if (session && session.user && "access_token" in session && session.access_token) {
      isOidcSession = true;
    }
    await deleteSession(sid);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });

  if (isOidcSession) {
    try {
      const config = await getOidcConfig();
      const endSessionUrl = oidc.buildEndSessionUrl(config, {
        post_logout_redirect_uri: `${getOrigin(req)}/`,
      });
      res.redirect(endSessionUrl.href);
      return;
    } catch {
      // Fallthrough to simple redirect
    }
  }

  res.redirect("/");
});

export default router;
