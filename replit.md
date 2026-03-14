# Leafy — Sustainability Loyalty Platform

## Panoramica del Progetto

Leafy è una piattaforma loyalty mobile-first per la sostenibilità. Gli utenti scansionano scontrini come prova d'acquisto, poi inquadrano i codici a barre dei prodotti per guadagnare punti basati sull'**Eco-Score** di Open Food Facts. Salgono di livello (Bronzo → Argento → Oro → Platino), completano sfide mensili e riscattano voucher nel marketplace.

**Stato attuale**: App Expo React Native funzionante (SDK 54) + backend Express/PostgreSQL + admin panel web + frontend web con sistema badge a due livelli (lifetime + temporali) + whitelist 51 supermercati italiani con validazione AI di catena e provincia. Sistema barcode con validazione obbligatoria, catena lookup multi-sorgente (OFF → Nutritionix → USDA → AI+GS1), economia Leafy con bonus/cap, "No, aggiungi" per correzione prodotti e apprendimento AI.

---

## Principi di Prodotto (non cancellare mai questa sezione)

> **Target audience: TUTTI i consumatori, non solo chi è già "green".**
>
> Leafy è pensata per il pubblico più ampio possibile. Include sia chi è già vicino al mondo della sostenibilità, sia il consumatore normale che, senza saperlo, potrebbe già acquistare prodotti sostenibili. L'app non deve mai risultare elitaria, moralizzante o rivolta solo a un pubblico di nicchia eco-consapevole. Ogni scelta di design, copy, tono e funzionalità deve rispettare questo principio: **accogliere tutti, premiare le scelte green senza giudicare quelle che non lo sono.**

---

## Artifacts

| Artifact | Path | Descrizione |
|----------|------|-------------|
| `leafy-mobile` | Expo app | App principale React Native (iOS/Android/web) |
| `api-server` | Express 5 | Backend REST API su porta 8080 |
| `leafy` | React/Vite | Frontend web con sistema badge a due livelli (porta 24389, preview path `/`) |
| `leafy-register` | React/Vite | Pannello admin web (porta 5000, preview path `/leafy-register/`) |
| `mockup-sandbox` | Vite | Sandbox per mockup componenti su canvas |

---

## Environment Variables / Secrets Necessari

