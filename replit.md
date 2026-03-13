# Leafy — Sustainability Loyalty Platform

## Panoramica del Progetto

Leafy è una piattaforma loyalty mobile-first per la sostenibilità. Gli utenti scansionano scontrini della spesa, guadagnano punti per prodotti green (Bio, Km 0, Plastic-free, Fairtrade, Vegano, DOP/IGP), salgono di livello (Bronzo → Argento → Oro → Platino), completano sfide mensili e riscattano voucher nel marketplace.

**Stato attuale**: App funzionante con autenticazione multi-provider reale (email/password + Google OAuth + Facebook OAuth + Replit OIDC).

---

## Environment Variables / Secrets Necessari

| Variabile | Obbligatoria | Descrizione |
|-----------|-------------|-------------|
| `DATABASE_URL` | ✅ Sì | PostgreSQL connection string (fornita automaticamente da Replit) |
| `GOOGLE_CLIENT_ID` | Auth Google | OAuth 2.0 Client ID da Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Auth Google | OAuth 2.0 Client Secret da Google Cloud Console |
| `FACEBOOK_APP_ID` | Auth Facebook | App ID da Facebook Developers |
| `FACEBOOK_APP_SECRET` | Auth Facebook | App Secret da Facebook Developers |
| `GOOGLE_CLOUD_VISION_API_KEY` | Consigliata | Google Vision API per OCR scontrini. Senza, usa keyword matching. |
| `ADMIN_PASSWORD` | No | Password pannello admin. Default: `leafy2026` |
| `SESSION_SECRET` | Produzione | Segreto per la firma dei cookie di sessione |

Per impostare i secrets su Replit: **Tools → Secrets**.

> **Nota Google OAuth**: l'app è in modalità "Testing". L'utente dev deve aggiungersi come Test User in Google Cloud Console → OAuth Consent Screen → Test Users, altrimenti riceve errore 403.

---

## Come Avviare il Progetto

### Dev (Development)

```bash
# Installa dipendenze
pnpm install

# Sincronizza schema DB (prima esecuzione o dopo modifiche allo schema)
psql "$DATABASE_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;"
# oppure: pnpm --filter @workspace/db run push (richiede interazione)

# Avvia tutto insieme (workflow Replit)
PORT=8080 pnpm --filter @workspace/api-server run dev & PORT=5000 BASE_PATH=/ pnpm --filter @workspace/leafy run dev
```

I workflow Replit gestiscono questi comandi automaticamente.

### Build Produzione

```bash
PORT=80 BASE_PATH=/ pnpm --filter @workspace/leafy run build
pnpm --filter @workspace/api-server run build
# Poi avviare: node artifacts/api-server/dist/index.cjs
```

Il frontend viene servito come file statici dall'API server in produzione (Express serve `artifacts/leafy/dist/public/`).

---

## Stack Tecnologico

| Layer | Tecnologia |
|-------|-----------|
| Monorepo | pnpm workspaces |
| Node.js | v24 |
| TypeScript | 5.9 (composite projects) |
| API Framework | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| API Codegen | Orval (da OpenAPI spec) |
| Frontend | React + Vite + Tailwind v4 |
| UI Components | shadcn/ui |
| Animazioni | Framer Motion |
| State/Query | TanStack React Query |
| Routing | Wouter |
| Mobile | Expo SDK 54, React Native 0.81, expo-router 6 |
| Auth | Passport.js (Google, Facebook), openid-client (Replit OIDC), bcryptjs |
| Sessioni | Cookie (web) + Bearer token via expo-secure-store (mobile) |
| Fonts | DM Sans (display), Inter (body) |
| Build | esbuild (CJS), Vite |

---

## Struttura del Monorepo

