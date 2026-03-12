# Leafy — Sustainability Loyalty Platform

## Panoramica del Progetto

Leafy è una piattaforma loyalty mobile-first per la sostenibilità. Gli utenti scansionano scontrini della spesa, guadagnano punti per prodotti green (Bio, Km 0, Plastic-free, Fairtrade, Vegano, DOP/IGP), salgono di livello (Bronzo → Argento → Oro → Platino), completano sfide mensili, competono in classifiche e riscattano voucher nel marketplace.

**Stato attuale**: App funzionante con dati demo. Auth rinviata — utente demo hardcoded ID=1.

---

## Environment Variables / Secrets Necessari

| Variabile | Obbligatoria | Descrizione |
|-----------|-------------|-------------|
| `DATABASE_URL` | ✅ Sì | PostgreSQL connection string (fornita automaticamente da Replit) |
| `GOOGLE_CLOUD_VISION_API_KEY` | Consigliata | Google Vision API per OCR scontrini. Senza, usa keyword matching. |
| `ADMIN_PASSWORD` | No | Password pannello admin. Default: `leafy2026` |

Per impostare i secrets su Replit: **Tools → Secrets**.

---

## Come Avviare il Progetto

### Dev (Development)

```bash
# Installa dipendenze
pnpm install

# Avvia il DB (eseguito automaticamente da Replit)
pnpm --filter @workspace/db run push

# Avvia l'API server (porta 8080)
pnpm --filter @workspace/api-server run dev

# Avvia il frontend Leafy (porta da PORT env var)
pnpm --filter @workspace/leafy run dev
```

I workflow Replit gestiscono questi comandi automaticamente.

### Build Produzione

```bash
PORT=80 BASE_PATH=/ pnpm --filter @workspace/leafy run build
pnpm --filter @workspace/api-server run build
# Poi avviare: node artifacts/api-server/dist/index.cjs
```

