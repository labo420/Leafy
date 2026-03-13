# Leafy — Sustainability Loyalty Platform

## Panoramica del Progetto

Leafy è una piattaforma loyalty mobile-first per la sostenibilità. Gli utenti scansionano scontrini come prova d'acquisto, poi inquadrano i codici a barre dei prodotti per guadagnare punti basati sull'**Eco-Score** di Open Food Facts. Salgono di livello (Bronzo → Argento → Oro → Platino), completano sfide mensili e riscattano voucher nel marketplace.

**Stato attuale**: App Expo React Native funzionante (SDK 54) + backend Express/PostgreSQL + admin panel web.

---

## Artifacts

| Artifact | Path | Descrizione |
|----------|------|-------------|
| `leafy-mobile` | Expo app | App principale React Native (iOS/Android/web) |
| `api-server` | Express 5 | Backend REST API su porta 8080 |
| `leafy` | React/Vite | Frontend web legacy (porta 5000) |
| `leafy-register` | React/Vite | Pannello admin web |
| `mockup-sandbox` | Vite | Sandbox per mockup componenti su canvas |

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
| `ANTHROPIC_API_KEY` | Auto | Fornita da Replit AI Integrations (Claude Haiku fallback per classificazione) |

Per impostare i secrets su Replit: **Tools → Secrets**.

> **Nota Google OAuth**: l'app è in modalità "Testing". L'utente dev deve aggiungersi come Test User in Google Cloud Console → OAuth Consent Screen → Test Users, altrimenti riceve errore 403.

---

## Come Avviare il Progetto

### Dev (Development)

```bash
# Installa dipendenze
pnpm install

# Sincronizza schema DB (dopo modifiche allo schema)
pnpm --filter @workspace/db run push

# Avvia tutto insieme (workflow Replit "Start application")
PORT=8080 pnpm --filter @workspace/api-server run dev & PORT=5000 BASE_PATH=/ pnpm --filter @workspace/leafy run dev
```

I workflow Replit gestiscono questi comandi automaticamente.

### App Mobile (Expo)

```bash
# Avvia il dev server Expo
pnpm --filter @workspace/leafy-mobile run dev
# oppure usa il workflow Replit "artifacts/leafy-mobile: expo"
```

Il tunnel ngrok si configura automaticamente via `start-dev.js`.

### Build Produzione

```bash
PORT=80 BASE_PATH=/ pnpm --filter @workspace/leafy run build
pnpm --filter @workspace/api-server run build
# Poi avviare: node artifacts/api-server/dist/index.cjs
```

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
| App Mobile | Expo SDK 54, React Native, expo-router |
| Camera/Barcode | expo-camera (CameraView + onBarcodeScanned) |
| Frontend Web | React + Vite + Tailwind v4 |
| UI Components | shadcn/ui (web), @expo/vector-icons (mobile) |
| Animazioni | Framer Motion (web), react-native-reanimated (mobile) |
| State/Query | TanStack React Query |
| Auth | Passport.js (Google, Facebook), openid-client (Replit OIDC), bcryptjs |
| Sessioni | Cookie-based (SHA256 session store custom in-memory) |
| AI | Claude Haiku via Replit AI Integrations (classificazione prodotti fallback) |
| Eco-Score | Open Food Facts API (gratuita, no API key) |
| Fonts | DM Sans (display), Inter (body) |
| Build | esbuild (CJS), Vite |

---

## Struttura del Monorepo

