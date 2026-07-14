# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InovLAR** is a tablet-based communication and assistance system for nursing home patients. It has two interfaces:
- **Utente (Patient)**: Tablet board with customizable buttons/requests, request history drawer, emergency SOS
- **Staff**: Management console for patient profiles, button customization, request monitoring, customizable layouts/templates

**Tech stack:** React (Vite, Ant Design, Bootstrap) × Express (Sequelize ORM, **MariaDB**) × Socket.io × bcryptjs auth

> Migrated off SQLite (mid-2026) — SQLite caused a SEGV crash loop on the Pi's armhf/aarch64 build. See `DEVELOPMENT_LOG.md` for the migration history and the MariaDB-specific gotchas below.

---

## Quick Start

Requires Node ≥ 20 (the `mariadb` connector needs it) and a running local MariaDB instance.

### First-time setup

**Shortcut (Windows):** `./install.ps1` from the repo root does steps 1–3 below in one shot (creates the dev DB/user, writes `Server/.env`, `npm i` both projects, migrates + seeds). Idempotent — safe to re-run. See `Get-Help ./install.ps1 -Full` for params (DB name/user, root password, etc.).

1. **Create the DB + app user in MariaDB:**
   ```powershell
   mysql -u root -p -e "CREATE DATABASE inovlar_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'inovlar_app'@'localhost' IDENTIFIED BY 'yourpassword'; GRANT ALL ON inovlar_dev.* TO 'inovlar_app'@'localhost'; FLUSH PRIVILEGES;"
   ```
2. **Configure `Server/.env`** (copy `Server/.env.example`, then fill in `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`). Never committed — it's in `.gitignore`.
3. **Install, migrate, seed:**
   ```bash
   cd Server
   npm i
   npx sequelize-cli db:migrate
   npx sequelize-cli db:seed:all   # seeds the 43 default botões
   node main.js                     # runs on port 3000
   ```
4. **Client (separate shell):**
   ```bash
   cd Client
   npm i
   npm run dev                  # Vite dev server with HMR (port 5173), talks to API on :3000
   ```

### After first setup

**Server:** `cd Server && node main.js`
**Client:** `cd Client && npm run dev`

(No need to repeat `db:migrate`/`db:seed:all` unless new migrations/seeders were added.)

### Production build

```bash
cd Client && npm run build   # generates Client/dist/
cd ../Server && node main.js # serves React build + API + socket.io on http://<ip>:3000
```

Raspberry Pi deployment (MariaDB install, DB/user creation, migrations, systemd service) is automated by `install.sh` at the repo root — see it and `DEVELOPMENT_LOG.md` (Phase 3 entries) for the deployment-specific gotchas (Node version resolution under `sudo`, `lower_case_table_names` differences between Windows/Linux MariaDB, etc.).

---

## Architecture

### Core Concepts

1. **Kiosk Mode:** The tablet starts locked (`staffUnlocked: false`). Staff enters PIN to access management console. Entering patient board (`/main/:token`) closes the gate. Only PIN reopens staff access — physical reset or deleting the `StaffAuth` row in MariaDB.

2. **Two Authentication Paths:**
   - **Staff:** Shared password per device (bcrypt-hashed). Session cookie (httpOnly, signed, ~1 year) holds a random 32-byte token; only its **SHA-256 hash** is stored server-side, in `StaffSession` (one row per active session). `requireStaff` (`middleware/auth.js`) is `async` and validates the token against that table on every request (fail-closed on error) — the cookie value itself proves nothing without a matching, non-expired row. `logout` deletes the row (real revocation); expired rows are lazily deleted on validation attempt, no periodic sweep. Changing the PIN does **not** revoke existing sessions (shared device PIN — revoking would log out every tablet). `/auth/staff/login`, `/setup`, and `/change` are rate-limited (`middleware/rateLimiter.js`: 5 failed attempts / 10 min / IP) against PIN brute-force.
   - **Utente:** Token-based access (no auth per se; URL is the secret: `/main/{token}`).

