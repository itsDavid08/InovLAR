# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InovLAR** is a tablet-based communication and assistance system for nursing home patients. It has two interfaces:
- **Utente (Patient)**: Tablet board with customizable buttons/requests, request history drawer, emergency SOS
- **Staff**: Management console for patient profiles, button customization, request monitoring, customizable layouts/templates

**Tech stack:** React 19 (Vite, Tailwind CSS v3 with a real PostCSS build, `@dnd-kit/core` for the table editor's drag-and-drop) × Express 5 (Sequelize ORM, **MariaDB**) × Socket.io × bcryptjs auth

> Ant Design was removed 2026-07-23 (it was pulled in for a single modal; replaced by the shared
> `Modal.jsx`) and Tailwind moved off the CDN to a real build the same day (closed a CSP
> `unsafe-inline` gap — see Known Limitations). Bootstrap is still imported globally in `main.jsx`
> for base CSS and is being retired gradually in favour of Tailwind (`IMPROVEMENTS_CHECKLIST.md`
> item 11) — don't add *new* Bootstrap-dependent markup.

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

Both are also registered in `.claude/launch.json` as the preview configurations `server` (:3000) and
`client` (:5173) — start them through the preview tooling rather than a bare shell, so the dev server
stays attached and its logs are readable. Keep that file **strict JSON** (a trailing comma silently
breaks the launcher).

### Production build

```bash
cd Client && npm run build   # generates Client/dist/
cd ../Server && node main.js # serves React build + API + socket.io on http://<ip>:3000
```

**If the app is ever reached on anything other than `<host>:3000`** (reverse proxy on :80/:443, a DNS
name, TLS via Caddy), the build **must** set `VITE_API_URL` — `apiUrl` in `api/client.js` falls back to
`<current hostname>:3000`, and `ContextProvider.jsx` opens the socket.io connection from that same
value, so the page would load from the proxy but still call `:3000` directly (which `install.sh`'s TLS
mode closes off with `HOST=127.0.0.1`). A relative base follows whatever host the user typed:

```bash
cd Client && VITE_API_URL=/ npm run build
```

Raspberry Pi deployment (MariaDB install, DB/user creation, migrations, systemd service, optional TLS via Caddy) is automated by `install.sh` at the repo root — see it and `DEVELOPMENT_LOG.md` (Phase 3 entries, and 2026-07-24 for TLS) for the deployment-specific gotchas (Node version resolution under `sudo`, `lower_case_table_names` differences between Windows/Linux MariaDB, etc.).

---

## Architecture

### Core Concepts

1. **Kiosk Mode:** The tablet starts locked (`staffUnlocked: false`). Staff enters PIN to access management console. Entering patient board (`/board/:accessToken`) closes the gate (and revokes any staff session). Only PIN reopens staff access — physical reset or deleting the `StaffAuth` row in MariaDB.

2. **Two Authentication Paths** — both are real, revocable server-side sessions (random token in an httpOnly signed cookie; only its **SHA-256 hash** is stored). Same pattern, two tables:
   - **Staff:** Shared password per device (bcrypt-hashed). Session token stored in `StaffSession` (one row per active session). `requireStaff` (`middleware/auth.js`) is `async` and validates against that table on every request (fail-closed) — the cookie value proves nothing without a matching, non-expired row. `logout` deletes the row (real revocation); expired rows are lazily deleted on validation, no periodic sweep. Changing the PIN does **not** revoke existing sessions (shared device PIN — revoking would log out every tablet). `/auth/staff/login`, `/setup`, and `/change` are rate-limited (`middleware/rateLimiter.js`: 5 failed attempts / 10 min / IP).
   - **Utente (board):** Each utente has an unguessable **`accessToken`** (32 random bytes, `Utente.accessToken`, generated by a model hook, hidden from normal reads by a `defaultScope`). The board URL `/board/<accessToken>` carries it; `POST /board/session` exchanges it once for a **board session** (`UtenteSession`: `tokenHash` + `utenteId` + `expiraEm`, ~30 days). `identifyUtente`/`requireUtente` derive `req.utenteId` from that session, so every `/board/*` call is scoped to the session's utente server-side — the id never comes from the URL, and one board **cannot** touch another's data (ownership is enforced, not obfuscated). Revocation: `POST /board/logout`, expiry, utente deletion, or rotating the `accessToken` (staff). This replaced the old reversible Feistel URL token (`utenteToken.js`, removed) which was obfuscation, not access control.

3. **State Management:**
   - **ContextProvider:** Global state (utentes, botoes, pedidos, staffUnlocked) + API calls delegated to `api/` layer. It wraps `<Router>` in `App.jsx`, so it **survives all SPA navigation** — re-entering a page for the same entity (e.g. same patient's board) does *not* automatically refetch unless the effect's dependency actually changes. If a page looks stale on re-entry without a socket event in between, check whether its `useEffect` unconditionally refetches on mount vs. only on id-change (see `TabuleiroComunicacao.jsx` and the 2026-07-03 entry in `DEVELOPMENT_LOG.md`).
   - **API Layer** (`src/api/`): Pure functions for HTTP requests (GET, POST, PUT, DELETE), all built on `get(path, { auth })` / `mutate(path, { method, body, auth })` in `client.js`. **`auth` defaults to `false` on both** — it is opt-in per call and sends the session cookie (`credentials: "include"`). Every staff-only read/mutation *and* every `/board/*` call passes `auth: true` explicitly (the board has its own session cookie); only the genuinely open reads omit it — currently just `GET /botoes` and `GET /imagesBotoes`. A new staff mutation written without `auth: true` will 401. The API base is `VITE_API_URL` if set (must end in `/`), else `<current protocol>//<current hostname>:3000/` — same origin in production, `:3000` from the Vite dev server. The staff-only aggregate reads are also gated in `ContextProvider` behind `staffUnlocked` (both the mount effect and the socket handler, via a `staffUnlockedRef` to dodge stale closures) so the patient board never fires them and never 401s.
   - **Socket.io:** Real-time sync of DB changes across clients.

4. **Responsive Design:** Sidebar+header on desktop; bottom navigation bar on mobile. Layout components centralized in `Components/layout/`.

5. **Schema management is unified (2026-07-27, `IMPROVEMENTS_CHECKLIST.md` item 5):** every table is now created by a Sequelize **migration** (`Server/migrations/`, run via `sequelize-cli db:migrate`) — `StaffAuth`, `StaffSession`, `UtenteSession`, `TabelaLayout`, `TabelaPadrao` used to be created by `Model.sync()` in `main.js` on every server start (no migration files, no reproducible history — this is what caused the table-casing bug on the Pi, see below). `main.js` no longer calls `.sync()` for anything; `models/index.js`'s old `initDb()` (a blanket `sequelize.sync()`, unused/uncalled) was removed as dead code in the same pass. When adding a column to *any* table you now write a migration — there is no second, model-only path anymore.

   The 5 migrations that back-fill this (`20260727100000`–`20260727100004`) are **idempotent by necessity**: on every existing install (dev machines, any already-deployed Pi) these tables already exist from the old `sync()` calls, so each migration's `up()` checks first and does nothing if the table is already there — it never touches a live install's schema or data, it only gives *fresh* installs a migration-based path from now on. That existence check must compare table names **case-insensitively** (`LOWER(TABLE_NAME) = LOWER(:nome)`), not with `BINARY` like `20260703150000-rename-pedidos-table.js` does for its own (different) purpose — this project's Windows/macOS MariaDB runs with `lower_case_table_names=1`, which folds every table name to lowercase in `information_schema` regardless of how it was declared, so a `BINARY` exact-case check against the original mixed-case name (`'TabelaLayouts'`) never matches and the guard silently fails open. This was caught live while writing these migrations (see `DEVELOPMENT_LOG.md` 2026-07-27) — no data was lost (verified by row counts before/after), but it's exactly the category of bug this whole item exists to prevent, so take the lesson: **never use `BINARY` in one of these existence checks unless you specifically need to distinguish two different-cased names from each other**, which is the rename migration's situation, not this one.

   Two more things confirmed by direct schema introspection before writing these migrations, both preserved exactly rather than "improved" as a drive-by: `UtenteSession.utenteId` has **no** DB-level foreign key (never did — the model has no `.associate`), while `TabelaLayout.utenteId` **does** have a real FK to `Utentes` with `CASCADE`. `AuditLog.staffSessionId` also deliberately has no FK (see its own comment in the migration) — `StaffSession` rows get purged on expiry/logout, and a `CASCADE` FK would silently delete audit history along with the session that made it.

### File Structure

**Client (React + Vite)**
```
Client/src/
├── api/              # HTTP requests by resource (botoes, utentes, pedidos, tabela, tabelasPadrao, auth, board) + client.js (get/mutate + apiUrl). board.js = the tablet's own path (bootstrap + /board/*)
├── i18n/             # pt.js (all user-facing PT strings, keyed in English) + index.js (exports `t`)
├── state/            # Domain state hooks composed by ContextProvider: useBotoesState, useUtentesState, usePedidosState, useStaffAuthState
├── hooks/            # Cross-cutting hooks: useFeedback, useButtonById, useAlarmeEmergencia
├── constants.js      # PEDIDO_STATES (pendente/concluido/cancelado)
├── Components/
│   ├── layout/       # StaffShell, StaffSidebar, StaffBottomNav, StaffSkeleton, ItemMenu, navItems.js
│   ├── botoes/       # BotoesList + BotaoForm + CategoriaDropdown + ConflitoImagemModal (container EditBotoes lives in Pages/, see below)
│   ├── utentes/      # UtenteForm + UtenteAvatar (photo or initials-in-corAvatar fallback) (containers EditUtente/NewUtente live in Pages/, see below)
│   ├── pedidos/      # PedidosPhone, PedidosTV (view modes) + decorate.js (pedido→visual props) + usePagedRotation + useViewportMode
│   │                 #   + HistoricoFiltros / HistoricoTabela (registo de pedidos; container HistoricoPedidos lives in Pages/)
│   ├── tabela/       # See "Table editor structure" below — split into components + gesture hooks
│   ├── Modal.jsx, SearchInput.jsx, FeedbackToast.jsx   # Shared UI primitives
│   ├── RequireStaff.jsx       # Gate: blocks staff routes if staffUnlocked=false
│   ├── Keypad.jsx             # Reusable numeric keypad (PIN, password)
│   ├── PinPrompt.jsx          # Modal to exit patient board
│   ├── SuccessModal.jsx
│   └── RequestListDrawer.jsx
├── Pages/            # One file per routed page (App.jsx) — moved here from Components/ 2026-07-27 (IMPROVEMENTS_CHECKLIST.md item 8): a routed container belongs with the other pages, not nested under the presentational components it renders
│   ├── Welcome.jsx            # Home screen (kiosk mode off)
│   ├── StaffLogin.jsx         # PIN screen (define/login)
│   ├── StaffHome.jsx          # Patient list management
│   ├── EditUtente.jsx, NewUtente.jsx  # Utente form containers (state/logic; render Components/utentes/UtenteForm)
│   ├── EditBotoes.jsx         # Botão editor container (state/logic; renders Components/botoes/BotoesList or BotaoForm)
│   ├── PedidosPendentes.jsx   # Monitor view (large screen format) — pending only
│   ├── HistoricoPedidos.jsx   # Request log: full history, server-side filters/sort/paging (/staff/historico)
│   ├── TabuleiroComunicacao.jsx  # Patient board (the "cage"; exit via PIN modal)
│   ├── GerirTabela.jsx, GerirTemplate.jsx  # Table/template editors (both use useTabelaConfigs)
│   ├── TabelasView.jsx, ChangePassword.jsx
├── ContextProvider.jsx        # Composes the state/ hooks + cross-cutting orchestration (socket, staff-read gating, per-utente refetch). Single Context.
├── App.jsx                    # Router + protected routes via RequireStaff
├── main.jsx                   # Entry point; the CSS import order here is load-bearing (see below)
├── fonts.css                  # @font-face declarations
├── index.css                  # Global styles + responsive utilities (also holds a legacy colour palette — IMPROVEMENTS_CHECKLIST.md item 14)
└── tailwind.css               # The three @tailwind directives (real PostCSS build, not the CDN)
```

**CSS load order is deliberate** — `main.jsx` imports Bootstrap → `fonts.css` → `index.css` →
`tailwind.css`, and Tailwind **must stay last**: that reproduces the ordering the old
`cdn.tailwindcss.com` script had (injected at the end of `<head>`), so Tailwind utilities keep
winning specificity ties against Bootstrap. A new global stylesheet goes *before* `tailwind.css`.

**Table editor structure** (`Components/tabela/`) — the editor was one 1138-line file; it is now:
- **Components**: `TabelaEditor` (orchestrator, ~340 lines), `EditorTopBar`, `BibliotecaBotoes`,
  `PainelCoresCategoria`, `GridCell`, `LibraryTile`, `LibDrop`, `TrashZone`, `Segment`,
  `MarchingAnts`, `ButtonTile`, `TabelaPreview`, `GrelhaTabuleiro` (read-only board grid)
- **Gesture hooks** (`tabela/hooks/`): `usePinchZoom`, `useGridResize`, `useDragPlacement` — each
  exposes `onPlace(cells, spans)`; the editor wires them to one `commitPlacement`
- **Shared logic**: `constants.js` (DISPOSITIVOS, colours, `isSOS`, `defaultConfig`, `hasCells`,
  `devicesWithLayout`), `gridSpans.js`, `useGridGeometry.js` (rows/slots/occupancy/category matrix —
  used by editor, preview *and* board), `useTabelaConfigs.js` (3-device config state + dirty tracking),
  `useTipoDispositivo.js`

**Server (Express + Sequelize)**
```
Server/
├── config/
│   ├── config.js         # sequelize-cli dialect config, reads DB_* from .env (dialect: 'mariadb')
│   ├── database.js       # Sequelize instance built from config.js, used by models/index.js
│   ├── constants.js      # PEDIDO_STATES + DEVICES whitelist (shared by controllers)
│   └── auth.js           # COOKIE_SECRET, MIN/MAX_PASSWORD_DIGITS (6–20), BCRYPT_COST (12)
├── .env                  # DB_NAME/DB_USER/DB_PASS/DB_HOST/DB_PORT — gitignored, copy from .env.example
├── models/
│   ├── Botao.js          # Button/quick-request (imagem: allowNull)
│   ├── Utente.js         # Patient (hasMany Botao, hasMany Tabela)
│   ├── Pedido.js         # Request instance (timestamps, status); tableName: 'pedidos' (lowercase — see gotcha below)
│   ├── StaffAuth.js      # Single row: passwordHash — migrated (2026-07-27, was sync()'d)
│   ├── StaffSession.js   # Active staff sessions: tokenHash (SHA-256, unique) + expiraEm — migrated (2026-07-27, was sync()'d)
│   ├── UtenteSession.js  # Active board sessions: tokenHash (SHA-256) + utenteId + expiraEm — migrated (2026-07-27, was sync()'d); utenteId has no DB-level FK (never did)
│   ├── TabelaLayout.js   # User-specific table layout (utente + device) — migrated (2026-07-27, was sync()'d); utenteId HAS a real FK to Utentes, CASCADE
│   ├── TabelaPadrao.js   # Template for bulk apply to patients — migrated (2026-07-27, was sync()'d)
│   ├── AuditLog.js       # Staff mutation trail (action/staffSessionId/ip/detalhes) — migrated; staffSessionId has no FK on purpose (see below)
│   └── index.js          # Exports + associations
├── routes/
│   └── route.js          # Routing ONLY (no multer config, no model imports) — auth, board, utentes, botoes, pedidos, tabelas, images, auditoria
├── controller/           # Request handlers (auth*, board*, utente*, botao*, pedido*, tabela*, imageController, auditoriaController)
├── middleware/
│   ├── auth.js           # requireStaff (async, validates StaffSession, fail-closed, sets req.staffSessionId) + identifyStaff/identifyUtente (non-blocking, set req.isStaff/req.utenteId) + requireUtente (board session)
│   ├── errorHandler.js   # Central error handler (LAST middleware) — see "Error handling" below
│   ├── uploads.js        # Multer configs (botão icons / utente photos) + shared imageFileFilter + isPersonalUtentePhoto
│   ├── validate.js       # Generic validate(schema) — zod; strips unknown body fields, generic 400
│   └── rateLimiter.js    # staffAuthLimiter — 5 failed attempts/10min/IP on /auth/staff/{login,setup,change}
├── validation/
│   └── schemas.js        # zod schema per route (incl. tabelaConfigSchema, .passthrough() on unknown keys)
├── Util/
│   ├── sessions.js       # criarSessao/validarSessao/revogarSessao — StaffSession helpers (hashes token, lazy expiry cleanup)
│   ├── utenteSessions.js # criarSessaoUtente/validarSessaoUtente/revogar… — UtenteSession helpers (board sessions)
│   ├── applyTemplate.js  # applyTemplateToUtente — shared by utente creation and POST /tabelas-padrao/:id/aplicar
│   ├── socketIO.js       # Socket.io setup + notificarAlteracaoBD broadcast
│   ├── auditoria.js      # registarAuditoria(req, action, detalhes) — writes AuditLog, never throws (see Known Limitations/security notes)
│   └── seedDefaults.js   # Create "Predefinida" template on first run (runs once — guards on TabelaPadrao.count())
├── seeders/              # Seed scripts (43 default botões); no run-once tracking table, but idempotent (ignoreDuplicates: true, 2026-07-27)
├── migrations/           # Sequelize migrations for every table (unified 2026-07-27, see point 5 above) — run via db:migrate
├── public/               # Static files served by Express
│   ├── imagesBotoes/     # Flat structure (no subfolders); upload/delete here
│   ├── imagesUtentes/    # Patient avatars: random filenames + predefinidos/ subfolder (see Image Management below)
│   └── [other assets]
└── main.js               # Entry point: Express + socket.io + static serving + SPA fallback; no schema sync (all tables are migrated — see point 5 above); registers errorHandler last
```

**Error handling (Server):** controllers have **no try/catch boilerplate** — Express 5 forwards
rejected promises from async handlers to `middleware/errorHandler.js`, registered last in `main.js`.
It maps `ValidationError`→400, `ForeignKeyConstraintError`→400, `MulterError`→400, any error with
`err.status`→that status, everything else→generic 500. Responses are always `{ mensagem }` and never
leak `erro.message`. Expected outcomes (404s, invalid input) stay explicit `return res.status(...)`
in the controller — exceptions are for the *unexpected*. Where a specific error code matters (e.g.
`ENOENT` on file delete → 404), keep a local try/catch and `throw err` for the rest.

**MariaDB table-name gotcha:** table/column name casing is compared case-*insensitively* on Windows MariaDB (`lower_case_table_names=1`) but case-*sensitively* on Linux (default on the Pi/Debian, `=0`). A migration that creates `'Pedidos'` while the model declares `tableName: 'pedidos'` will silently work on Windows dev but throw `ER_NO_SUCH_TABLE` on the Pi. Always create tables with the exact lowercase name the model uses; see `Server/migrations/20260703150000-rename-pedidos-table.js` for the fix pattern (checks `information_schema.tables` with `BINARY` before renaming, so it's a no-op where the name is already correct).

---

## API Endpoints

### Authentication
- `GET /auth/staff/status` → `{ configurado, autenticado }`
- `POST /auth/staff/setup` + `{ password }` → initial PIN setup
- `POST /auth/staff/login` + `{ password }` → validate & refresh session cookie
- `POST /auth/staff/change` + `{ currentPassword, newPassword }` → **[requireStaff]**
- `POST /auth/staff/logout` → clear cookie

> **Auth note (per-utente board sessions, 2026-07-21):** the patient board no longer hits per-id
> endpoints with a URL-derived id. It bootstraps a **board session** from its `accessToken` and reads
> everything through `/board/*`, which derive the utente from the session cookie (`requireUtente`).
> Consequently the old per-id reads (`GET /utentes/:id`, `/pedidos/utente/:id`, `/utentes/:id/tabela/:d`)
> and `PUT /pedidos/:id` are now `requireStaff`; `POST /pedidos` was removed (board uses `/board/pedidos`).
> Whether a read is protected is load-bearing; the tags below reflect the current routes.

### Board (patient tablet session)
The board's own data path. `accessToken` is the unguessable per-utente secret in the URL
(`/board/<accessToken>`); it is exchanged once for a session cookie, then every call derives the
utente from that session (never from the URL). See "Two Authentication Paths" below.
- `POST /board/session` + `{ accessToken }` → creates a board session (httpOnly cookie), returns `{ id }` (open — the accessToken *is* the credential)
- `POST /board/logout` → revoke the board session
- `GET /board/utente` → the session's utente + pending pedidos → **[requireUtente]**
- `GET /board/pedidos` → the session's pending pedidos → **[requireUtente]**
- `GET /board/tabela/:dispositivo` → the session's layout for one device → **[requireUtente]**
- `POST /board/pedidos` + `{ botaoId, emergencia }` → create a pedido; `utenteId` is forced from the session → **[requireUtente]**
- `PUT /board/pedidos/:id` + `{ estado }` → update own pedido; **403** if the pedido belongs to another utente → **[requireUtente]**

### Utentes (Patients)
- `GET /utentes` → all patients → **[requireStaff]** (full roster; `unscoped()` so it includes `accessToken` for building board URLs)
- `GET /utentes/:id` → single patient → **[requireStaff]** (the board uses `GET /board/utente`)
- `POST /utentes/create` + body → **[requireStaff]**
- `PUT /utentes/:id` + body → **[requireStaff]**
- `DELETE /utentes/:id` → **[requireStaff]**
- `POST /utentes/:utenteId/botoes/:botaoId` → associate a button with a patient → **[requireStaff]**
- `DELETE /utentes/:utenteId/botoes/:botaoId` → disassociate → **[requireStaff]**
- `POST /imagesUtentes/upload` (multipart) + `{ previousPath }` → `{ path }`; auto-deletes the previous personal photo unless it's a predefined avatar → **[requireStaff]**
- `DELETE /imagesUtentes` + `{ path }` → nullify `imagem` on dependent utentes (predefined avatars can't be deleted this way) → **[requireStaff]**

### Botões (Buttons)
- `GET /botoes` → all buttons (open — the board needs the catalog)
- `POST /botoes` + body → **[requireStaff]**
- `PUT /botoes/:id` + body → **[requireStaff]**
- `DELETE /botoes/:id` → **[requireStaff]**
- `POST /imagesBotoes/upload` (multipart) → `{ path }` **[requireStaff]**
- `DELETE /imagesBotoes` + `{ path }` → nullify imagem in dependent botões **[requireStaff]**

### Pedidos (Requests)
- `GET /pedidos` → all requests → **[requireStaff]**
- `GET /pedidos/historico?de=&ate=&utenteId=&botaoId=&categoria=&estado=&emergencia=&q=&ordenar=&direcao=&limite=&offset=` → the staff **request log** (`/staff/historico`): every pedido, filtered/sorted/paged **in SQL** → **[requireStaff]**. Returns `{ total, limite, offset, resumo, pedidos }`, where `resumo` counts the whole filtered set (per estado + emergencies), not just the page. `limite` caps at 200 (default 50); `de`/`ate` are `YYYY-MM-DD` **days**, widened to the server's local midnight→23:59:59.999 (never `new Date("YYYY-MM-DD")`, which is UTC and shifts the range an hour in Portuguese summer time). Registered **before** `/pedidos/:id` in `route.js` — otherwise `:id` swallows `historico`. Query params are validated by `historicoPedidosQuerySchema` parsed **inside the controller**, not by `validate()`: that middleware reassigns `req.body`, and in Express 5 `req.query` is a getter with no setter.
- `GET /pedidos/ativos/hora` → active by time → **[requireStaff]**
- `GET /pedidos/ativos/emergencia` → SOS emergencies → **[requireStaff]**
- `GET /pedidos/:id` → single request → **[requireStaff]**
- `GET /pedidos/utente/:utenteId` → active requests for one patient → **[requireStaff]** (the board uses `GET /board/pedidos`)
- `PUT /pedidos/:id` + `{ estado }` → **[requireStaff]** (staff monitor resolves any pedido; the board uses `PUT /board/pedidos/:id`). Only `{ estado }` is accepted, validated against the ENUM. The double-tap guard (duplicate pending → `200` + existing row) lives in the board's `POST /board/pedidos`.
- `DELETE /pedidos/:id` → **[requireStaff]**

### Auditoria (audit trail — added 2026-07-27)
- `GET /auditoria?limit=50` → most recent mutations first, `limit` capped at 200 → **[requireStaff]**. See "Audit trail" in Known Limitations for what's logged and what isn't.

### Tabelas (Layouts)
- `GET /tabelas` → all saved layouts → **[requireStaff]**
- `GET /utentes/:id/tabela/:dispositivo` → get layout for one device → **[requireStaff]** (the board uses `GET /board/tabela/:dispositivo`). `:dispositivo` is `smartphone` | `tablet` | `pc`, whitelisted server-side in `tabelaController.js` (400 otherwise)
- `PUT /utentes/:id/tabela/:dispositivo` + body → **[requireStaff]**
- `GET /tabelas-padrao` → templates → **[requireStaff]**
- `POST /tabelas-padrao` + body → **[requireStaff]**
- `PUT /tabelas-padrao/:id` + body → **[requireStaff]**
- `DELETE /tabelas-padrao/:id` → **[requireStaff]**
- `POST /tabelas-padrao/:id/aplicar` + `{ utenteIds }` → **[requireStaff]**

### Images
- `GET /imagesBotoes` → list all images in flat structure (served by `imageController`)

> **Removed (2026-07-16 refactor):** `GET /localIP` (unused by the Client; leaked network topology)
> and `GET /botoes/utente/:utenteId` (unused *and* broken — `Botao` has no `utenteId` column; the
> association is `belongsToMany` through `UtenteBotoes`, so the query threw "unknown column").

---

## Key Design Decisions

### 1. Staff Authentication
- **Shared password** (device-level, not per-user) — matches kiosk workflow; no per-person accounts needed.
- **Real server-side sessions, not a stateless signed value** — the cookie carries a random 32-byte token; only its SHA-256 hash lives in `StaffSession`. This replaced an earlier design where the signed cookie just held the literal string `"ok"` (unrevocable, and a leaked `COOKIE_SECRET` could forge a valid cookie forever). See the 2026-07 entries in `DEVELOPMENT_LOG.md` for the full rationale.
- **SHA-256 for the token, not bcrypt** — the token is already high-entropy (256 bits) random data, not a low-entropy password; a fast hash is correct here and bcrypt would just add latency per request.
- **Bcryptjs** (not native bcrypt) — cross-platform JS; avoids build issues on Windows. Used for the PIN itself at `BCRYPT_COST = 12` (`config/auth.js`; existing cost-10 hashes still validate, and are re-hashed at 12 on the next `setup`/`change`).
- **Rate limiting on `/auth/staff/{login,setup,change}`** (`rateLimiter.js`) — mitigates brute-force of the PIN (6–20 digits, `MIN_PASSWORD_DIGITS`/`MAX_PASSWORD_DIGITS`); counts only failed attempts so normal use isn't penalized.
- **Soft auth in frontend** (RequireStaff gate) vs **hard auth in backend** (`requireStaff` middleware, now async, validates against `StaffSession` on every request, fail-closed on error).

### 2. Image Management
- **Flat structure** (`/imagesBotoes/`, no subdirs) — upload destination is singular; category is in Botao.categoria.
- **Upload separate from create/edit** — POST /upload returns `{ path }`, path goes into form, then JSON post to create/update (controllers unchanged).
- **Deletion doesn't destroy botões** — `imagem: allowNull` → DELETE nullifies imagem in affected botões, sends socket broadcast.
- **Cache-busting with query param** — on replace (same URL, new content), add `?v=timestamp` to force refresh in browser.
- **Patient avatars (`/imagesUtentes/`) are a separate pipeline from `imagesBotoes`, not a reuse of it** — own subfolder, `requireStaff` on both upload and delete (vs. open reads elsewhere), and confidentiality-driven filenames: uploads get a random non-sequential name (`utente-{timestamp}-{random}.ext`), never the original filename, so personal photos can't be enumerated or guessed. A `predefinidos/` subfolder holds stock avatars, which are exempt from the personal-upload rules (`ehUploadPessoalUtente` in `route.js` gates on this) — they can't be deleted via `DELETE /imagesUtentes` and aren't auto-replaced on upload. Uploading a new personal photo auto-deletes the previous one (`previousPath` in the request body) unless it was a predefined avatar. `Utente.imagem` (path or null) + `Utente.corAvatar` (background color) — when there's no photo, the initials/icon fallback renders in `corAvatar`. Added via migration `20260714120000-add-imagem-cor-to-utentes.js` (this table is in the migrated group, not `sync()`'d — see Schema management above).

### 3. Real-time Sync
- **Socket.io broadcast** (`notificarAlteracaoBD`) — any mutating endpoint notifies clients of DB state change; ContextProvider re-fetches.
- **No CRUD subscriptions** — all clients see all data (utentes, botoes, pedidos); socket is for "something changed, refresh" signal, not granular updates.

### 4. Responsive Mobile
- **Sidebar → BottomNav toggle** — shared navigation source (navItems.js) prevents desync.
- **Order + flex utilities** — form/preview reorder on mobile without page reflow.
- **Safe-area inset** — respects iPhone notch/home indicator.
- **Two request view modes** — PedidosPhone (mobile optimized) and PedidosTV (large-screen, portrait rotation).

### 5. Variable-Size Buttons & Category Coloring

The board layout is one JSON blob per `(utenteId, dispositivo)` in `TabelaLayout.config`
(`TabelaPadrao.configs` holds the same shape keyed by all three devices at once). Nothing
validates it beyond the device whitelist, so both editors and both renderers must agree on it:

```js
{
  cols: 5,                       // grid width; per-device default in DISPOSITIVOS (constants.js)
  size: "M",                     // "P" | "M" | "G" — tile min-height/icon/text scale (TAMANHOS)
  cells: [12, null, 7, ...],     // flat row-major array, index = r*cols+c; botaoId at the anchor,
                                 //   null for empty AND for cells reserved by a bigger neighbour
  spans: { "2": { w: 2, h: 2 } },// keyed by ANCHOR position; absent = 1×1
  coresCategoria: { ... }        // staff colour overrides per category; absent = default pastel
}
```

Devices are `smartphone` | `tablet` | `pc` (`DISPOSITIVOS` in `constants.js`, mirrored as a
whitelist in `tabelaController.js`). Rows are implicit — derived from `cells`/`spans` via
`extentRows()`, never stored.

- **Spans, not a grid resize** — a button can occupy a rectangular w×h "footprint" anchored at
  its top-left cell. Anchor cell holds the `botaoId`; the rest of the footprint is reserved as
  `null`. Missing entry in `config.spans` = 1×1 (backward-compatible with tables saved before
  this existed). See `Client/src/Components/tabela/gridSpans.js`.
- **Auto-push on collision** — placing/resizing a button at a target position pushes any
  colliding buttons to the next free cell (row-major scan; grid grows if needed). Deterministic
  by position order, not drag order. `colocarComEmpurrao` **reserves the target footprint before
  relocating the collided buttons** — without that reservation a pushed button lands inside the
  target's own cells and is then overwritten by the final placement (the bug fixed 2026-07-28;
  its regression tests are in `gridSpans.test.js`).
- **Moving an already-placed button onto exactly one other swaps them** (`trocarComOrigem`) instead
  of pushing the collided one to the grid's first free cell (which read as it "jumping" somewhere
  unrelated). Wired only into the two "move an existing slot" call sites (`useDragPlacement.js`,
  `TabelaEditor.jsx: aoClicarCelula`); library drops keep plain push (no origin to swap back to)
  and so does resize (target and self-anchor can coincide, where a swap means nothing).
- **Category coloring is opt-in, staff-overridable** — `constants.js` has default pastel colors
  per category; staff can override via `config.coresCategoria`. Precedence: staff override >
  default pastel > no color. Adjacent same-category cells visually "merge" (shared corners square
  off) — computed per-cell, accounting for each button's full footprint, not just its anchor.
  **SOS can have a background color too** (its own `categoria: "SOS"` key in `coresCategoria`,
  no default pastel — transparent until staff sets one), but it never enters `matrizCategorias`
  (`isSOS` guard in `constants.js`), so it never merges with neighbors — always its own "island"
  with 4 rounded corners, regardless of whether it has a fill color.
- **The editor's drag/resize gestures are pixel-geometry, not cursor cells** — two traps, both
  the result of a rewrite (2026-07-15, see `DEVELOPMENT_LOG.md`): the drop anchor comes from
  `active.rect.current.translated` (the dragged node's real rectangle) via `ancoraDoArrasto()`,
  **not** from dnd-kit's `over` cell, or a >1×1 button lands under the cursor instead of where
  it visually appears; and resizing uses an 8-handle box where each handle has a **fixed pivot**,
  rather than branching on the drag delta's sign — the sign approach made reversing direction
  mid-gesture read as "grow more". `resizePreview`/`dragPreview` are local state, committed to
  `config` only on pointerup.

---

## Code Conventions (2026-07 refactor)

- **Code is written in English** — variables, functions, hooks, comments, new file names. This is
  aspirational for the Server, not a completed migration: plenty of existing identifiers and
  comments there are still Portuguese (`isOrigemPermitida`, `purgarExpiradas`, `criarSessao`, etc.).
  A full translation was deliberately deferred (`IMPROVEMENTS_CHECKLIST.md` item 12, decided
  2026-07-27 — too large a diff for the value, revisit only if the project opens to external
  contributors). Follow the rule for anything you touch or add; don't rename unrelated existing
  identifiers as a drive-by.
- **Domain nouns stay Portuguese at the boundaries** — REST paths (`/utentes`, `/botoes`,
  `/pedidos`), Sequelize models/tables/columns, and DB enum values (`pendente`, `concluido`,
  `cancelado`) are **not** renamed. This protects deployed Pi devices and existing data. Handlers
  therefore read as English verb + PT domain noun: `getAllUtentes`, `createPedido`, `associateBotao`.
- **User-facing text lives in `Client/src/i18n/pt.js`** — never hardcode PT strings in JSX. Keys are
  English and grouped by feature (`t.common.save`, `t.botoes.newButton`, `t.tabelasView.deleteConfirm(nome)`).
  Strings needing interpolation are functions. Adding a language = a new file with the same shape,
  swapped in `i18n/index.js`.
- **Shared over duplicated** — before writing a toast/modal/search box/grid calculation, check
  `Components/` (`Modal`, `SearchInput`, `FeedbackToast`), `hooks/` (`useFeedback`, `useButtonById`)
  and `Components/tabela/` (`useGridGeometry`, `isSOS`, `defaultConfig`, `hasCells`).
- **The table-layout JSON has a canonical type, checked in the editor** (2026-07-27,
  `IMPROVEMENTS_CHECKLIST.md` item 13) — `@typedef {TabelaConfig}` in `Components/tabela/constants.js`,
  referenced via `@param`/`@returns` JSDoc by `gridSpans.js`, `useGridGeometry.js`, `useTabelaConfigs.js`,
  and the editor/renderer components (`TabelaEditor`, `TabelaPreview`, `GrelhaTabuleiro`). `Client/jsconfig.json`
  (`typescript` added as a devDependency purely for `tsc --noEmit` checking — no TS syntax anywhere) has
  `checkJs: false` **project-wide on purpose**: turning it on globally in a codebase with zero prior type
  annotations would flag unrelated pre-existing code everywhere. Individual files opt in with a leading
  `// @ts-check` pragma instead — currently just the 4 pure-logic files above, which is where `tsc` actually
  runs today (verified: it genuinely catches type errors, not a silent no-op — see DEVELOPMENT_LOG.md
  2026-07-27). The JSX components got JSDoc for hover-documentation only (no `@ts-check` — JSX/dnd-kit typing
  would need more work than this item's scope). `jsconfig.json` also sets `"strict": false`, so it does *not*
  catch missing-null-check bugs (e.g. a function typed to return `T | null` used without a guard) — only
  outright type mismatches (wrong primitive, calling a method that doesn't exist on the type, etc.). When
  extending this coverage, add `// @ts-check` to the next file and run `npx tsc -p jsconfig.json --noEmit`
  before trusting it's clean.

---

## Development Patterns

### Adding a New API Endpoint

1. **Create controller** (`Server/controller/newResource.js`) → handler function(s).
2. **Register in routes** (`Server/routes/route.js`) → add `router.post/get/etc()` with `requireStaff` if staff-only.
3. **Create API client** (`Client/src/api/newResource.js`) → pure functions for HTTP calls; import `apiUrl` from `client.js`; add `auth: true` to mutate opts if protected.
4. **Use in ContextProvider** (`ContextProvider.jsx`) → add state + fetch/mutate function.
5. **Consume in component** → call context function or API directly; socket broadcast will trigger re-fetch if needed.

### Adding a Staff Route

1. **Create the routed container in `Pages/`** (state/logic; e.g. `Pages/EditUtente.jsx`). If it's complex, split out presentational pieces into `Components/<feature>/` (e.g. `Components/utentes/UtenteForm.jsx`) — but the routed container itself always lives in `Pages/`, never nested under the components it renders (see item 8, `IMPROVEMENTS_CHECKLIST.md`).
2. **Wrap in RequireStaff** in `App.jsx`.
3. **Add nav link to navItems.js** → sidebar/bottom-nav sync.
4. **Protect backend endpoints** with `requireStaff` middleware; add `credentials: "include"` to fetch in `api/` layer.

### Fixing a Bug with Images

- **Upload/delete error?** Check multer config in `middleware/uploads.js`, the handler in `controller/imageController.js`, path validation (no `..`, starts with `/imagesBotoes/`), `requireStaff` middleware.
- **Image not showing?** Check fallback in component (`/imagesBotoes/default.png`), `apiUrl` prefix, cache-busting `versoes` map if edited.
- **Name collision?** `ConflitoImagemModal` prompts staff; backend uses query `?onConflict=rename|replace`.

---

## Common Commands

| Task | Command |
|------|---------|
| Start Server (dev) | `cd Server && node main.js` (or `npm run dev` for nodemon auto-restart) |
| Start Client (dev) | `cd Client && npm run dev` |
| Build Client | `cd Client && npm run build` |
| Reset staff password | Delete the single row in `StaffAuth` (e.g. `mysql -u inovlar_app -p inovlar_dev -e "DELETE FROM StaffAuth;"`), then restart the server |
| Run migrations | `cd Server && npm run migrate` (= `npx sequelize-cli db:migrate`) |
| Undo the last migration | `cd Server && npx sequelize-cli db:migrate:undo` |
| Seed test data | `cd Server && npm run seed` (idempotent since 2026-07-27 — `ignoreDuplicates: true`, safe to re-run, even self-heals a single deleted default botão) |
| Full local dev setup (Windows) | `./install.ps1` from repo root |
| Lint Client | `cd Client && npm run lint` (0 errors; 4 known warnings — see below) |
| Test Client | `cd Client && npm test` (Vitest — grid geometry + category-colour logic) |
| Test Server | `cd Server && npm test` (Vitest — zod schemas, auth/validate middleware, board ownership, request-log filters, upload security, audit trail) |
| **Run a single test file** | from that package's dir: `npx vitest run src/Components/tabela/gridSpans.test.js` (Client) / `npx vitest run tests/schemas.test.mjs` (Server) |
| **Run a single test by name** | `npx vitest run -t "<substring of the it()/describe() title>"` |
| Watch mode | `cd Client && npm run test:watch` (Server: `npx vitest`) |
| Type-check the `@ts-check` files | `cd Client && npx tsc -p jsconfig.json --noEmit` (only files carrying the `// @ts-check` pragma — see Code Conventions) |

A **first** automated test suite exists (added 2026-07-23, `DEVELOPMENT_LOG.md`) — both packages use
**Vitest** (`npm test` = `vitest run`). It is a targeted safety net, not full coverage: the pure logic
of the table editor's grid (`Components/tabela/gridSpans` + `constants`) on the Client, and the auth/
validation **contract** on the Server (zod schemas, `validate`/`requireStaff`/`requireUtente` middleware,
and the board's per-utente ownership 403). Server tests never touch the DB — they mock the session layer,
`vi.spyOn` the shared `Pedido` model, or exercise the DB-free fail-closed paths; the middleware ones drive
a throwaway Express app over **supertest**, so they assert real status codes, not handler return values.
Note the Server has a CJS/ESM split: most tests are `.test.mjs`, but any test that must share the CommonJS
module registry with the source (e.g. spying a model the controller `require`s) is written as `.test.cjs`
with Vitest globals (`vitest.config.mjs`). Everything the preview can't exercise still needs driving the
running app — that is how the table-editor gesture rewrite was checked.

**Writing a *Client* test that renders a component needs setup work first.** The Client has **no**
Vitest config at all — `vite.config.js` has no `test` block, and neither `jsdom` nor
`@testing-library/*` is installed — so tests run in the bare Node environment and only pure logic is
testable today (which is why the two existing files are `gridSpans`/`constants`, not components).
Rendering anything means adding `jsdom` + Testing Library and a `test: { environment: "jsdom" }`
block before the first component test, not after it fails mysteriously.

---

## Known Limitations & TODOs

- **ESLint warnings (4, all benign)** — `npm run lint` passes with 0 errors. Remaining: `react-refresh/only-export-components` on `ContextProvider.jsx` and `UtenteAvatar.jsx` (each exports a non-component alongside a component; clearing them means moving `Context`/`ICONE_PESSOA` to their own files and updating ~14 imports), and `react-hooks/exhaustive-deps` on `PedidosTV.jsx` (`fila`) and `PedidosPendentes.jsx` (`handleVoltar`).
- **Safe-area inset for iPhone** — bottom nav could include `env(safe-area-inset-bottom)` in height for cleaner spacing near home indicator.
- **Category communicated by color alone** (`IMPROVEMENTS_CHECKLIST.md` item 15, open) — the button-grid category merge/identity in the table editor relies 100% on color, which is a real accessibility gap for colorblind/low-vision users (the target population). Needs a redundant signal (label/icon), not just color. `tailwind.config.js` already has `darkMode: "class"` wired but never turned on in the UI — a high-contrast mode would have real value here. Dark mode itself was implemented once (2026-07-27) and then reverted at the user's request — don't re-add it without checking first.
- **Production TLS is opt-in and unproven on hardware** — `sudo ENABLE_TLS=true bash install.sh` puts a Caddy reverse proxy with a self-signed cert (`tls internal`, no domain needed) in front of Express: it sets `COOKIE_SECURE=true`, pins Express to `HOST=127.0.0.1` (reachable only through Caddy), and `main.js` sets `app.set('trust proxy', 'loopback')` so `staffAuthLimiter` still rate-limits per real client IP instead of lumping every request under `127.0.0.1`. Default (`ENABLE_TLS` unset) stays plain HTTP, and once enabled it stays enabled on later runs (read back from `.env`, same idempotency pattern as `DB_PASS`/`COOKIE_SECRET`). **Verified locally only** — the `Caddyfile` and the apt-based Caddy install have never run on real hardware. Any proxy/hostname change also needs the Client rebuilt with `VITE_API_URL` (see Production build).
- **Test coverage is thin** — the Vitest suite (see Common Commands) covers grid geometry + category-colour logic on the Client, and the auth/validation contract, board ownership and the request-log filter translation (`getHistorico`: query → `where`/`order`, day boundaries, INNER-JOIN-on-botão) on the Server. Green as of 2026-08-13 (Client 33/33 in 2 files, Server 54/54 in 7 files; `npm run lint` 0 errors / 4 known warnings and `npx tsc -p jsconfig.json --noEmit` clean on the same date). It does **not** cover the table editor's drag/resize *gestures* (pixel-geometry — still verified by driving the running app) or any HTTP integration against a real DB. Note `constants.test.js` asserts the default pastels as **literals**, on purpose — changing a colour in `COR_CATEGORIA_FUNDO` is meant to fail the test until you update it by hand (asserting against the constant itself would make the test tautological). It went stale exactly this way once, see `DEVELOPMENT_LOG.md` 2026-08-11.
- **Audit trail has no UI** — `AuditLog` + `Util/auditoria.js: registarAuditoria(req, action, detalhes)`, called explicitly from controllers (same style as `notificarAlteracaoBD()` — no generic logging middleware). It records `req.staffSessionId`: the session/device, never a named person, because the PIN is shared. **Never blocks the response** — a failed audit write is caught and logged to the console only, so a flaky insert can't turn a successful mutation into a 500 for staff. **Wired into:** `utente.create/update/delete/rotateToken`, `pedido.update/delete`, `auth.changePassword`. **Deliberately not wired into:** botão CRUD, table/template saves, image upload/delete — content management, not personal-data mutations (a photo change is still captured indirectly, since the upload's resulting path is only persisted through `utente.update`). Read it via `GET /auditoria?limit=` or the DB directly; a staff-facing page is the natural follow-up.
- **Security posture** — every item from the original manual audit is closed. `DEVELOPMENT_LOG.md` (2026-07-10 through 2026-07-27) carries the per-fix rationale and the CVE/GHSA references; what follows is the set of invariants that must not silently regress:
  - Staff sessions are real, revocable server-side rows (`StaffSession`), never a self-contained signed value; `requireStaff` validates on every request and is fail-closed. `COOKIE_SECRET` is mandatory in production (`config/auth.js` exits without it).
  - Board access is per-utente (`accessToken` → `UtenteSession`); `/board/*` derives the utente from the session, so cross-utente reads/writes return 403. No route takes a patient id from the URL without `requireStaff`.
  - Aggregated patient data (`/utentes`, `/pedidos*`, `/tabelas*`) is `requireStaff` — the patient tablet must never download the roster.
  - Create/update handlers whitelist fields (no mass assignment) **and** every mutation route runs a zod schema (`middleware/validate.js`) that strips unknown keys. `tabelaConfigSchema` stays `.passthrough()` on purpose — the layout blob is deliberately backward-compatible.
  - `errorHandler` never leaks `erro.message` to the client.
  - CORS allows same-origin only (`isOrigemPermitida()` compares `Origin` against the request's own `Host`), plus the Vite dev origin outside production — applied to **both** REST and socket.io (the socket.io half was a regression once). There is no separate CSRF token layer: `sameSite: "lax"` plus this restriction is the whole defence.
  - Image uploads verify real magic bytes after multer writes the file (deleting on mismatch), cap at 10 MB / 1 file, and a name conflict without an explicit `onConflict=replace|rename` is a **409 from the server** — never a silent overwrite, and never a client-side prediction from a possibly-stale file list.
  - `helmet` is mounted first in the chain. `crossOriginResourcePolicy` is `"cross-origin"` deliberately: the default `"same-origin"` breaks every image in dev, where Vite (`:5173`) and the API (`:3000`) are different origins — and `curl`-based checks don't reproduce it, only a real browser does.
  - **Accepted trade-offs, still true:** the `accessToken` is stored in plaintext (it guards data the DB already holds, and staff must be able to re-read the board URL); and after a PIN reset (deleting the `StaffAuth` row) any device on the network can win the race to `/setup` — inherent to a kiosk with no pre-shared setup secret, so reconfigure the PIN immediately after a reset.

---

## Memory & Context

See `DEVELOPMENT_LOG.md` for chronological decision log (authentication design, responsive mobile, image upload with cache-busting, kiosk flow, MariaDB migration, Raspberry Pi deployment, etc.). Key entries: 2026-06-09 (deployment unification), 2026-06-09 (staff auth), 2026-06-17 (image management), 2026-06-17 (responsive mobile), 2026-07-03 (MariaDB migration + Pi deployment, table-casing bug, ContextProvider refetch-on-navigation fix), 2026-07-14 (closing aggregated patient-data GETs).

`README.md` / `README.pt.md` are the public-facing overview (bilingual EN/PT) — architecture diagram, features, setup, usage. The project is being prepared for open-source release alongside an academic paper; no license is chosen yet (see README's License section).

`IMPROVEMENTS_CHECKLIST.md` is the 16-item audit that drove the 2026-07 refactor: 12 closed, and items
**2** (TLS on real hardware), **9**/**11** (context split; retiring Bootstrap), **12** (language
convention — deliberately parked) and **14**/**15** (colour consolidation; colour-blind redundancy and
dark mode, reverted at the user's request) still open. Its "TOP 3 priorities" block at the bottom is
**stale** — all three were done — so read the per-item status, not that summary.

`paper/` (LaTeX draft of the usability study, plus its own `README.md`) is present in the working tree
but **not committed**. Two things to know before touching it: the study is framed around a residential
care home for **adults with cerebral palsy** — residents (PCP) *and* the health professionals who
support them — which is narrower than the generic "nursing home" wording used throughout this file and
the READMEs; and the folder is mirrored into Overleaf, so paper edits are normally handed over as
find/replace instructions rather than applied to the local files. `paper/README.md` tracks per-section
status and the `\TODO{}` draft markers.