| Variabile | Obbligatoria | Descrizione |
|-----------|-------------|-------------|
| `DATABASE_URL` | ✅ Sì | PostgreSQL connection string (fornita automaticamente da Replit) |
| `SESSION_SECRET` | ✅ Produzione | Segreto per la firma dei cookie di sessione. Genera con: `openssl rand -base64 32` |
| `NGROK_AUTH_TOKEN` | ✅ Dev mobile | Token ngrok per il tunnel Expo. Registrati su [ngrok.com](https://ngrok.com) → Dashboard → Your Authtoken. Senza di esso, l'app mobile non riesce a connettersi al backend fuori dalla rete locale. |
| `GOOGLE_CLIENT_ID` | Auth Google | OAuth 2.0 Client ID da Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Auth Google | OAuth 2.0 Client Secret da Google Cloud Console |
| `FACEBOOK_APP_ID` | Auth Facebook | App ID da Facebook Developers |
| `FACEBOOK_APP_SECRET` | Auth Facebook | App Secret da Facebook Developers |
| `GOOGLE_CLOUD_VISION_API_KEY` | Consigliata | Google Vision API per OCR scontrini. Senza, usa keyword matching. |
| `ADMIN_PASSWORD` | No | Password pannello admin. Default: `leafy2026` |
| `NUTRITIONIX_APP_ID` | No | Nutritionix API App ID (free: 500 chiamate/giorno). Senza, il lookup barcode salta questa sorgente. |
| `NUTRITIONIX_API_KEY` | No | Nutritionix API Key. Entrambe le variabili (APP_ID + API_KEY) servono per attivare il lookup. |
| `USDA_API_KEY` | No | USDA FoodData Central API Key. Senza, usa `DEMO_KEY` (rate limit basso ma funzionante). |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Auto (Replit) | Fornita automaticamente da Replit AI Integrations |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Auto (Replit) | Fornita automaticamente da Replit AI Integrations |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Auto (Replit) | Bucket ID GCS per Object Storage (foto scontrini) |
| `PRIVATE_OBJECT_DIR` | Auto (Replit) | Directory privata su GCS |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Auto (Replit) | Path ricerca oggetti pubblici |
| `EXPO_PUBLIC_DOMAIN` | Auto (Replit) | Dominio pubblico del backend. Su Replit = `$REPLIT_DEV_DOMAIN` (iniettato dal workflow). Su GitHub/altri: imposta al tuo dominio. |
| `EXPO_PUBLIC_REPL_ID` | Auto (Replit) | ID del Repl. Su Replit = `$REPL_ID` (iniettato dal workflow). Su GitHub/altri: qualsiasi stringa univoca. |

Per impostare i secrets su Replit: **Tools → Secrets**.

> **Nota Google OAuth**: l'app è in modalità "Testing". L'utente dev deve aggiungersi come Test User in Google Cloud Console → OAuth Consent Screen → Test Users, altrimenti riceve errore 403.

---

## GitHub — Esportazione e Importazione

Il repository è connesso a **https://github.com/labo420/Leafy**.

### Push (Replit → GitHub)

Da Replit usa il pannello **Git** (icona ramo nella sidebar sinistra):
1. Scrivi il messaggio di commit
2. Clicca **Commit & Push**

Oppure da terminale:
```bash
git add -A
git commit -m "descrizione modifica"
git push origin main
```

### Pull / Clone (GitHub → nuovo ambiente)

```bash
git clone https://github.com/labo420/Leafy.git
cd Leafy

cp .env.example .env
# edita .env con DATABASE_URL, SESSION_SECRET, NGROK_AUTH_TOKEN, ecc.

pnpm install
pnpm --filter @workspace/db run push

PORT=8080 pnpm --filter @workspace/api-server run dev
```

### File importanti per la consistenza

| File | Scopo |
|------|-------|
| `.env.example` | Template di tutti i secrets necessari — committato nel repo |
| `.gitignore` | Esclude `.env`, `node_modules`, `.local/`, `.cache/`, `dist/`, `.replit`, `artifact.toml` |
| `pnpm-workspace.yaml` | Definisce il monorepo pnpm |
| `pnpm-lock.yaml` | Lockfile — garantisce le stesse versioni su ogni clone |
| `lib/db/src/schema/` | Schema Drizzle — il DB viene ricreato con `pnpm --filter @workspace/db run push` |
| `tsconfig.base.json` + `tsconfig.json` | TypeScript composite project config |

### Cosa NON viene committato

- `.env` — i secrets reali rimangono solo in locale o su Replit Secrets
- `node_modules/`, `dist/`, `.cache/`, `.local/` — ricostruibili
- `.replit`, `artifact.toml` — file di configurazione Replit (generati automaticamente)
- Token ngrok, API key, password — usare `.env.example` come guida

---

## Come Avviare il Progetto

### Setup Completo da Zero (GitHub / Non-Replit)

Sequenza da seguire **nell'ordine esatto** per partire da un clone fresco del repo:

```bash
# 1. Installa tutte le dipendenze del monorepo
pnpm install

# 2. Configura i secrets obbligatori (vedi tabella env vars sopra):
#    DATABASE_URL, SESSION_SECRET, NGROK_AUTH_TOKEN
#    Opzionali: GOOGLE_CLIENT_ID/SECRET, FACEBOOK_APP_ID/SECRET,
#               GOOGLE_CLOUD_VISION_API_KEY, ADMIN_PASSWORD,
#               NUTRITIONIX_APP_ID, NUTRITIONIX_API_KEY, USDA_API_KEY

# 3. Crea lo schema PostgreSQL
pnpm --filter @workspace/db run push

# 4. Avvia il backend (i 15 badge vengono seedati automaticamente al primo avvio)
PORT=8080 pnpm --filter @workspace/api-server run dev

# 5. In terminali separati, avvia gli altri servizi:
PORT=24389 BASE_PATH=/ pnpm --filter @workspace/leafy run dev
EXPO_PUBLIC_DOMAIN=<tuo-dominio> pnpm --filter @workspace/leafy-mobile run dev
```

> **Nota seed badge**: `seed-badges.ts` viene chiamato automaticamente all'avvio del server in `src/index.ts`. Non serve nessun comando extra — i 15 badge vengono inseriti (idempotentemente) al primo start.

### Dev su Replit (Development)

I workflow Replit gestiscono tutto automaticamente. Clicca **Run** o usa i workflow nel pannello:

```bash
# Backend API (workflow "Start application")
PORT=8080 pnpm --filter @workspace/api-server run dev

# Frontend web (workflow "artifacts/leafy: web")
PORT=24389 BASE_PATH=/ pnpm --filter @workspace/leafy run dev

# App mobile Expo (workflow "artifacts/leafy-mobile: expo")
EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN EXPO_PUBLIC_REPL_ID=$REPL_ID \
  node scripts/start-dev.js --tunnel --port $PORT
```

### App Mobile (Expo)

```bash
pnpm --filter @workspace/leafy-mobile run dev
# oppure usa il workflow Replit "artifacts/leafy-mobile: expo"
```

Il tunnel ngrok si configura automaticamente via `start-dev.js` usando `NGROK_AUTH_TOKEN`.

### Build Produzione

```bash
PORT=80 BASE_PATH=/ pnpm --filter @workspace/leafy run build
pnpm --filter @workspace/api-server run build
# Poi avviare: node artifacts/api-server/dist/index.cjs
```

---

## Funzionalità Dipendenti da Replit (Non Portabili)

Le seguenti funzionalità **non funzionano fuori dall'ambiente Replit** senza modifiche al codice o sostituzioni di servizi:

### 1. Replit OIDC (Login con account Replit)
- Endpoint `GET /api/login` reindirizza a `https://replit.com/oidc/...`
- Richiede `REPL_ID`, `REPLIT_DEV_DOMAIN`, `ISSUER_URL` (tutte variabili auto-iniettate da Replit)
- **Su GitHub/altri**: disabilitare o sostituire con un altro provider OAuth (Google, Facebook sono già integrati e funzionano ovunque)

### 2. Object Storage — GCS Sidecar
- Le foto degli scontrini vengono salvate su Google Cloud Storage tramite un sidecar Replit
- Le credenziali (`DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`) sono iniettate automaticamente
- **Su GitHub/altri**: necessita un bucket GCS con service account e credenziali manuali, oppure sostituire con storage locale (`multer` + disco locale) o S3

### 3. Variabili Auto-iniettate da Replit
| Variabile | Usata per | Alternativa |
|-----------|-----------|-------------|
| `REPLIT_DEV_DOMAIN` | CORS origin, cookie domain, `EXPO_PUBLIC_DOMAIN` | Imposta manualmente al tuo dominio |
| `REPL_ID` | Replit OIDC, `EXPO_PUBLIC_REPL_ID` | Qualsiasi stringa univoca |
| `ISSUER_URL` | Endpoint OIDC discovery | Non necessario se si disabilita Replit Login |

### 4. AI Integrations (Anthropic — Claude)
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` e `AI_INTEGRATIONS_ANTHROPIC_API_KEY` sono fornite da Replit AI Integrations
- **Su GitHub/altri**: serve un account Anthropic con API key propria e sostituire `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` con `https://api.anthropic.com`

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
| Eco-Score | Open Food Facts API (gratuita, no API key) + Nutritionix + USDA FoodData Central |
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
│   │       │   ├── scan.ts         # Flusso scontrino + barcode lookup/confirm/manual-classify
│   │       │   ├── receipts.ts     # GET lista + dettaglio (con isPending, remainingHours, pendingProductsCount)
│   │       │   ├── auth.ts         # Login email, Google, Facebook, Replit OIDC
│   │       │   ├── profile.ts      # Profilo utente + pendingValidations array
│   │       │   ├── admin.ts        # Admin panel backend (password protected)
│   │       │   ├── badges.ts       # GET /api/badges/my — badge lifetime + temporali
│   │       │   ├── challenges.ts
│   │       │   ├── leaderboard.ts
│   │       │   └── marketplace.ts
│   │       ├── seed-badges.ts      # 15 badge seed idempotenti (per nome)
│   │       └── lib/
│   │           ├── productClassifier.ts  # OFF + Nutritionix + USDA + AI fallback + GS1 brand hints + cache
│   │           ├── supermarketWhitelist.ts # 51 catene italiane (standard/bio/discount) + matchChain()
│   │           ├── antiFraud.ts          # 8-layer anti-frode system
│   │           ├── scanner.ts            # Google Vision OCR + keyword matching
│   │           ├── auth.ts               # Session store
│   │           ├── receiptImages.ts      # Upload/serve/delete foto scontrini (GCS)
│   │           ├── receiptImageCleanup.ts # Pulizia automatica foto scadute (30gg)
│   │           └── objectStorage.ts      # GCS client wrapper (Replit sidecar auth)
│   ├── leafy-mobile/        # App Expo React Native
│   │   └── app/
│   │       ├── (tabs)/
│   │       │   ├── index.tsx       # Home: punti, livello, impatto
│   │       │   ├── scan.tsx        # Flusso scontrino: camera → conferma → lista prodotti pending → barcode
│   │       │   ├── storico.tsx     # Lista scontrini + dettaglio con isPending/badge/verifica
│   │       │   ├── marketplace.tsx
│   │       │   └── profilo.tsx
│   │       ├── barcode-scanner.tsx # Scanner barcode: scan → preview → conferma/rifiuto → "No, aggiungi"
│   │       ├── shopping-scanner.tsx # Modalità Spesa (stima punti senza scontrino)
│   │       ├── login.tsx
│   │       └── _layout.tsx
│   ├── leafy/               # Frontend React/Vite (web principale)
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Profile.tsx     # Pagina profilo (Traguardi + Sfide tabs, badge system)
│   │       │   ├── Home.tsx        # Dashboard punti, livello, impatto
│   │       │   ├── Scan.tsx        # Flusso scontrino + sessione barcode
│   │       │   ├── History.tsx     # Lista scontrini con dettaglio barcode scans
│   │       │   ├── Marketplace.tsx # Voucher riscattabili
│   │       │   ├── Settings.tsx    # Impostazioni account
│   │       │   └── Admin.tsx       # Pannello admin interno
│   │       └── App.tsx             # Router Wouter + AuthGate
│   ├── leafy-register/      # Admin panel web (React/Vite)
│   └── mockup-sandbox/      # Sandbox mockup per canvas Replit
│       └── src/components/mockups/
│           └── badge-demo/
│               └── BadgeDemo.tsx   # Preview canvas badge
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec + Orval config
│   ├── api-client-react/    # React Query hooks generati
│   ├── api-zod/             # Zod schemas generati dall'OpenAPI
│   ├── db/                  # Drizzle ORM schema + connessione PostgreSQL
│   │   └── src/schema/
│   │       ├── users.ts
│   │       ├── receipts.ts       # incl. barcodeExpiry, barcodeMode
│   │       ├── barcode-scans.ts  # unique(receipt_id, barcode)
│   │       ├── badges.ts         # badges + user_badges con periodKey
│   │       ├── product-cache.ts  # cache lookup prodotti (chiave barcode:{code} o nome)
│   │       ├── user-product-submissions.ts  # submission manuali prodotti (apprendimento AI)
│   │       ├── oauth-accounts.ts
│   │       ├── challenges.ts
│   │       ├── vouchers.ts
│   │       ├── products.ts
│   │       ├── conversations.ts
│   │       ├── messages.ts
│   │       └── index.ts          # re-export di tutte le tabelle
│   └── integrations-anthropic-ai/  # Anthropic client via Replit proxy
├── .env.example             # Template secrets per GitHub clone
├── .gitignore               # Esclude .env, node_modules, .local, .cache, .replit, artifact.toml
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
└── tsconfig.json
```

---

## Economia Leafy (Sistema Punti)

### Conversione
100 punti = 1 euro di valore voucher

### Punti da Scontrino (Fase 1)
| Evento | Punti | Note |
|--------|-------|------|
| Scansione scontrino valido | +5 pt | `RECEIPT_SCAN_BONUS`, sempre assegnati |
| Primo scontrino in assoluto (welcome) | +100 pt | `WELCOME_BONUS`, una tantum |

### Punti da Barcode (Fase 2)
| Eco-Score | Punti base | Con Eco-Hero x2 |
|-----------|-----------|-----------------|
| A | 20 | 40 (max) |
| B | 15 | 30 |
| C | 8 | 16 |
| D | 3 | 6 |
| E | 0 | 0 |

### Bonus e Cap
| Regola | Valore | Costante nel codice |
|--------|--------|---------------------|
| Cap per scontrino | 150 pt (barcode) | `PER_RECEIPT_CAP` in scan.ts |
| Cap giornaliero | 200 pt (barcode) | `DAILY_POINTS_CAP` in scan.ts |
| Scontrino Virtuoso | +20 pt | 3+ prodotti green (≥10pt) nello stesso scontrino |
| Eco-Hero | x2 punti (max 40pt) | Prodotti con keyword bio/organic/equo/vegan in `productClassifier.ts` |

### Scontrino Virtuoso
Quando il 3° prodotto green (eco-score ≥ C, punti ≥ 10) viene confermato sullo stesso scontrino, l'utente riceve un bonus di +20 punti. Animazione stella nell'app mobile. Si attiva una sola volta per scontrino.

---

## Flusso di Scansione (Two-Phase Flow con Validazione Obbligatoria)

### Fase 1 — Scontrino come prova d'acquisto
1. Utente fotografa lo scontrino (hint: "totale e data devono essere visibili")
2. `POST /api/scan` → AI validation → whitelist check → semantic dedup → anti-frode → AI product extraction
3. Lo scontrino viene salvato con `status: "pending_barcode"` e `barcodeExpiry: now + 24h`
4. L'AI estrae i nomi dei prodotti dallo scontrino → salvati come `greenItemsJson` con `matched: false`
5. Risposta include `greenItemsFound[]` — lista prodotti da verificare con barcode
6. App mostra la lista prodotti con pulsante "Scansiona" per ognuno
7. L'utente può scegliere "Lo faccio dopo — riprendo dallo storico"

### Fase 2 — Barcode scanner per validazione prodotti
1. Utente apre lo scanner (da lista prodotti o da storico)
2. Banner "Stai verificando: [nome prodotto]" quando si arriva da un prodotto specifico
3. `POST /api/scan/barcode/lookup` → catena lookup multi-sorgente → preview (nome, Eco-Score, punti)
4. App mostra la preview, utente preme **Conferma** o **"No, aggiungi"** (icona matita)
5. **Conferma**: `POST /api/scan/barcode/confirm` → credito punti + `matched: true` nel greenItemsJson
6. **"No, aggiungi"**: apre form manuale "Correggi prodotto" → `POST /api/scan/barcode/manual-classify`
7. Dopo conferma: pulsante "Torna alla lista" riporta alla lista prodotti pending
8. Sessione valida 24h; prodotti non verificati entro scadenza restano senza punti

### Storico — Verifica in sospeso
- Scontrini con `status: "pending_barcode"` mostrano badge "In sospeso" (icona orologio)
- Banner giallo con ore rimaste e pulsanti "Scansiona" per ogni prodotto non verificato
- Prodotti verificati mostrano badge verde "Verificato"
- `GET /api/receipts` include: `isPending`, `remainingHours`, `pendingProductsCount`
- `GET /api/profile` include: `pendingValidations[]` con receiptId, storeName, remainingHours, pendingCount

### Modalità Spesa (Shopping Mode)
Funzione aggiuntiva: l'utente scansiona barcode **mentre fa la spesa** (senza scontrino) per ottenere una **stima** dei punti.
- Endpoint: `POST /api/scan/barcode/preview` — lookup prodotto senza receiptId, nessun credito punti
- Schermata mobile: `app/shopping-scanner.tsx` — camera scanner + lista prodotti in-memory + report finale
- Accesso: bottone "Modalità Spesa" nella tab Scansiona (visivamente secondario)
- Tutti i punti mostrati sono stime (~) — disclaimer visivo sempre presente
- Nessuna scrittura DB, sessione completamente in-memory

---

## Catena Lookup Barcode (productClassifier.ts)

La funzione `lookupBarcode()` segue questa catena di fallback:

```
1. Cache locale (product_cache con key barcode:{code})
     ↓ miss
2. Open Food Facts (IT + world) — gratuito, no API key
     ↓ miss
3. Nutritionix — richiede NUTRITIONIX_APP_ID + NUTRITIONIX_API_KEY (skipped se assenti)
     ↓ miss
4. USDA FoodData Central — usa USDA_API_KEY o DEMO_KEY
     ↓ miss
5. Claude AI Vision (se imageBase64 presente) — analizza foto del barcode
     ↓ miss
6. Claude AI + GS1 brand hint — classifica usando prefisso produttore
     ↓ miss
7. Claude AI puro — classificazione solo da barcode (punti conservativi 5-10)
```

### GS1 Italia Brand Hints
Mappa `GS1_ITALY_PREFIXES` con 40+ prefissi (6-7 cifre) → brand italiani:
- Mondelez (Fonzies, TUC, Oreo), Ferrero (Nutella, Kinder), Barilla, Nestlé, De Cecco, Granarolo, Mutti, San Benedetto, Lavazza, Illy, Parmalat, ecc.
- Usato come `brandHint` nel prompt AI per migliorare la classificazione

### Correzione Prodotti e Apprendimento AI
- **"No, aggiungi"** nel barcode scanner → form manuale "Correggi prodotto"
- `POST /api/scan/barcode/manual-classify` → classifica, salva in `product_cache` (chiave `barcode:{code}`) + `user_product_submissions`
- La prossima scansione dello stesso barcode trova il risultato in cache (step 1) → risposta istantanea
- Tabella `user_product_submissions`: traccia userId, barcode, productName, weight, ecoScore, pointsAwarded, classifiedByAI

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
| `GET /api/profile` | Profilo (livello, badge, sfide, `pendingValidations[]`) |
| `PUT /api/profile/username` | Aggiorna username |
| `PUT /api/profile/image` | Aggiorna foto profilo (base64) |
| `DELETE /api/profile/account` | Cancella account |
| `GET /api/profile/impact` | Statistiche impatto ambientale |
| `GET /api/profile/referral` | Codice referral |
| `POST /api/profile/referral/apply` | Applica codice referral |

### Scontrini e Scan
| Endpoint | Descrizione |
|----------|-------------|
| `POST /api/scan` | Valida scontrino + whitelist → status `pending_barcode`, sessione 24h |
| `POST /api/scan/barcode/lookup` | Preview prodotto da barcode (NO credito, richiede receiptId) |
| `POST /api/scan/barcode/preview` | Preview standalone (Modalità Spesa) — solo stima punti, no receiptId |
| `POST /api/scan/barcode/confirm` | Conferma e accredita punti, aggiorna `matched: true` in greenItemsJson |
| `POST /api/scan/barcode/manual-classify` | Inserimento manuale prodotto → cache + user_product_submissions |
| `GET /api/scan/active-session` | Sessione barcode attiva + prodotti scansionati |
| `GET /api/receipts` | Lista scontrini (incl. `isPending`, `remainingHours`, `pendingProductsCount`) |
| `GET /api/receipts/:id` | Dettaglio: greenItems + barcodeScans + `isPending` + `remainingHours` |
| `GET /api/receipts/:id/image` | Serve foto scontrino (auth-protected, 30gg retention) |
| `GET /api/accepted-stores` | Lista supermercati accettati per categoria `{ standard, bio, discount }` |

### Badge
| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/badges/my` | Badge dell'utente: lifetime + temporali con progresso |

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

## Sistema Badge (leafy)

### Architettura a Due Livelli

| Tipo | Tabella | Descrizione |
|------|---------|-------------|
| **Lifetime** | `badges` (`badge_type = 'lifetime'`) | Badge permanenti — si sbloccano una volta sola |
| **Temporali** | `badges` (`badge_type IN ('weekly','monthly','seasonal')`) | Badge a periodo — si resettano ogni ciclo |

### API Badge
```
GET /api/badges/my
```
Risponde con `{ lifetime: Badge[], temporal: TemporalBadge[] }`.
Ogni badge ha: `id`, `name`, `emoji`, `category`, `description`, `unlockHint`, `badgeType`, `targetCount`, `unlockedAt?`, `currentProgress?`, `periodKey?`.

### Seed Badge (15 badge)
File: `artifacts/api-server/src/seed-badges.ts`
- 10 lifetime: PRIMA VOLTA, PRODOTTO, VOLUME, LIVELLO, SOCIALE
- 5 temporali: weekly "Eroe Settimanale", monthly "Campione del Mese", seasonal "Guerriero Invernale" ecc.
- Idempotente: upsert per nome (non duplica a ogni restart)

### Pagina Profilo (leafy — `src/pages/Profile.tsx`)
- **Tab Traguardi**: badge lifetime — sblocati con data, locked con barra di progresso
- **Tab Sfide**: badge temporali — attivi del periodo corrente + archivio periodi passati
- Autenticazione richiesta (protetta da `AuthGate` in `App.tsx`)

---

## Sistema Anti-Frode (11 layer)

1. **Hash scontrino** — Previene doppia scansione della stessa immagine (SHA-256)
2. **AI validation** — Claude Vision verifica che l'immagine sia uno scontrino leggibile (data + totale visibili)
3. **Semantic dedup** — Blocca scontrini con stessa `receipt_date` + `receipt_total` (qualsiasi utente), funziona anche da angolazioni diverse
4. **Age limit** — Scontrini vecchi più di 7 giorni non accettati
5. **Daily scan cap** — Max 10 scontrini/giorno per utente
6. **Daily points cap** — Max 200 punti/giorno da barcode
7. **Cross-user dedup** — Stesso hash rifiutato da utenti diversi
8. **Reputation multiplier** — 0.5x se account < 7 giorni, 0.7x se < 30 giorni
9. **Pending staging** — Scansioni ad alto valore → pending → approvazione admin
10. **Barcode dedup** — Unique constraint `(receipt_id, barcode)` + transazione atomica
11. **Barcode image anti-fraud** — Claude Vision analizza la foto catturata dalla camera durante la scansione barcode per rilevare frodi (foto di schermi, screenshot, immagini stampate). Confidence >= 0.7 blocca la scansione con errore. Endpoint: `POST /scan/barcode/lookup` e `POST /scan/barcode/preview` (campo opzionale `imageBase64`)

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
id, user_id (FK), store_name, store_chain, province, purchase_date,
image_hash, raw_text, points_earned, green_items_count, categories[],
green_items_json, scanned_at, status, flag_reason, barcode_expiry,
barcode_mode, receipt_date, receipt_total, image_url, image_expires_at
```
- `barcode_expiry` = scadenza sessione barcode (24h dopo scan)
- `barcode_mode` = 1 (indica flusso barcode attivo)
- `status` = `approved` | `pending` | `rejected` | `pending_barcode` (in attesa di validazione barcode)
- `receipt_date` = data scontrino (YYYY-MM-DD) estratta dall'AI per anti-duplicato semantico
- `receipt_total` = totale scontrino in centesimi estratto dall'AI per anti-duplicato semantico
- `image_url` = path GCS della foto scontrino (pattern: `receipts/{userId}/{receiptId}.jpg`)
- `image_expires_at` = scadenza foto (30 giorni dopo upload)
- `store_chain` = nome normalizzato della catena (es. "Esselunga", "Lidl") estratto dall'AI
- `province` = provincia italiana dedotta dall'indirizzo sullo scontrino (es. "Milano"), estratta dall'AI
- `green_items_json` = JSON array di prodotti estratti con campo `matched: boolean` (true se verificato via barcode)

### `barcode_scans`
```
id, receipt_id (FK), user_id (FK), barcode, product_name, eco_score,
points_earned, category, emoji, reasoning, scanned_at
```
Unique constraint su `(receipt_id, barcode)`.

### `product_cache`
```
id, product_name_normalized, product_name_original, eco_score, points,
category, source, reasoning, emoji, co2_per_unit (real, nullable), cached_at
```
Cache lookup prodotti. Chiave `barcode:{code}` per lookup da barcode.
`co2_per_unit`: kg CO2 risparmiata per unità, da `ecoscore_data.agribalyse.co2_total` (OFF) o stima da categoria.

### `user_product_submissions`
```
id, user_id (FK), barcode, product_name, weight_value, weight_unit,
eco_score, points_awarded, classified_by_ai (boolean, default true), created_at
```
Traccia ogni prodotto inserito manualmente dall'utente (tramite "No, aggiungi"). Usato per analisi e miglioramento del sistema di classificazione.

### `badges`
```
id, name, emoji, category, description, unlock_hint,
badge_type (lifetime|weekly|monthly|seasonal),
target_count, period_key, is_active, created_at
```
`badge_type` determina se il badge è permanente o si resetta per periodo.

### `user_badges`
```
id, user_id (FK), badge_id (FK), unlocked_at, period_key, current_progress, created_at
```
`period_key` per badge temporali (es. `"2025-W12"`, `"2025-03"`, `"2025-Q1"`).
Unique constraint su `(user_id, badge_id, period_key)`.

### `challenges`, `challenge_progress`, `vouchers`, `redeemed_vouchers`
Schema gestito da Drizzle ORM in `lib/db/src/schema/`.

---

## Schermate App Mobile

| Tab | File | Descrizione |
|-----|------|-------------|
| Home | `(tabs)/index.tsx` | Header logo+avatar, progress ring SVG circolare animato (220px), messaggio motivazionale, CTA verde "Analizza la tua spesa". |
| Scansiona | `(tabs)/scan.tsx` | Flusso scontrino + lista prodotti pending con pulsanti "Scansiona" + "Lo faccio dopo". Chips bonus welcome/scontrino. |
| Storico | `(tabs)/storico.tsx` | Lista scontrini con badge "In sospeso"/"Verificato", banner verifica con ore rimaste, pulsanti scansiona per prodotto. Badge colorati per categoria. |
| Premi | `(tabs)/marketplace.tsx` | VoucherCard con header LinearGradient, badge categoria, progress bar, badge "Quasi!" animato a ≥80%, modale codice post-riscatto. |
| Profilo | `(tabs)/profilo.tsx` | Header verde con cerchi decorativi, avatar card con upload foto, griglia impatto 2-colonne, badge con tab Traguardi/Sfide. |
| Impostazioni | `impostazioni.tsx` | Schermata impostazioni utente |
| Scanner | `barcode-scanner.tsx` | Full-screen camera barcode, preview prodotto, "No, aggiungi" (form manuale "Correggi prodotto"), banner "Stai verificando", "Torna alla lista" dopo confirm. |
| Shopping | `shopping-scanner.tsx` | Modalità Spesa — scanner barcode senza scontrino, stima punti. |

### Campi API chiave per mobile

```ts
// GET /api/profile
{ totalPoints, nextLevelPoints, levelProgress /* 0-100 */, level /* "Bronzo"/"Argento"/"Oro"/"Platino" */,
  pendingValidations: [{ receiptId, storeName, remainingHours, pendingCount }] }

// GET /api/badges/my  (NON /profile/badges)
{ lifetime: BadgeItem[], temporal: TemporalBadgeItem[] }

// GET /api/receipts (lista)
[{ id, storeName, storeChain, pointsEarned, isPending, remainingHours, pendingProductsCount, ... }]

// POST /api/scan (risposta)
{ receiptId, barcodeExpiry, pointsEarned, greenItemsFound: [{ name, matched: false }], ... }

// profileImageUrl: su AuthUser (da useAuth), NON sul tipo Profile
```

---

## Dettagli Tecnici Importanti

### Express 5 — Wildcard Route
```ts
app.get(/(.*)/,  handler)  // Corretto per Express 5
// NON: app.get("*", handler)  // genera errore pathToRegexp
```

### Barcode Scanner — Flusso States
```
scanning → looking-up → preview → confirming → confirmed
                ↓ errore              ↓ "No, aggiungi"
              scanning          manual-form (cameFromReject)
                                     ↓ submit
                                  confirmed → "Torna alla lista"
```
Il footer della schermata fotocamera include anche un link **"Non riesci a scansionare? Inserisci il codice"**: apre un Modal con `TextInput` numerico. Il codice digitato segue lo stesso identico flusso `lookupMutation` → preview → conferma.

### Calcolo Impatto Ambientale (`GET /api/profile/impact`)
- Per ogni prodotto in `greenItemsJson` cerca `co2_per_unit` in `product_cache`
- Se presente → usa il valore reale (da Agribalyse via Open Food Facts)
- Fallback a coefficienti per categoria: Bio=0.8 kg, Km0=0.4 kg, Vegano=2.0 kg, Equo Solidale=0.2 kg
- Acqua: Bio=80L, Km0=10L, Vegano=200L, DOP=30L
- Compatibile con vecchi scontrini senza `greenItemsJson` (usa `r.categories`)
- Il frontend mostra disclaimer: *"Stime indicative basate sulla categoria del prodotto, non dati precisi per singolo articolo."*

### Whitelist Supermercati (`supermarketWhitelist.ts`)
51 catene italiane suddivise in 3 categorie: `standard` (GDO classica), `bio` (specializzati biologico), `discount`.

**`matchChain(storeName)`**: matching strict longest-first, lunghezza minima 4 caratteri, solo `normalized.includes(norm)` (NON il contrario). Ritorna il nome normalizzato della catena oppure `null`. Usato in `POST /api/scan` per bloccare i negozi non in whitelist (HTTP 400). `storeChain` e `province` vengono salvati sul DB anche per i negozi non in whitelist prima del reject.

**`GET /api/accepted-stores`**: endpoint pubblico (no auth) che ritorna `{ standard: string[], bio: string[], discount: string[] }`. Consumato da web (`useGetAcceptedStores`) e mobile per la sezione collassabile "Negozi accettati" nella schermata di scansione.

**Storico**: web e mobile mostrano `storeChain` come nome del negozio (se disponibile), con `province` accanto alla data (icona MapPin).

### Classificazione Prodotti (productClassifier.ts)
- **Open Food Facts** (primario): API gratuita, nessuna API key. Le chiamate includono `ecoscore_data` per ottenere dati Agribalyse (CO2 reale per kg)
- **Nutritionix** (secondario): richiede `NUTRITIONIX_APP_ID` + `NUTRITIONIX_API_KEY`. Free tier: 500 chiamate/giorno. Skipped se le env vars non sono configurate
- **USDA FoodData Central** (terziario): usa `USDA_API_KEY` o `DEMO_KEY` di fallback. Gratuito
- **GS1 Italia brand hints**: mappa `GS1_ITALY_PREFIXES` con 40+ prefissi produttori → nome brand. Fornito all'AI come `brandHint` per migliorare la classificazione
- **Claude AI Vision/Text fallback**: classificazione quando nessun database trova il prodotto. Punti conservativi (5-10)
- **Eco-Hero multiplier**: prodotti con keyword bio/organic/equo/vegan → punti x2 (max 40pt)
- **`resolveProductEmoji()`**: emoji intelligente basata su keyword nel nome prodotto (🥛🧀🍕🥩🫒🍝 ecc.)
- **`classifyManualProduct()`**: classificazione per inserimento manuale (form "No, aggiungi")
- **Cache**: `product_cache` table, key `barcode:{code}` o nome normalizzato. Salva `co2_per_unit`
- **Correzione prodotti**: `POST /api/scan/products/correct` per correggere un nome prodotto errato

### Transazione Atomica Barcode Confirm
```ts
db.transaction(async (tx) => {
  // 1. Check duplicate dentro tx
  // 2. Insert barcode_scan
  // 3. Update users.total_points
  // 4. Update receipts.points_earned
  // 5. Update greenItemsJson matched: true
}).catch(err => {
  if (err.code === "23505") return { error: "Già scansionato" }
  throw err
})
```

### Colors Mobile (constants/colors.ts)
```ts
Colors.leaf          // #2E6B50 (verde principale)
Colors.mint          // #51B888 (verde chiaro)
Colors.forest        // #1B2D26 (verde scuro)
Colors.primaryLight  // #D6EFE2 (sfondi badge/icone)
Colors.amber         // #F4A462 (warning, "Quasi!" badge)
Colors.red           // #EF4343 (errori)
Colors.border        // #D6DED3 (bordi card)
Colors.cardAlt       // #E3EBE0 (sfondo card alternativo)
Colors.tabActive     // = Colors.leaf
Colors.tabInactive   // = Colors.textMuted (#628477)
Colors.categoryColors  // mappa categoria → { bg, text } per badge Storico
```

### Zod / Orval Date Bug
Orval con `useDates: true` genera schemi Zod che si aspettano oggetti `Date`, **non** stringhe ISO. Non chiamare `.toISOString()` prima di passare dati a `.parse()`.

### TypeScript Composite
- Typechecking da root: `pnpm run typecheck`
- Non eseguire `tsc` dentro un singolo pacchetto (fallisce se deps non sono buildate)

### Proxy Routing (nota architetturale)
`leafy` gira su porta 24389 con `BASE_PATH=/` — cattura tutti i path sul proxy porta 80. `leafy-register` gira su porta 5000 con `BASE_PATH=/leafy-register/` ed è accessibile tramite il dropdown degli artifact nel preview pane.

---

## Design Tokens Mobile

```ts
// Tema verde foresta — constants/colors.ts
PRIMARY_LIGHT = "#D6EFE2"  // sfondi badge / icone
LEAF = "#2E6B50"            // colore principale (verde)
MINT = "#51B888"            // verde chiaro (accenti)
FOREST = "#1B2D26"          // verde scuro (testi/gradienti)
CREAM = "#F6F7F2"           // background
AMBER = "#F4A462"           // warning / "Quasi!" badge marketplace
```

---

## Credenziali di Test

| Utente | Email | Password |
|--------|-------|----------|
| Demo | `demo@test.app` | `Demo123456` |
| Personale | `labo@gmail.com` | `labo2406` |

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