3. **State Management:**
   - **ContextProvider:** Global state (utentes, botoes, pedidos, staffUnlocked) + API calls delegated to `api/` layer. It wraps `<Router>` in `App.jsx`, so it **survives all SPA navigation** — re-entering a page for the same entity (e.g. same patient's board) does *not* automatically refetch unless the effect's dependency actually changes. If a page looks stale on re-entry without a socket event in between, check whether its `useEffect` unconditionally refetches on mount vs. only on id-change (see `TabuleiroComunicacao.jsx` and the 2026-07-03 entry in `DEVELOPMENT_LOG.md`).
   - **API Layer** (`src/api/`): Pure functions for HTTP requests (GET, POST, PUT, DELETE).
   - **Socket.io:** Real-time sync of DB changes across clients.

4. **Responsive Design:** Sidebar+header on desktop; bottom navigation bar on mobile. Layout components centralized in `Components/layout/`.

5. **Schema management is split, not uniform:** `Utente`, `Botao`, `Pedido` (and the `UtenteBotoes` join table) are managed by Sequelize **migrations** (`Server/migrations/`, run via `sequelize-cli db:migrate`). `StaffAuth`, `StaffSession`, `TabelaLayout`, `TabelaPadrao` are instead created via `Model.sync()` called directly in `main.js` on every server start — no migration files for these. When adding a column to the first group you must write a migration; for the second group, editing the model is enough.

### File Structure

**Client (React + Vite)**
```
Client/src/
├── api/              # HTTP requests by resource (botoes, utentes, pedidos, tabela, auth)
├── Components/
│   ├── layout/       # StaffShell, StaffSidebar, StaffBottomNav, ItemMenu, navItems.js
│   ├── botoes/       # EditBotoes (container) + BotoesList + BotaoForm + ConflitoImagemModal
│   ├── utentes/      # EditUtente, NewUtente, UtenteForm
│   ├── pedidos/      # PedidosPhone, PedidosTV (view modes) + decorate.js (pedido→visual props) + usePagedRotation + useViewportMode
│   ├── tabela/       # TabelaEditor, TabelaPreview, ButtonTile, constants.js, gridSpans.js
│   ├── RequireStaff.jsx       # Gate: blocks staff routes if staffUnlocked=false
│   ├── Keypad.jsx             # Reusable numeric keypad (PIN, password)
│   ├── PinPrompt.jsx          # Modal to exit patient board
│   ├── SuccessModal.jsx
│   └── RequestListDrawer.jsx
├── Pages/
│   ├── Welcome.jsx            # Home screen (kiosk mode off)
│   ├── StaffLogin.jsx         # PIN screen (define/login)
│   ├── StaffHome.jsx          # Patient list management
│   ├── PedidosPendentes.jsx   # Monitor view (large screen format)
│   ├── TabuleiroComunicacao.jsx  # Patient board (the "cage"; exit via PIN modal)
│   ├── GerirTabela.jsx, GerirTemplate.jsx  # Table/template editors
│   ├── TabelasView.jsx, ChangePassword.jsx
│   └── [Orphaned] Home.jsx, UtenteHome.jsx, AbrirUtente.jsx, BindUtente.jsx, EscreverMensagem.jsx
├── ContextProvider.jsx        # Global state + state setters
├── App.jsx                    # Router + protected routes via RequireStaff
├── main.jsx
└── index.css                  # Global styles + responsive utilities
```

**Server (Express + Sequelize)**
```
Server/
├── config/
│   ├── config.js         # sequelize-cli dialect config, reads DB_* from .env (dialect: 'mariadb')
│   ├── database.js       # Sequelize instance built from config.js, used by models/index.js
│   └── auth.js           # COOKIE_SECRET, MIN_DIGITOS
├── .env                  # DB_NAME/DB_USER/DB_PASS/DB_HOST/DB_PORT — gitignored, copy from .env.example
├── models/
│   ├── Botao.js          # Button/quick-request (imagem: allowNull)
│   ├── Utente.js         # Patient (hasMany Botao, hasMany Tabela)
│   ├── Pedido.js         # Request instance (timestamps, status); tableName: 'pedidos' (lowercase — see gotcha below)
│   ├── StaffAuth.js      # Single row: passwordHash — sync()'d, no migration
│   ├── StaffSession.js   # Active staff sessions: tokenHash (SHA-256, unique) + expiraEm — sync()'d, no migration
│   ├── TabelaLayout.js   # User-specific table layout (utente + device) — sync()'d, no migration
│   ├── TabelaPadrao.js   # Template for bulk apply to patients — sync()'d, no migration
│   └── index.js          # Exports + associations
├── routes/
│   ├── route.js          # Main API endpoints (auth, utentes, botoes, pedidos, tabelas, imagesBotoes)
│   └── images.js         # GET /imagesBotoes (flat listing; no subdirs)
├── controller/           # Request handlers (authController, utente*, botao*, etc.)
├── middleware/
│   ├── auth.js           # requireStaff — async, validates session token against StaffSession (fail-closed)
│   └── rateLimiter.js    # staffAuthLimiter — 5 failed attempts/10min/IP on /auth/staff/{login,setup,change}
├── Util/
│   ├── sessions.js       # criarSessao/validarSessao/revogarSessao — StaffSession helpers (hashes token, lazy expiry cleanup)
│   ├── socketIO.js       # Socket.io setup + notificarAlteracaoBD broadcast
│   └── seedDefaults.js   # Create "Predefinida" template on first run (runs once — guards on TabelaPadrao.count())
├── seeders/              # Seed scripts (43 default botões); no run-once tracking table, re-running errors on dup IDs
├── migrations/           # Sequelize migrations for Utente/Botao/Pedido/UtenteBotoes — run via db:migrate
├── public/               # Static files served by Express
│   ├── imagesBotoes/     # Flat structure (no subfolders); upload/delete here
│   └── [other assets]
├── views/                # Orphaned EJS views (replaced by React SPA)
└── main.js               # Entry point: Express + socket.io + static file serving; also calls sync() for the 3 non-migrated models
```

**MariaDB table-name gotcha:** table/column name casing is compared case-*insensitively* on Windows MariaDB (`lower_case_table_names=1`) but case-*sensitively* on Linux (default on the Pi/Debian, `=0`). A migration that creates `'Pedidos'` while the model declares `tableName: 'pedidos'` will silently work on Windows dev but throw `ER_NO_SUCH_TABLE` on the Pi. Always create tables with the exact lowercase name the model uses; see `Server/migrations/20260703150000-rename-pedidos-table.js` for the fix pattern (checks `information_schema.tables` with `BINARY` before renaming, so it's a no-op where the name is already correct).

---

## API Endpoints

### Authentication
- `GET /auth/staff/status` → `{ configurado, autenticado }`
- `POST /auth/staff/setup` + `{ password }` → initial PIN setup
- `POST /auth/staff/login` + `{ password }` → validate & refresh session cookie
- `POST /auth/staff/change` + `{ currentPassword, newPassword }` → **[requireStaff]**
- `POST /auth/staff/logout` → clear cookie

### Utentes (Patients)
- `GET /utentes` → all patients
- `GET /utentes/:id` → single patient
- `POST /utentes/create` + body → **[requireStaff]**
- `PUT /utentes/:id` + body → **[requireStaff]**
- `DELETE /utentes/:id` → **[requireStaff]**

### Botões (Buttons)
- `GET /botoes` → all buttons
- `POST /botoes` + body → **[requireStaff]**
- `PUT /botoes/:id` + body → **[requireStaff]**
- `DELETE /botoes/:id` → **[requireStaff]**
- `POST /imagesBotoes/upload` (multipart) → `{ path }` **[requireStaff]**
- `DELETE /imagesBotoes` + `{ path }` → nullify imagem in dependent botões **[requireStaff]**

### Pedidos (Requests)
- `GET /pedidos` → all requests
- `GET /pedidos/ativos/hora` → active by time
- `GET /pedidos/ativos/emergencia` → SOS emergencies
- `POST /pedidos` + body → patient creates request (no auth)
- `PUT /pedidos/:id` + body → patient updates own request (no auth)
- `DELETE /pedidos/:id` → **[requireStaff]**

### Tabelas (Layouts)
- `GET /utentes/:id/tabela/:dispositivo` → get layout for device (phone/tablet)
- `PUT /utentes/:id/tabela/:dispositivo` + body → **[requireStaff]**
- `GET /tabelas-padrao` → templates
- `POST /tabelas-padrao` + body → **[requireStaff]**
- `PUT /tabelas-padrao/:id` + body → **[requireStaff]**
- `DELETE /tabelas-padrao/:id` → **[requireStaff]**
- `POST /tabelas-padrao/:id/aplicar` + `{ utenteIds }` → **[requireStaff]**

### Images
- `GET /imagesBotoes` → list all images in flat structure

---

## Key Design Decisions

### 1. Staff Authentication
- **Shared password** (device-level, not per-user) — matches kiosk workflow; no per-person accounts needed.
- **Real server-side sessions, not a stateless signed value** — the cookie carries a random 32-byte token; only its SHA-256 hash lives in `StaffSession`. This replaced an earlier design where the signed cookie just held the literal string `"ok"` (unrevocable, and a leaked `COOKIE_SECRET` could forge a valid cookie forever). See `SECURITY_CHECKLIST.md` and the 2026-07 entries in `DEVELOPMENT_LOG.md` for the full rationale.
- **SHA-256 for the token, not bcrypt** — the token is already high-entropy (256 bits) random data, not a low-entropy password; a fast hash is correct here and bcrypt would just add latency per request.
- **Bcryptjs** (not native bcrypt) — cross-platform JS; avoids build issues on Windows. (Still used for the PIN itself, cost factor 10.)
- **Rate limiting on `/auth/staff/{login,setup,change}`** (`rateLimiter.js`) — mitigates brute-force of the 4-digit PIN; counts only failed attempts so normal use isn't penalized.
- **Soft auth in frontend** (RequireStaff gate) vs **hard auth in backend** (`requireStaff` middleware, now async, validates against `StaffSession` on every request, fail-closed on error).

### 2. Image Management
- **Flat structure** (`/imagesBotoes/`, no subdirs) — upload destination is singular; category is in Botao.categoria.
- **Upload separate from create/edit** — POST /upload returns `{ path }`, path goes into form, then JSON post to create/update (controllers unchanged).
- **Deletion doesn't destroy botões** — `imagem: allowNull` → DELETE nullifies imagem in affected botões, sends socket broadcast.
- **Cache-busting with query param** — on replace (same URL, new content), add `?v=timestamp` to force refresh in browser. **Pattern confined to EditBotoes; reusable for future profile photos.**

### 3. Real-time Sync
- **Socket.io broadcast** (`notificarAlteracaoBD`) — any mutating endpoint notifies clients of DB state change; ContextProvider re-fetches.
- **No CRUD subscriptions** — all clients see all data (utentes, botoes, pedidos); socket is for "something changed, refresh" signal, not granular updates.

### 4. Responsive Mobile
- **Sidebar → BottomNav toggle** — shared navigation source (navItems.js) prevents desync.
- **Order + flex utilities** — form/preview reorder on mobile without page reflow.
- **Safe-area inset** — respects iPhone notch/home indicator.
- **Two request view modes** — PedidosPhone (mobile optimized) and PedidosTV (large-screen, portrait rotation).

### 5. Variable-Size Buttons & Category Coloring
- **Spans, not a grid resize** — a button can occupy a rectangular w×h "footprint" anchored at
  its top-left cell. Anchor cell holds the `botaoId`; the rest of the footprint is reserved as
  `null`. Missing entry in `config.spans` = 1×1 (backward-compatible with tables saved before
  this existed). See `Client/src/Components/tabela/gridSpans.js`.
- **Auto-push on collision** — placing/resizing a button at a target position pushes any
  colliding buttons to the next free cell (row-major scan; grid grows if needed). Deterministic
  by position order, not drag order.
- **Category coloring is opt-in, staff-overridable** — `constants.js` has default pastel colors
  per category; staff can override via `config.coresCategoria`. Precedence: staff override >
  default pastel > no color. SOS never gets a background color. Adjacent same-category cells
  visually "merge" (shared corners square off) — computed per-cell, accounting for each button's
  full footprint, not just its anchor.

---

## Development Patterns

### Adding a New API Endpoint

1. **Create controller** (`Server/controller/newResource.js`) → handler function(s).
2. **Register in routes** (`Server/routes/route.js`) → add `router.post/get/etc()` with `requireStaff` if staff-only.
3. **Create API client** (`Client/src/api/newResource.js`) → pure functions for HTTP calls; import `apiUrl` from `client.js`; add `auth: true` to mutate opts if protected.
4. **Use in ContextProvider** (`ContextProvider.jsx`) → add state + fetch/mutate function.
5. **Consume in component** → call context function or API directly; socket broadcast will trigger re-fetch if needed.

### Adding a Staff Route

1. **Create Page** or **Container + Presentational component** (split if complex).
2. **Wrap in RequireStaff** in `App.jsx`.
3. **Add nav link to navItems.js** → sidebar/bottom-nav sync.
4. **Protect backend endpoints** with `requireStaff` middleware; add `credentials: "include"` to fetch in `api/` layer.

### Fixing a Bug with Images

- **Upload/delete error?** Check multer config in `route.js`, path validation (no `..`, starts with `/imagesBotoes/`), `requireStaff` middleware.
- **Image not showing?** Check fallback in component (`/imagesBotoes/default.png`), `apiUrl` prefix, cache-busting `versoes` map if edited.
- **Name collision?** `ConflitoImagemModal` prompts staff; backend uses query `?onConflict=rename|replace`.

---

## Common Commands

| Task | Command |
|------|---------|
| Start Server (dev) | `cd Server && node main.js` |
| Start Client (dev) | `cd Client && npm run dev` |
| Build Client | `cd Client && npm run build` |
| Reset staff password | Delete the single row in `StaffAuth` (e.g. `mysql -u inovlar_app -p inovlar_dev -e "DELETE FROM StaffAuth;"`), then restart the server |
| Run migrations | `cd Server && npx sequelize-cli db:migrate` |
| Seed test data | `cd Server && npx sequelize-cli db:seed:all` (errors on 2nd run — no run-once guard; see table-name gotcha above) |
| Full local dev setup (Windows) | `./install.ps1` from repo root |
| Lint Client | `cd Client && npm run lint` (currently broken — see below) |

There is no automated test suite for either `Server` or `Client` (`Server`'s `npm test` is an unset placeholder).

---

## Known Limitations & TODOs

- **ESLint v9 not configured** — `Client/package.json` has a `lint` script but no `eslint.config.js` exists, so `npm run lint` fails.
- **CSS class cleanup** — `.new-container` / `.edit-container` in `index.css` no longer used (UtenteForm was refactored); safe to remove.
- **Safe-area inset for iPhone** — bottom nav could include `env(safe-area-inset-bottom)` in height for cleaner spacing near home indicator.
- **Orphaned components** — `Home.jsx`, `UtenteHome.jsx`, `AbrirUtente.jsx`, `BindUtente.jsx`, `EscreverMensagem.jsx` not in router (kept for reference).
- **Production HTTPS** — cookie `secure` flag now reads `COOKIE_SECURE` env var (opt-in), since the Pi currently serves plain HTTP with no TLS anywhere in `install.sh`. Set `COOKIE_SECURE=true` once a reverse proxy with a certificate sits in front.
- **Known security gaps** — `SECURITY_CHECKLIST.md` (PT, internal) has a severity-ranked list from a manual audit. All 🔴 Critical items are now fixed (rate limiting on staff login, real revocable sessions replacing the old static `"ok"` cookie, `COOKIE_SECRET` fallback removed/required in production, `secure` cookie flag wired up). Still open (🟠 High/🟡 Medium): patient data endpoints (`/utentes`, `/pedidos`) reachable with no auth (biggest GDPR risk), `PUT /pedidos/:id` doesn't verify request ownership, mass assignment in a few controllers (`req.body` passed straight to Sequelize), the utente URL token is reversible obfuscation (key lives in the client bundle) not real access control, open CORS reflecting any origin + no CSRF protection, weak image upload validation (mimetype/extension only, no size limits). Check this file before touching auth, CORS, uploads, or the patient-data endpoints.

---

## Memory & Context

See `DEVELOPMENT_LOG.md` for chronological decision log (authentication design, responsive mobile, image upload with cache-busting, kiosk flow, MariaDB migration, Raspberry Pi deployment, etc.). Key entries: 2026-06-09 (deployment unification), 2026-06-09 (staff auth), 2026-06-17 (image management), 2026-06-17 (responsive mobile), 2026-07-03 (MariaDB migration + Pi deployment, table-casing bug, ContextProvider refetch-on-navigation fix).

`OPEN_SOURCE_CHECKLIST.md` (PT, internal) tracks prep work for making the repo public and writing an accompanying paper (git-history secret scan, license, CONTRIBUTING.md, generalizing the nursing-home-specific vocabulary, CI). Not part of the architecture, but relevant if asked to work on repo hygiene, licensing, or genericizing button/category naming.