```text
workspace/
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   ├── src/
│   │   │   ├── app.ts       # Express app, CORS, routes mount, static serving
│   │   │   ├── index.ts     # Entry point — legge PORT, avvia server
│   │   │   ├── routes/
│   │   │   │   ├── index.ts
│   │   │   │   ├── auth.ts       # Login/register email, Google OAuth, Facebook OAuth, Replit OIDC, logout
│   │   │   │   ├── profile.ts    # GET/PUT profilo, requireUser middleware
│   │   │   │   ├── receipts.ts   # GET scontrini (lista + dettaglio con greenItems)
│   │   │   │   ├── scan.ts       # POST scan: OCR + keyword parser + punti + sfide
│   │   │   │   ├── challenges.ts
│   │   │   │   ├── leaderboard.ts
│   │   │   │   ├── marketplace.ts
│   │   │   │   └── admin.ts      # Admin panel backend (password protected)
│   │   │   └── lib/
│   │   │       ├── scanner.ts    # Google Vision OCR + fallback keyword matching
│   │   │       └── auth.ts       # Session store, getSession, createSession, clearSession
│   │   └── package.json
│   ├── leafy/               # Frontend React/Vite
│   │   ├── src/
│   │   │   ├── App.tsx          # Router principale, auth guard, route setup
│   │   │   ├── index.css        # Tema Leafy (CSS variables)
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx        # Login/registrazione email + social (Google, Facebook)
│   │   │   │   ├── Home.tsx         # Dashboard: punti, progress ring, impatto
│   │   │   │   ├── Scan.tsx         # Camera + upload scontrino + report risultato
│   │   │   │   ├── History.tsx      # Storico scontrini + bottom sheet dettaglio
│   │   │   │   ├── Marketplace.tsx  # Voucher e premi riscattabili
│   │   │   │   ├── Profile.tsx      # Profilo, foto, sfide, badge, invita amici
│   │   │   │   ├── Settings.tsx     # Impostazioni: username, notifiche, privacy, logout, cancella account
│   │   │   │   └── Admin.tsx        # Pannello admin (/admin)
│   │   │   └── components/
│   │   │       ├── layout/
│   │   │       │   ├── AppLayout.tsx   # Shell layout con BottomNav
│   │   │       │   └── BottomNav.tsx   # Nav bar fissa in basso (fixed)
│   │   │       └── shared/
│   │   │           ├── LevelProgress.tsx  # Cerchio SVG progress animato
│   │   │           ├── LeafAnimation.tsx  # Animazione foglie post-scansione
│   │   │           └── Onboarding.tsx     # Modal primo accesso (4 step + esplosione botanical)
│   │   └── package.json
│   ├── leafy-mobile/         # Expo React Native mobile app
│   │   ├── app/
│   │   │   ├── _layout.tsx      # Root layout, deep link handler, AuthProvider
│   │   │   ├── login.tsx        # Login/register email + Google + Facebook
│   │   │   └── (tabs)/
│   │   │       ├── _layout.tsx  # Tab navigator (Home, Scan, Storico, Premi, Profilo)
│   │   │       ├── index.tsx    # Home dashboard
│   │   │       ├── scan.tsx     # Receipt scanner
│   │   │       ├── storico.tsx  # Receipt history
│   │   │       ├── marketplace.tsx # Voucher marketplace
│   │   │       └── profilo.tsx  # User profile + logout
│   │   ├── context/auth.tsx     # Auth context (login, register, OAuth, logout)
│   │   ├── lib/api.ts           # apiFetch with Bearer token from SecureStore
│   │   ├── constants/colors.ts  # Forest/green theme colors
│   │   └── components/DevConnect.tsx # QR code overlay for Expo Go tunnel
│   └── mockup-sandbox/      # Sandbox mockup per canvas Replit
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec + Orval config
│   ├── api-client-react/    # React Query hooks generati (useGetProfile, useGetReceipt, ecc.)
│   ├── api-zod/             # Zod schemas generati dall'OpenAPI
│   ├── db/                  # Drizzle ORM schema + connessione PostgreSQL
│   └── replit-auth-web/     # Hook useAuth (login, logout, user state)
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

---

## Pagine e Route Frontend

| Route | Pagina | Descrizione |
|-------|--------|-------------|
| `/` | `Home.tsx` | Dashboard: punti, cerchio livello, impatto CO2 |
| `/scan` | `Scan.tsx` | Scanner scontrino + report prodotti trovati |
| `/storico` | `History.tsx` | Lista scontrini + bottom sheet dettaglio per scontrino |
| `/marketplace` | `Marketplace.tsx` | Voucher e premi riscattabili |
| `/profilo` | `Profile.tsx` | Profilo utente, foto, sfide, badge, codice invito |
| `/impostazioni` | `Settings.tsx` | Username, notifiche, privacy, logout, cancella account |
| `/admin` | `Admin.tsx` | Pannello admin (non usa AppLayout) |

---

## API Endpoints

Base URL: `/api`

### Auth
| Endpoint | Descrizione |
|----------|-------------|
| `POST /api/auth/login` | Login email/password → imposta cookie sessione |
| `POST /api/auth/register` | Registrazione email/password |
| `GET /api/auth/google` | Avvia OAuth Google |
| `GET /api/auth/google/callback` | Callback OAuth Google |
| `GET /api/auth/facebook` | Avvia OAuth Facebook |
| `GET /api/auth/facebook/callback` | Callback OAuth Facebook |
| `GET /api/login` | Avvia Replit OIDC |
| `GET /api/logout` | Termina sessione → redirect `/` |
| `GET /api/auth/user` | Restituisce utente autenticato corrente |

### Profilo e Account
| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/profile` | Profilo utente (livello, badge, sfide) |
| `PUT /api/profile/username` | Aggiorna nome utente (3-30 caratteri) |
| `PUT /api/profile/image` | Aggiorna foto profilo (base64, max 2MB) |
| `DELETE /api/profile/account` | Cancella account e tutti i dati |
| `GET /api/profile/impact` | Statistiche impatto ambientale |
| `GET /api/profile/referral` | Dati codice referral |
| `POST /api/profile/referral/apply` | Applica codice referral |

