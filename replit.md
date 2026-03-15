# Leafy — Sustainability Loyalty Platform

## Panoramica del Progetto

Leafy è una piattaforma loyalty mobile-first per la sostenibilità. Gli utenti scansionano scontrini come prova d'acquisto, poi inquadrano i codici a barre dei prodotti per guadagnare punti basati sull'**Eco-Score** di Open Food Facts. Salgono di livello (🌱 Germoglio → 🌿 Ramoscello → 🍃 Arbusto → 🌳 Albero → 🌲 Foresta), completano sfide mensili e riscattano voucher nel marketplace.

**Stato attuale**: App Expo React Native funzionante (SDK 54) + backend Express/PostgreSQL + admin panel web + frontend web con sistema badge a due livelli (lifetime + temporali) + whitelist 51 supermercati italiani con validazione AI di catena e provincia. Economia calibrata con cap punti, bonus scontrino, Scontrino Virtuoso, Eco-Hero multiplier. Catena barcode multiAPI (OFF + Nutritionix + USDA + GS1 brand hints). Inserimento manuale prodotti con apprendimento AI. Sistema livelli a 5 stadi naturali (Germoglio→Foresta) con badge 3D, milestone bar e celebrazione level-up animata.

**UX/Design v2 — stato attuale**:
- **Sistema 5 livelli** (`calculateLevel` in `lib/db`): Germoglio 🌱 (0–499 pt), Ramoscello 🌿 (500–1999), Arbusto 🍃 (2000–4999), Albero 🌳 (5000–9999), Foresta 🌲 (10000+). Ogni livello ha colore tematico, emoji e badge 3D dedicato. La leaderboard è allineata agli stessi soglie.
- **LevelMilestoneBar** (`components/LevelMilestoneBar.tsx`): barra di progresso a 5 nodi nella home — nodi raggiunti = pieni, in corso = parzialmente riempiti, futuri = grigi. Segmenti con riempimento proporzionale ai punti del livello corrente.
- **Profilo level pill**: colore del pill di livello corrisponde al livello (verde chiaro→verde scuro→verde bosco→verde foresta).
- **LevelUpModal** (`components/LevelUpModal.tsx`): celebrazione animata in 3 fasi — (1) pulsazione crescente 1s, (2) flash bianco + particelle radiali 1.2s, (3) badge spring-in + coriandoli colorati + testo. Auto-close 3.7s, tap per chiudere anticipatamente.
- **LevelUpProvider** (`context/level-up.tsx`): context globale in `_layout.tsx`. Persiste il livello precedente su AsyncStorage con chiave user-scoped (`leafy_prev_level:<userId>`). Rileva level-up sia dopo scan (via `checkForLevelUp()`) sia al ritorno in foreground (AppState). Si resetta al cambio utente.
- **Badge 3D clay/glossy** (`BadgeIcon3D`): 20 immagini PNG AI-generate in stile 3D plastica lucida con sfondo trasparente — 15 badge originali + 5 badge di livello naturale (`level-sprout.png`, `level-twig.png`, `level-shrub.png`, `level-tree.png`, `level-forest.png`). `BadgeIcon3D` risolve i badge di livello tramite `category === "Livello"` + mappa nome→chiave. Stato bloccato = opacity ridotta + icona lucchetto centrata. Asset in `artifacts/leafy-mobile/assets/badges/`.
- **Home e Profilo**: Rimossi tutti gli emoji dalle intestazioni, streak, messaggi motivazionali e label di sezione; sostituiti con icone vettoriali `MaterialCommunityIcons` / `Feather` di `@expo/vector-icons`.
- **Scan screen**: Sostituito il cerchio pulsante da 300px (duplicato del floating button) con layout a card — card fullwidth verde per lo scontrino + due card affiancate per galleria e modalità spesa.
- **Auth flow mobile (GuestAuthScreen)**: La schermata di accesso è **inline** in `(tabs)/index.tsx` — nessuna navigazione verso `/login`. Il componente `GuestAuthScreen` gestisce tre stati: `landing` (logo + bottoni), `login` (accordion aperto su login), `register` (accordion aperto su register). Logout → `router.replace("/(tabs)")`. Il file `app/login.tsx` rimane ma non è più raggiungibile dall'app.
- **Accordion auth**: stato `expanded: "login" | "register" | null`. Quando un accordion è aperto, l'altro bottone scompare (visibilità condizionale). Il bottone attivo mantiene il suo colore originale (nessun highlight extra). Submit button testo: **"Conferma"**. Animazione fluida con `LayoutAnimation.configureNext` (Android: `UIManager.setLayoutAnimationEnabledExperimental`).
- **Bottoni auth**: `maxWidth: 280`, centrati con `alignItems: "center"`. "Accedi" → bianco pieno (#FFFFFF), testo verde. "Crea account" → bianco semi-trasparente (`rgba(255,255,255,0.20)`) con bordo bianco sottile — stile frosted glass coerente con lo sfondo verde.
- **OAuth buttons branded**: "Continua con Google" → sfondo bianco (#FFFFFF), testo grigio scuro (#3C4043), icona "G" blu (#4285F4) — colori ufficiali Google. "Continua con Facebook" → sfondo blu (#1877F2), testo e icona bianchi — colori ufficiali Facebook.

---

## Principi di Prodotto (non cancellare mai questa sezione)

> **Target audience: TUTTI i consumatori, non solo chi è già "green".**
>
> Leafy è pensata per il pubblico più ampio possibile. Include sia chi è già vicino al mondo della sostenibilità, sia il consumatore normale che, senza saperlo, potrebbe già acquistare prodotti sostenibili. L'app non deve mai risultare elitaria, moralizzante o rivolta solo a un pubblico di nicchia eco-consapevole. Ogni scelta di design, copy, tono e funzionalità deve rispettare questo principio: **accogliere tutti, premiare le scelte green senza giudicare quelle che non lo sono.**

---

## Artifacts

| Artifact | Path | Descrizione |
|----------|------|-------------|
| `leafy-mobile` | Expo app (preview path `/leafy-mobile/`) | App principale React Native (iOS/Android/web) |
| `api-server` | Express 5 (porta 8080, workflow: `artifacts/api-server: API Server`) | Backend REST API |
| `leafy` | React/Vite (porta 24389, preview path `/`) | Frontend web con sistema badge a due livelli |
| `leafy-register` | React/Vite (porta 5000, preview path `/leafy-register/`) | Pannello admin web |
| `mockup-sandbox` | Vite (preview path `/__mockup/`) | Sandbox per mockup componenti su canvas |

> **Nota migrazione Replit**: tutti gli artifact sono ora registrati nel selettore app. L'API server gira tramite il workflow dedicato `artifacts/api-server: API Server` (non più via "Start application").

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
| `NUTRITIONIX_APP_ID` | Opzionale | App ID per Nutritionix barcode lookup (500 lookups/giorno gratis). Registrati su developer.nutritionix.com |
| `NUTRITIONIX_API_KEY` | Opzionale | API Key per Nutritionix. Richiesta insieme a `NUTRITIONIX_APP_ID` |
| `USDA_API_KEY` | Opzionale | API Key per USDA FoodData Central (default: DEMO_KEY, illimitato ma throttled). Registrati su fdc.nal.usda.gov |
| `ADMIN_PASSWORD` | No | Password pannello admin. Default: `leafy2026` |
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
# Clona il repo
git clone https://github.com/labo420/Leafy.git
cd Leafy

# Copia il template variabili d'ambiente e compila i valori
cp .env.example .env
# edita .env con DATABASE_URL, SESSION_SECRET, NGROK_AUTH_TOKEN, ecc.

# Installa dipendenze e inizializza DB
pnpm install
pnpm --filter @workspace/db run push

# Avvia
PORT=8080 pnpm --filter @workspace/api-server run dev
```

### File importanti per la consistenza

| File | Scopo |
|------|-------|
| `.env.example` | Template di tutti i secrets necessari — committato nel repo |
| `.gitignore` | Esclude `.env`, `node_modules`, `.local/`, `.cache/`, `dist/` |
| `.github/workflows/ci.yml` | GitHub Actions: typecheck + build ad ogni push su `main` |
| `pnpm-workspace.yaml` | Definisce il monorepo pnpm |
| `lib/db/src/schema/` | Schema Drizzle — il DB viene ricreato con `pnpm --filter @workspace/db run push` |

### Cosa NON viene committato

- `.env` — i secrets reali rimangono solo in locale o su Replit Secrets
- `node_modules/`, `dist/`, `.cache/`, `.local/` — ricostruibili
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
# Avvia il dev server Expo
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
| Eco-Score | Open Food Facts + Nutritionix + USDA FoodData Central + GS1 brand hints |
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
│   │       │   ├── scan.ts         # Flusso scontrino (proof-only) + barcode lookup/confirm + manual-classify
│   │       │   ├── receipts.ts     # GET lista + dettaglio con barcode scans (status/isPending/remainingHours)
│   │       │   ├── auth.ts         # Login email, Google, Facebook, Replit OIDC
│   │       │   ├── profile.ts      # Profilo utente, requireUser middleware, pendingValidations
│   │       │   ├── admin.ts        # Admin panel backend (password protected)
│   │       │   ├── badges.ts       # GET /api/badges/my — badge lifetime + temporali
│   │       │   ├── challenges.ts
│   │       │   ├── leaderboard.ts
│   │       │   └── marketplace.ts
│   │       ├── seed-badges.ts      # 15 badge seed idempotenti (per nome)
│   │       └── lib/
│   │           ├── productClassifier.ts  # Catena: OFF → Nutritionix → USDA → vision → AI+GS1 brand hints. validateReceiptWithAI: Vision OCR (gratis) → Haiku testo (quasi gratis), fallback Haiku vision
│   │           ├── supermarketWhitelist.ts # 51 catene italiane (standard/bio/discount) + matchChain()
│   │           ├── antiFraud.ts          # 8-layer anti-frode system
│   │           ├── scanner.ts            # Google Vision OCR + keyword matching
│   │           ├── auth.ts               # Session store
│   │           ├── receiptImages.ts      # Upload/serve/delete foto scontrini (GCS)
│   │           ├── receiptImageCleanup.ts # Pulizia automatica foto scadute (30gg)
│   │           └── objectStorage.ts      # GCS client wrapper (Replit sidecar auth)
│   ├── leafy-mobile/        # App Expo React Native
│   │   ├── app/
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx         # Home: punti, livello, impatto
│   │   │   │   ├── scan.tsx          # Flusso scontrino: camera → conferma → sessione barcode (+ bonus chips welcome/receipt)
│   │   │   │   ├── storico.tsx       # Lista scontrini + dettaglio con badge pending/verificato
│   │   │   │   ├── marketplace.tsx
│   │   │   │   └── profilo.tsx       # Traguardi (lifetime) + Sfide (temporali) con BadgeIcon3D
│   │   │   ├── barcode-scanner.tsx   # Scanner barcode: scan → preview → conferma/No,aggiungi → manual form → confirm
│   │   │   ├── shopping-scanner.tsx  # Modalità Spesa: stima punti senza scontrino
│   │   │   ├── login.tsx
│   │   │   └── _layout.tsx
│   │   ├── assets/badges/            # 15 PNG badge 3D clay/glossy con sfondo trasparente
│   │   └── components/
│   │       ├── BadgeIcon3D.tsx       # Badge 3D: Image-based, emoji→PNG map, locked state con opacity + lucchetto
│   │       └── BadgeIcon.tsx         # Badge SVG esagonale (legacy, non più usato in profilo)
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
│               └── BadgeDemo.tsx   # Preview canvas badge (/__mockup/preview/badge-demo/BadgeDemo)
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
│   │       ├── product-cache.ts  # cache lookup prodotti (barcode:{code})
│   │       ├── user-product-submissions.ts  # contribuzioni utenti per AI learning
│   │       └── ...
│   └── integrations-anthropic-ai/  # Anthropic client via Replit proxy
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

---

## Economia Leafy

### Tasso di Conversione
- **100 punti = 1€** di valore voucher

### Punti per Prodotto (Eco-Score)
| Eco-Score | Punti base |
|-----------|------------|
| A | 20 |
| B | 15 |
| C | 8 |
| D | 3 |
| E | 0 |

### Bonus e Moltiplicatori
| Meccanismo | Punti | Condizione |
|------------|-------|------------|
| Bonus scontrino | +5 pt | Per ogni scontrino validato |
| Welcome bonus | +100 pt | Primo scontrino in assoluto dell'utente |
| Scontrino Virtuoso | +20 pt | 3+ prodotti green (≥10 pt) nello stesso scontrino |
| Eco-Hero x2 | x2 (max 40 pt) | Prodotti sfuso/km0/fair trade/ricaricabile/zero plastica |

### Cap Anti-Abuso
| Cap | Limite |
|-----|--------|
| Per scontrino | Max 150 pt |
| Per giorno | Max 200 pt |

### Goldilocks Zone
- Target: ~4 settimane di uso regolare per riscattare un voucher da 5€

---

## Validazione Scontrino (validateReceiptWithAI)

File: `artifacts/api-server/src/lib/productClassifier.ts` — funzione `validateReceiptWithAI`

### Architettura a costo quasi zero
Pipeline in due step per minimizzare i costi:

1. **Google Vision API** (`GOOGLE_CLOUD_VISION_API_KEY`) — estrae il testo OCR grezzo dalla foto (gratis fino a 1000 richieste/mese). Se configurata, restituisce il testo strutturato dello scontrino.
2. **Claude Haiku** — analizza il testo OCR (non l'immagine!) per estrarre data, totale, prodotti ecc. Testo puro = token minimi = costo vicino a zero.

Se Vision non è configurata o fallisce → fallback automatico su **Haiku con immagine** (costa leggermente di più ma funziona uguale).

| Scenario | Costo per scontrino |
|----------|---------------------|
| Vision (testo) + Haiku | ~$0.000001 |
| Solo Haiku con immagine (fallback) | ~$0.000030 |
| ~~Sonnet con immagine (rimosso)~~ | ~~$0.00015-$0.0003~~ |

### Documenti accettati (tutti equivalenti in Italia)
- Scontrino fiscale / ricevuta fiscale
- **Documento Commerciale** (ha sostituito la ricevuta fiscale dal 2020 per legge italiana)
- Ricevuta generica / ticket di cassa

### Formati data gestiti
Il parser normalizza automaticamente tutti i formati italiani in `YYYY-MM-DD`:
| Formato sullo scontrino | Esempio | Risultato |
|------------------------|---------|-----------|
| GG/MM/AA | 15/03/26 | 2026-03-15 |
| GG/MM/AAAA | 15/03/2026 | 2026-03-15 |
| GG.MM.AAAA | 15.03.2026 | 2026-03-15 |
| GG-MM-AAAA | 15-03-2026 | 2026-03-15 |
| GG MM AAAA | 15 03 2026 | 2026-03-15 |
| GG/MM (anno assente) | 15/03 | 2026-03-15 |

Se l'anno ha 2 cifre, viene anteposto `20` (es. `26` → `2026`). Se l'anno manca del tutto, viene usato l'anno corrente.

### Etichette totale riconosciute
`TOTALE COMPLESSIVO`, `TOTALE`, `TOT. COMPLESSIVO`, `TOT`, `IMPORTO`, `DA PAGARE`, `PAGATO`, `AMOUNT`, `TOTALE EURO`
Il separatore decimale può essere virgola o punto (es. `€4,19` = `€4.19` = 419 centesimi).

### Deduzione provincia dal CAP
La provincia viene dedotta dal CAP stampato nell'indirizzo del punto vendita. Sono mappati i range CAP di tutte le province italiane. Fallback: deduzione dal nome del comune capoluogo nell'indirizzo.

### Logica di completezza (permissiva)
Lo scontrino viene **sempre accettato** se `isReceipt: true`, anche se mancano data o totale:
- Data mancante → fallback alla data odierna (`effectiveDate = today`)
- Totale mancante → `effectiveTotal = null` (i punti vengono calcolati sui prodotti, non sul totale)
- `isReceipt: false` → unico caso in cui lo scontrino viene rifiutato

Il check anti-duplicato si attiva solo quando entrambi `validation.date` e `validation.totalCents` sono presenti (valori reali letti dallo scontrino, non fallback).

### Pattern data per catena
Il prompt istruisce l'AI a cercare la data **ovunque** nel documento, incluso il codice transazione finale:
- **Aldi**: data nel codice transazione → `"0767-422/04i-060-000 15/03/26 13.46"` → `2026-03-15`
- **Lidl, Eurospin, Penny**: data in fondo allo scontrino dopo l'orario di cassa
- **Esselunga, Coop**: data nella riga `"Data:"` o nell'intestazione

---

## Catena di Lookup Barcode

Ordine di ricerca quando un utente scansiona un codice a barre:

1. **Cache locale** (`product_cache` tabella) — risposta istantanea se già cachato
2. **Open Food Facts** — endpoint italiano (`it.openfoodfacts.org`) + mondiale (`world.openfoodfacts.org`)
3. **Nutritionix** — se `NUTRITIONIX_APP_ID` e `NUTRITIONIX_API_KEY` sono configurati (500/giorno gratis)
4. **USDA FoodData Central** — gratuito senza chiavi (usa `DEMO_KEY` o `USDA_API_KEY`)
5. **Vision AI** — se il client ha inviato una foto del prodotto, Claude Vision identifica il prodotto
6. **AI + GS1 brand hint** — Claude AI con il nome del produttore da prefisso GS1 (40+ brand italiani mappati: Mondelez, Ferrero, Barilla, Nestlé, De Cecco, ecc.)
7. **AI puro** — fallback finale, classificazione conservativa (5 pt, "Prodotto alimentare")

Ogni risultato positivo viene cachato in `product_cache` per lookup futuri istantanei.

### Inserimento Manuale ("No, aggiungi")
Quando il prodotto non viene rilevato correttamente:
- L'utente preme **"No, aggiungi"** (ex "No, salta") per aprire il form manuale
- Inserisce nome, peso, foto fronte/retro → Claude Vision classifica
- Il risultato viene cachato sotto `barcode:{code}` → il prossimo utente che scansiona lo stesso barcode riceve risposta istantanea
- La submission viene salvata in `user_product_submissions` per analisi e miglioramento AI

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

### Pagina Profilo Web (`leafy` — `src/pages/Profile.tsx`)
- **Tab Traguardi**: badge lifetime — sblocati con data, locked con barra di progresso
- **Tab Sfide**: badge temporali — attivi del periodo corrente + archivio periodi passati
- Autenticazione richiesta (protetta da `AuthGate` in `App.tsx`)

### Schermata Profilo Mobile (`leafy-mobile` — `app/(tabs)/profilo.tsx`)
- **Tab Traguardi**: `LifetimeBadgeCard` con `BadgeIcon3D` — badge PNG 3D clay, progress bar se non sbloccati
- **Tab Sfide**: `TemporalBadgeCard` con `BadgeIcon3D` — badge attivi del periodo + archivio compatto
- **`BadgeIcon3D`** (`components/BadgeIcon3D.tsx`): mappa ogni emoji del badge alla rispettiva PNG 3D in `assets/badges/`. Stato bloccato = opacity 35% + overlay con icona lucchetto. Prop `size` per dimensionamento dinamico.
- Badge disponibili (emoji → file PNG):

| Emoji | Badge | File |
|-------|-------|------|
| 🌱 | Pioniere Bio | `badge-sprout.png` |
| 🧾 | Primo Scontrino | `badge-receipt.png` |
| 📍 | Eroe Locale | `badge-map-pin.png` |
| 🐬 | Amico degli Oceani | `badge-dolphin.png` |
| ♻️ | Re del Riciclo | `badge-recycle.png` |
| 🏃 | Maratoneta Verde | `badge-running.png` |
| 🥈 | Livello Argento | `badge-silver-medal.png` |
| 🥇 | Livello Oro | `badge-gold-medal.png` |
| 💎 | Livello Platino | `badge-diamond.png` |
| 👥 | Ambasciatore | `badge-friends.png` |
| 🔥 | Eroe Settimanale | `badge-fire.png` |
| 🌊 | Settimana Plastic-Free | `badge-wave.png` |
| 🏆 | Campione del Mese | `badge-trophy.png` |
| 🌿 | Vegano Curioso | `badge-leaf.png` |
| 🌍 | Guerriero Invernale | `badge-earth.png` |

---

## Flusso di Scansione (Two-Phase Flow)

### Fase 1 — Scontrino come prova d'acquisto
1. Utente fotografa lo scontrino (hint: "totale e data devono essere visibili")
2. `POST /api/scan` → AI validation (is receipt? complete? `storeChain`? `province`? metadata) → whitelist check → semantic dedup → anti-frode → AI product extraction → classification → punti
3. Se non è uno scontrino → errore "Non sembra uno scontrino"
4. Se incompleto (data/totale mancanti) → errore con lista info mancanti
5. **Se negozio non in whitelist** → HTTP 400 "Scontrino non accettato — Leafy funziona con i principali supermercati italiani."
6. Se duplicato semantico (stessa data + totale) → errore "Già scansionato"
7. Risposta: `{ receiptId, barcodeExpiry (now+24h), pointsEarned, greenItemsFound, receiptBonusPts, welcomeBonus?, welcomeBonusPts?, ... }`
8. App mostra risultato con bonus chips (welcome +100pt, scontrino +5pt) e prodotti trovati e CTA per scansionare barcode

### Fase 2 — Barcode scanner per i punti
1. Utente apre lo scanner e inquadra il codice a barre
2. `POST /api/scan/barcode/lookup` → cerca su catena multiAPI → ritorna preview (nome, Eco-Score, punti, cap remaining) **senza credito**
3. App mostra la preview, utente preme **Sì, aggiungi** (conferma) o **No, aggiungi** (apri form manuale per correggere)
4. `POST /api/scan/barcode/confirm` → transazione DB atomica → credito punti → mostra cap info + eventuale Scontrino Virtuoso
5. `POST /api/scan/barcode/manual-classify` → classificazione manuale con foto → caching + salvataggio in `user_product_submissions`
6. Sessione valida 24h; max 150 punti/scontrino, 200 punti/giorno; no duplicati per scontrino

### Modalità Spesa (Shopping Mode)
Funzione aggiuntiva: l'utente scansiona barcode **mentre fa la spesa** (senza scontrino) per ottenere una **stima** dei punti.
- Endpoint: `POST /api/scan/barcode/preview` — lookup prodotto senza receiptId, nessun credito punti
- Schermata mobile: `app/shopping-scanner.tsx` — camera scanner + lista prodotti in-memory + report finale
- Accesso: bottone "Modalità Spesa" nella tab Scansiona (visivamente secondario)
- Tutti i punti mostrati sono stime (~) — disclaimer visivo sempre presente
- Nessuna scrittura DB, sessione completamente in-memory

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
| `GET /api/profile` | Profilo (livello, badge, sfide, pendingValidations) |
| `PUT /api/profile/username` | Aggiorna username |
| `PUT /api/profile/image` | Aggiorna foto profilo (base64) |
| `DELETE /api/profile/account` | Cancella account |
| `GET /api/profile/impact` | Statistiche impatto ambientale |
| `GET /api/profile/referral` | Codice referral |
| `POST /api/profile/referral/apply` | Applica codice referral |

### Scontrini e Scan
| Endpoint | Descrizione |
|----------|-------------|
| `POST /api/scan` | Valida scontrino + whitelist check → apre sessione 24h (+ bonus 5pt + welcome 100pt) |
| `POST /api/scan/barcode/lookup` | Preview prodotto da barcode (NO credito punti, richiede receiptId) con cap info |
| `POST /api/scan/barcode/preview` | Preview standalone (Modalità Spesa) — solo stima punti, no receiptId |
| `POST /api/scan/barcode/confirm` | Conferma e accredita punti (+ Scontrino Virtuoso se 3+ green) con cap remaining |
| `POST /api/scan/barcode/manual-classify` | Classificazione manuale con foto → cache + user_product_submissions |
| `GET /api/scan/active-session` | Sessione barcode attiva + prodotti scansionati |
| `GET /api/receipts` | Lista scontrini (incl. `storeChain`, `province`, `hasImage`, `isPending`, `remainingHours`) |
| `GET /api/receipts/:id` | Dettaglio: greenItems + barcodeScans + Eco-Score + foto + `pendingProductsCount` |
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
- `status` = `approved` | `pending` | `rejected`
- `receipt_date` = data scontrino (YYYY-MM-DD) estratta dall'AI per anti-duplicato semantico
- `receipt_total` = totale scontrino in centesimi estratto dall'AI per anti-duplicato semantico
- `image_url` = path GCS della foto scontrino (pattern: `receipts/{userId}/{receiptId}.jpg`)
- `image_expires_at` = scadenza foto (30 giorni dopo upload)
- `store_chain` = nome normalizzato della catena (es. "Esselunga", "Lidl") estratto dall'AI
- `province` = provincia italiana dedotta dall'indirizzo sullo scontrino (es. "Milano"), estratta dall'AI. Sempre `null` se non determinabile

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
`source`: `openfoodfacts` | `openfoodfacts-ai` | `nutritionix` | `usda` | `ai` | `ai-fallback` | `manual`

### `user_product_submissions`
```
id, user_id (FK), barcode (nullable), product_name, weight_value, weight_unit,
eco_score, points_awarded, classified_by_ai (bool), created_at
```
Log di tutti i prodotti inseriti manualmente dagli utenti. Usato per migliorare la classificazione AI e popolare la cache prodotti.

### `badges`
```
id, name, emoji, category, description, unlock_hint,
badge_type (lifetime|weekly|monthly|seasonal),
target_count, period_key, is_active, created_at
```

### `user_badges`
```
id, user_id (FK), badge_id (FK), unlocked_at, period_key (nullable)
```

### Altre tabelle
- `products` — catalogo prodotti (legacy)
- `vouchers` — marketplace voucher
- `challenges` — sfide mensili
- `conversations` / `messages` — chat (futuro)

---

## Note Tecniche Importanti

### Open Food Facts API
```
GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json
```
Campi usati: `product_name`, `ecoscore_grade`, `ecoscore_score`, `ecoscore_data`, `labels`, `categories`, `packaging_tags`, `origins`.
Per barcode italiani (800-809), il server prova prima `it.openfoodfacts.org`.

### Nutritionix API
```
GET https://trackapi.nutritionix.com/v2/search/item/?upc={barcode}
Headers: x-app-id, x-app-key, x-remote-user-id
```
Saltato silenziosamente se le chiavi non sono configurate. 500 lookups/giorno gratis.

### USDA FoodData Central API
```
GET https://api.nal.usda.gov/fdc/v1/foods/search?query={barcode}&api_key=DEMO_KEY&pageSize=1
```
Usa `DEMO_KEY` (100 req/ora) se `USDA_API_KEY` non è configurata. Migliore per brand US/internazionali.

### GS1 Italy Brand Hints
Mappa di 40+ prefissi GS1 italiani (7 cifre) → brand produttore. Usata come hint per l'AI quando nessun database identifica il barcode. File: `productClassifier.ts`, costante `GS1_ITALY_PREFIXES`.

### Anti-frode barcode
- Dedup: constraint unique `(receipt_id, barcode)`, avvolto in try/catch
- Image fraud: Claude Vision con confidenza >= 0.7 blocca (solo con imageBase64)
- Cap globali: MAX_RECEIPT_POINTS (150) + MAX_DAILY_POINTS (200) in costanti globali

### Product Cache
- Chiave primaria: `product_name_normalized` = `barcode:{codice}`
- Condivisa tra tutti gli utenti
- Una volta cachato, il lookup è istantaneo (skip di tutte le API esterne)
- Il manual-classify cancella la cache esistente prima di ri-classificare

### Sessione Cookie
- `express-session`-like custom store in-memory
- Cookie `session_id` con `httpOnly`, `secure` (in produzione), `sameSite: none`
- SHA-256 session token
- Max-age: 30 giorni