```text
workspace/
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── scan.ts       # Flusso scontrino (proof-only) + barcode lookup/confirm
│   │       │   ├── receipts.ts   # GET lista + dettaglio con barcode scans
│   │       │   ├── auth.ts       # Login email, Google, Facebook, Replit OIDC
│   │       │   ├── profile.ts    # Profilo utente, requireUser middleware
│   │       │   ├── admin.ts      # Admin panel backend (password protected)
│   │       │   ├── challenges.ts
│   │       │   ├── leaderboard.ts
│   │       │   └── marketplace.ts
│   │       └── lib/
│   │           ├── productClassifier.ts  # Open Food Facts + Claude AI fallback + cache
│   │           ├── antiFraud.ts          # 8-layer anti-frode system
│   │           ├── scanner.ts            # Google Vision OCR + keyword matching
│   │           └── auth.ts               # Session store
│   ├── leafy-mobile/        # App Expo React Native
│   │   └── app/
│   │       ├── (tabs)/
│   │       │   ├── index.tsx       # Home: punti, livello, impatto
│   │       │   ├── scan.tsx        # Flusso scontrino: camera → conferma → sessione barcode
│   │       │   ├── storico.tsx     # Lista scontrini + dettaglio con barcode scans
│   │       │   ├── marketplace.tsx
│   │       │   └── profilo.tsx
│   │       ├── barcode-scanner.tsx # Scanner barcode: scan → preview → conferma/rifiuto
│   │       ├── login.tsx
│   │       └── _layout.tsx
│   ├── leafy/               # Frontend React/Vite (web legacy)
│   ├── leafy-register/      # Admin panel web (React/Vite)
│   └── mockup-sandbox/      # Sandbox mockup per canvas Replit
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec + Orval config
│   ├── api-client-react/    # React Query hooks generati
│   ├── api-zod/             # Zod schemas generati dall'OpenAPI
│   ├── db/                  # Drizzle ORM schema + connessione PostgreSQL
│   │   └── src/schema/
│   │       ├── users.ts
│   │       ├── receipts.ts       # incl. barcodeExpiry, barcodeMode
│   │       ├── barcode-scans.ts  # unique(receipt_id, barcode)
│   │       ├── product-cache.ts
│   │       └── ...
│   └── integrations-anthropic-ai/  # Anthropic client via Replit proxy
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

---

## Flusso di Scansione (Two-Phase Flow)

### Fase 1 — Scontrino come prova d'acquisto
1. Utente fotografa lo scontrino
2. `POST /api/scan` → anti-frode checks, salva receipt, **zero punti**
3. Risposta: `{ receiptId, barcodeExpiry (now+24h), message }`
4. App mostra "Scontrino confermato" con CTA per scansionare prodotti

### Fase 2 — Barcode scanner per i punti
1. Utente apre lo scanner e inquadra il codice a barre
2. `POST /api/scan/barcode/lookup` → cerca su Open Food Facts → ritorna preview (nome, Eco-Score, punti) **senza credito**
3. App mostra la preview, utente preme **Conferma** o **Annulla**
4. `POST /api/scan/barcode/confirm` → transazione DB atomica → credito punti
5. Sessione valida 24h; max 200 punti/giorno; no duplicati per scontrino

### Eco-Score → Punti
| Eco-Score | Punti |
|-----------|-------|
| A | 20 |
| B | 15 |
| C | 8 |
| D | 3 |
| E | 0 |

---

## API Endpoints

Base URL: `/api`

### Auth
| Endpoint | Descrizione |
|----------|-------------|
| `POST /api/auth/login` | Login email/password |
| `POST /api/auth/register` | Registrazione email/password |
| `GET /api/auth/google` | OAuth Google |
| `GET /api/auth/facebook` | OAuth Facebook |
| `GET /api/login` | Replit OIDC |
| `GET /api/logout` | Termina sessione |
| `GET /api/auth/user` | Utente corrente |

### Profilo
| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/profile` | Profilo (livello, badge, sfide) |
| `PUT /api/profile/username` | Aggiorna username |
| `PUT /api/profile/image` | Aggiorna foto profilo (base64) |
| `DELETE /api/profile/account` | Cancella account |
| `GET /api/profile/impact` | Statistiche impatto ambientale |
| `GET /api/profile/referral` | Codice referral |
| `POST /api/profile/referral/apply` | Applica codice referral |

### Scontrini e Scan
| Endpoint | Descrizione |
|----------|-------------|
| `POST /api/scan` | Valida scontrino (proof-only, NO punti) → apre sessione 24h |
| `POST /api/scan/barcode/lookup` | Preview prodotto da barcode (NO credito punti) |
| `POST /api/scan/barcode/confirm` | Conferma e accredita punti |
| `GET /api/scan/active-session` | Sessione barcode attiva + prodotti scansionati |
| `GET /api/receipts` | Lista scontrini |
| `GET /api/receipts/:id` | Dettaglio: greenItems + barcodeScans + Eco-Score |