Il frontend viene servito come file statici dall'API server in produzione (Express serva `artifacts/leafy/dist/public/`).

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
│   │   │   ├── routes/      # Sub-router per ogni dominio
│   │   │   │   ├── index.ts
│   │   │   │   ├── profile.ts
│   │   │   │   ├── receipts.ts
│   │   │   │   ├── scan.ts      # OCR + keyword parser + level detection
│   │   │   │   ├── challenges.ts
│   │   │   │   ├── leaderboard.ts
│   │   │   │   ├── marketplace.ts
│   │   │   │   └── admin.ts     # Admin panel backend (password protected)
│   │   │   └── lib/
│   │   │       └── scanner.ts   # Google Vision OCR + fallback keyword matching
│   │   └── package.json
│   ├── leafy/               # Frontend React/Vite
│   │   ├── src/
│   │   │   ├── App.tsx          # Router principale, route setup
│   │   │   ├── index.css        # Tema Leafy (CSS variables)
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx         # Dashboard: punti, progress ring, impatto
│   │   │   │   ├── Scan.tsx         # Camera + upload scontrino
│   │   │   │   ├── History.tsx      # Storico scontrini
│   │   │   │   ├── Marketplace.tsx  # Voucher e premi
│   │   │   │   ├── Profile.tsx      # Profilo utente, sfide, badge
│   │   │   │   ├── Settings.tsx     # Impostazioni account
│   │   │   │   └── Admin.tsx        # Pannello admin (/admin)
│   │   │   └── components/
│   │   │       ├── layout/
│   │   │       │   ├── AppLayout.tsx   # Shell layout con BottomNav
│   │   │       │   └── BottomNav.tsx   # Nav bar fissa in basso (fixed)
│   │   │       └── shared/
│   │   │           ├── LevelProgress.tsx  # Cerchio SVG progress animato
│   │   │           └── Onboarding.tsx     # Modal primo accesso (4 step)
│   │   └── package.json
│   └── mockup-sandbox/      # Sandbox mockup per canvas Replit
│       └── src/components/mockups/leafy-variants/
│           ├── NotteVerde.tsx   # Variante A: dark mode eco-luxury
│           └── Oceano.tsx       # Variante B: teal fresco
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec + Orval config
│   ├── api-client-react/    # React Query hooks generati (useGetProfile, ecc.)
│   ├── api-zod/             # Zod schemas generati dall'OpenAPI
│   └── db/                  # Drizzle ORM schema + connessione PostgreSQL
├── scripts/                 # Script di utilità
├── pnpm-workspace.yaml
├── tsconfig.base.json       # TS options condivise (composite, bundler, es2022)
└── tsconfig.json            # Root project references
```

---

## Pagine e Route Frontend

| Route | Pagina | Descrizione |
|-------|--------|-------------|
| `/` | `Home.tsx` | Dashboard principale: punti, cerchio livello, impatto |
| `/scan` | `Scan.tsx` | Scanner scontrino (camera + upload) |
| `/storico` | `History.tsx` | Lista scontrini scansionati |
| `/marketplace` | `Marketplace.tsx` | Voucher e premi riscattabili |
| `/profilo` | `Profile.tsx` | Profilo, sfide, badge, invita amici |
| `/impostazioni` | `Settings.tsx` | Impostazioni account, notifiche, privacy |
| `/admin` | `Admin.tsx` | Pannello admin (non usa AppLayout) |

---

## API Endpoints Principali

Base URL: `/api`

| Endpoint | Descrizione |
|----------|-------------|
| `GET /api/profile` | Profilo utente demo (ID=1) |
| `GET /api/impact` | Statistiche impatto ambientale |
| `POST /api/scan` | Scansiona scontrino (base64 img → punti) |
| `GET /api/receipts` | Lista scontrini |
| `GET /api/challenges` | Sfide mensili attive |
| `GET /api/leaderboard` | Classifica utenti |
| `GET /api/marketplace/vouchers` | Lista voucher disponibili |
| `POST /api/marketplace/vouchers/:id/redeem` | Riscatta voucher |
| `GET /api/admin/*` | Rotte admin (header `x-admin-password` richiesto) |

---

## Funzionalità Implementate

- **Scanner scontrini**: Upload foto → Google Vision OCR → estrazione prodotti green → assegnazione punti
- **Sistema punti e livelli**: Bronzo / Argento / Oro / Platino con progress ring animato
- **Sfide mensili**: Completamento sfide con progress bar e ricompense
- **Leaderboard**: Classifica utenti con badge di posizione
- **Marketplace**: Voucher riscattabili con punti
- **Badge/Achievements**: Collezione badge per categoria
- **Onboarding**: Modal 4-step al primo accesso (localStorage)
- **Admin panel**: `/admin` con stats, CRUD voucher/sfide (password: `leafy2026`)
- **Impostazioni**: `/impostazioni` con toggle notifiche, privacy, lingua
- **Design**: Tema verde foresta + menta + ambra su crema (CSS variables in `index.css`)
- **Bottom nav fissa**: `position: fixed` con indicatore animato (Framer Motion)

---

## Dettagli Tecnici Importanti

### Express 5 — Wildcard Route Fix
In Express 5, `app.get("*", ...)` genera errore `pathToRegexp`. Usare sempre:
```ts
app.get(/(.*)/,  handler)  // ✅ Corretto per Express 5
```

### Zod / Orval Date Bug
Orval con `useDates: true` genera schemi Zod che si aspettano oggetti `Date`, **non** stringhe ISO. Non chiamare `.toISOString()` prima di passare dati a `.parse()`.

### Utente Demo
`getOrCreateUser()` in `lib/scanner.ts` restituisce sempre ID=1. Nessun sistema auth in produzione (da implementare con Google/Facebook OAuth).

### OCR Scontrini
File: `artifacts/api-server/src/lib/scanner.ts`
- Tenta prima Google Vision API (`GOOGLE_CLOUD_VISION_API_KEY`)
- Fallback: keyword matching su testo (Bio, Km 0, Senza Plastica, Equo Solidale, Vegano, DOP/IGP)

### Database Migrations
In sviluppo: `pnpm --filter @workspace/db run push`
In produzione su Replit: gestite automaticamente al deploy.

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

## Varianti Design sul Canvas Replit

Sul canvas Replit ci sono 3 iframe affiancati per il confronto estetico:
1. **Originale** — App live (`/profilo` live)
2. **Notte Verde** — Dark mode, sfondo `#0d1f16`, glassmorphism cards
3. **Oceano** — Teal/azzurro `#0B7EA3`, sfondo `#f0f9ff`, font Poppins

Per vederle: Canvas → zoom out per vedere tutti e 3 i frame.

---

## Comandi Utili

```bash
# Installa tutto
pnpm install

# Push schema DB (dev)
pnpm --filter @workspace/db run push

# Codegen API (dopo modifiche a openapi.yaml)
pnpm --filter @workspace/api-spec run codegen

# Typecheck completo
pnpm run typecheck

# Build tutto
pnpm run build
```