### Scontrini e Scan
| Endpoint | Descrizione |
|----------|-------------|
| `POST /api/scan` | Scansiona scontrino (base64 img → punti + report) |
| `GET /api/receipts` | Lista scontrini dell'utente |
| `GET /api/receipts/:id` | Dettaglio scontrino con greenItems (keyword, categoria, punti) |

### Altro
| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/challenges` | Sfide mensili attive con progress utente |
| `GET /api/leaderboard` | Classifica utenti |
| `GET /api/marketplace/vouchers` | Voucher disponibili |
| `POST /api/marketplace/vouchers/:id/redeem` | Riscatta voucher |
| `GET /api/admin/*` | Rotte admin (header `x-admin-password` richiesto) |

---

## Funzionalità Implementate

### Autenticazione
- **Email/Password**: Registrazione + login con bcryptjs (12 rounds)
- **Google OAuth**: via Passport.js `passport-google-oauth20`
- **Facebook OAuth**: via Passport.js `passport-facebook`
- **Replit OIDC**: via `openid-client`
- **Sessioni**: cookie `sid` httpOnly/secure, TTL 7 giorni, store in-memory
- **Auth guard**: `App.tsx` mostra `Login.tsx` se non autenticato

### Profilo Utente
- **Cambio username** inline nelle Impostazioni (matita editabile)
- **Cambio foto profilo** con upload da galleria/camera (base64 nel DB)
- **Cancella account** con modal di conferma (azione irreversibile)
- **Logout** funzionante per sessioni locali e OIDC

### Scanner Scontrini
- Upload foto scontrino → OCR Google Vision (se API key presente) → keyword matching
- Report risultato post-scansione con lista prodotti green
- **Bottom sheet dettaglio** in Storico: clicca uno scontrino per vedere prodotti rilevati, keyword, categoria, punti e spiegazione logica
- Anti-frode: hash immagine per prevenire doppia scansione

### Gamification
- **Livelli**: Bronzo (0) → Argento (500) → Oro (2000) → Platino (5000 pts)
- **Sfide mensili**: progress tracking per categoria, punti bonus al completamento
- **Badge**: sbloccati in base alle attività (prima scansione, categorie, streak, punti)
- **Streak giornaliero**: incrementa ad ogni giorno con almeno una scansione
- **Codice invito**: +500 punti per invitante e invitato

### UX e Design
- **Onboarding**: esplosione botanical 🌿 (70 particelle) + card 4-step solo dopo prima registrazione
- **Bottom nav fissa** con indicatore animato
- **Tema**: verde foresta + menta + ambra su crema
- **Admin panel**: `/admin` con stats, CRUD voucher/sfide

---

## Schema Database

### `users`
```
id, replit_id, password_hash, username, email, profile_image_url,
total_points, streak, last_scan_date, referral_code, referral_count,
referral_points_earned, created_at, updated_at
```

### `oauth_accounts`
```
id, user_id (FK), provider, provider_account_id, created_at
```
Indice unico su `(provider, provider_account_id)`.

### `receipts`
```
id, user_id (FK), store_name, purchase_date, image_hash, raw_text,
points_earned, green_items_count, categories[], green_items_json, scanned_at
```
`green_items_json` = array JSON di `{ name, category, points, emoji }`.

### `challenges`, `challenge_progress`, `vouchers`, `redeemed_vouchers`
Schema gestito da Drizzle ORM in `lib/db/src/schema/`.

---

## Dettagli Tecnici Importanti

### Express 5 — Wildcard Route Fix
```ts
app.get(/(.*)/,  handler)  // ✅ Corretto per Express 5
// NON: app.get("*", handler)  // ❌ genera errore pathToRegexp
```

### Autenticazione — Flusso Sessioni
- **Login locale** (email/password, Google, Facebook): `createSession()` scrive sessione in-memory, imposta cookie `sid`
- **Logout locale**: `clearSession()` + cancella cookie → redirect `/`
- **Replit OIDC**: usa `access_token` reale; logout chiama endpoint OIDC session end

### `profile_image_url` — Migrazione Manuale
La colonna è stata aggiunta dopo la creazione iniziale. Se il DB non la contiene:
```bash
psql "$DATABASE_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;"
```

### Onboarding localStorage
- Chiave: `leafy_onboarded`
- Impostata a `"1"` dopo login → card non appare
- Rimossa dopo registrazione → card appare una volta sola

### Zod / Orval Date Bug
Orval con `useDates: true` genera schemi Zod che si aspettano oggetti `Date`, **non** stringhe ISO. Non chiamare `.toISOString()` prima di passare dati a `.parse()`.

### TypeScript Composite
- Typechecking da root: `pnpm run typecheck`
- Non eseguire `tsc` dentro un singolo pacchetto (fallisce se deps non sono buildate)

---

## Design Tokens (index.css)

```css
--background: 75 25% 96%;      /* Crema chiaro */
--foreground: 158 25% 14%;     /* Charcoal scuro */
--primary: 153 40% 30%;        /* Verde foresta */
--secondary: 152 42% 52%;      /* Menta */
--accent: 27 87% 67%;          /* Ambra/oro */
--muted: 105 20% 90%;          /* Salvia pallido */
--card: 0 0% 100%;             /* Bianco */
--radius: 1rem;
```

Fonts: `DM Sans` (display/titoli), `Inter` (body).

---

## Credenziali di Test

| Utente | Email | Password |
|--------|-------|----------|
| Demo | `demo@test.app` | `Demo123456` |

---

## Comandi Utili

```bash
# Installa tutto
pnpm install

# Aggiungi colonna mancante al DB (se necessario)
psql "$DATABASE_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;"

# Codegen API (dopo modifiche a openapi.yaml)
pnpm --filter @workspace/api-spec run codegen

# Typecheck completo
pnpm run typecheck

# Build tutto
pnpm run build
```