### Altro
| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/challenges` | Sfide mensili con progress |
| `GET /api/leaderboard` | Classifica utenti |
| `GET /api/marketplace/vouchers` | Voucher disponibili |
| `POST /api/marketplace/vouchers/:id/redeem` | Riscatta voucher |
| `GET /api/admin/*` | Rotte admin (`x-admin-password` header richiesto) |
| `GET /api/healthz` | Health check |

---

## Sistema Anti-Frode (8 layer)

1. **Hash scontrino** — Previene doppia scansione dello stesso scontrino
2. **Age limit** — Scontrini vecchi più di 7 giorni non accettati
3. **Daily scan cap** — Max 10 scontrini/giorno per utente
4. **Daily points cap** — Max 200 punti/giorno da barcode
5. **Cross-user dedup** — Stesso hash rifiutato da utenti diversi
6. **Reputation multiplier** — 0.5x se account < 7 giorni, 0.7x se < 30 giorni
7. **Pending staging** — Scansioni ad alto valore → pending → approvazione admin
8. **Barcode dedup** — Unique constraint `(receipt_id, barcode)` + transazione atomica

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
points_earned, green_items_count, categories[], green_items_json,
scanned_at, status, flag_reason, barcode_expiry, barcode_mode
```
- `barcode_expiry` = scadenza sessione barcode (24h dopo scan)
- `barcode_mode` = 1 (indica flusso barcode attivo)
- `status` = `approved` | `pending` | `rejected`

### `barcode_scans`
```
id, receipt_id (FK), user_id (FK), barcode, product_name, eco_score,
points_earned, category, emoji, reasoning, scanned_at
```
Unique constraint su `(receipt_id, barcode)`.

### `product_cache`
```
id, product_name_normalized, product_name_original, eco_score, points,
category, source, reasoning, emoji, cached_at
```
Cache lookup prodotti. Chiave `barcode:{code}` per lookup da barcode.

### `challenges`, `challenge_progress`, `vouchers`, `redeemed_vouchers`
Schema gestito da Drizzle ORM in `lib/db/src/schema/`.

---

## Schermate App Mobile

| Tab | File | Descrizione |
|-----|------|-------------|
| Home | `(tabs)/index.tsx` | Dashboard: punti, livello, streak, impatto |
| Scansiona | `(tabs)/scan.tsx` | Flusso scontrino + sessione barcode attiva |
| Storico | `(tabs)/storico.tsx` | Lista scontrini + dettaglio con barcode scans |
| Premi | `(tabs)/marketplace.tsx` | Voucher riscattabili |
| Profilo | `(tabs)/profilo.tsx` | Profilo, badge, sfide, referral |
| Scanner | `barcode-scanner.tsx` | Schermata full-screen camera barcode |

---

## Dettagli Tecnici Importanti

### Express 5 — Wildcard Route
```ts
app.get(/(.*)/,  handler)  // ✅ Corretto per Express 5
// NON: app.get("*", handler)  // ❌ genera errore pathToRegexp
```

### Barcode Scanner — Flusso States
```
scanning → looking-up → preview → confirming → confirmed
                ↓ errore              ↓ annulla
              scanning             scanning
```

### Classificazione Prodotti
- **Open Food Facts** (primario): API gratuita, nessuna API key
- **Claude Haiku** (fallback): solo per `classifyProducts()` da testo scontrino — NON usato per lookup barcode
- **Cache**: `product_cache` table, key `barcode:{code}` o nome normalizzato

### Transazione Atomica Barcode Confirm
```ts
db.transaction(async (tx) => {
  // 1. Check duplicate dentro tx
  // 2. Insert barcode_scan
  // 3. Update users.total_points
  // 4. Update receipts.points_earned
}).catch(err => {
  if (err.code === "23505") return { error: "Già scansionato" }
  throw err
})
```

### Colors Mobile (constants/colors.ts)
```ts
Colors.leaf      // #40916C (verde principale)
Colors.forest    // #1B4332 (verde scuro)
Colors.border    // #DDE7E0 (bordi, NON Colors.gray200)
Colors.tabActive // = Colors.leaf
Colors.tabInactive // = Colors.textMuted (#8DA89A)
```

### Zod / Orval Date Bug
Orval con `useDates: true` genera schemi Zod che si aspettano oggetti `Date`, **non** stringhe ISO. Non chiamare `.toISOString()` prima di passare dati a `.parse()`.

### TypeScript Composite
- Typechecking da root: `pnpm run typecheck`
- Non eseguire `tsc` dentro un singolo pacchetto (fallisce se deps non sono buildate)

---

## Design Tokens Mobile

```ts
// Tema verde foresta — constants/colors.ts
GREEN_LIGHT = "#D5F5E3"  // primaryLight (sfondi badge)
LEAF = "#40916C"          // colore principale
FOREST = "#1B4332"        // gradienti scuri
CREAM = "#F8FAF5"         // background
```

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

# Sincronizza schema DB (dopo modifiche)
pnpm --filter @workspace/db run push

# Codegen API (dopo modifiche a openapi.yaml)
pnpm --filter @workspace/api-spec run codegen

# Typecheck completo
pnpm run typecheck

# Build tutto
pnpm run build

# Aggiungi colonna mancante al DB (emergenza)
psql "$DATABASE_URL" -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;"
```
