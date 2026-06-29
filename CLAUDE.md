# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InovLAR** is a tablet-based communication and assistance system for nursing home patients (APCM partnership). It has two interfaces:
- **Utente (Patient)**: Tablet board with customizable buttons/requests, request history drawer, emergency SOS
- **Staff**: Management console for patient profiles, button customization, request monitoring, customizable layouts/templates

**Tech stack:** React (Vite, Ant Design, Bootstrap) × Express (Sequelize ORM, SQLite) × Socket.io × bcryptjs auth

---

## Quick Start

### First-time setup

**Server:**
```bash
cd Server
npm i
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
node main.js                # runs on port 3000
```

**Client:**
```bash
cd Client
npm i
npm run dev                  # Vite dev server with HMR (port 5173)
```

### After first setup

**Server:** `cd Server && node main.js`
**Client:** `cd Client && npm run dev`

### Production build

```bash
cd Client && npm run build   # generates Client/dist/
cd ../Server && node main.js # serves React build + API + socket.io on http://<ip>:3000
```

---

## Architecture

### Core Concepts

1. **Kiosk Mode:** The tablet starts locked (`staffUnlocked: false`). Staff enters PIN to access management console. Entering patient board (`/main/:token`) closes the gate. Only PIN reopens staff access — physical reset or password deletion via SQLite.

2. **Two Authentication Paths:**
   - **Staff:** Shared password per device (bcrypt-hashed), session cookie (httpOnly, signed, ~1 year).
   - **Utente:** Token-based access (no auth per se; URL is the secret: `/main/{token}`).

3. **State Management:**
   - **ContextProvider:** Global state (utentes, botoes, pedidos, staffUnlocked) + API calls delegated to `api/` layer.
   - **API Layer** (`src/api/`): Pure functions for HTTP requests (GET, POST, PUT, DELETE).
   - **Socket.io:** Real-time sync of DB changes across clients.

4. **Responsive Design:** Sidebar+header on desktop; bottom navigation bar on mobile. Layout components centralized in `Components/layout/`.

### File Structure

**Client (React + Vite)**
```
Client/src/
├── api/              # HTTP requests by resource (botoes, utentes, pedidos, tabela, auth)
├── Components/
│   ├── layout/       # StaffShell, StaffSidebar, StaffBottomNav, ItemMenu, navItems.js
│   ├── botoes/       # EditBotoes (container) + BotoesList + BotaoForm + ConflitoImagemModal
│   ├── utentes/      # EditUtente, NewUtente, UtenteForm
│   ├── pedidos/      # PedidosPhone, PedidosTV (view modes) + usePagedRotation + useViewportMode
│   ├── tabela/       # TabelaEditor, TabelaPreview, ButtonTile, constants.js
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
│   ├── database.js       # Sequelize connection (SQLite: database/apcm.sqlite)
│   └── auth.js           # COOKIE_SECRET, MIN_DIGITOS
├── models/
│   ├── Botao.js          # Button/quick-request (imagem: allowNull)
│   ├── Utente.js         # Patient (hasMany Botao, hasMany Tabela)
│   ├── Pedido.js         # Request instance (timestamps, status)
│   ├── StaffAuth.js      # Single row: passwordHash
│   ├── TabelaLayout.js   # User-specific table layout (utente + device)
│   ├── TabelaPadrao.js   # Template for bulk apply to patients
│   └── index.js          # Exports + associations
├── routes/
│   ├── route.js          # Main API endpoints (auth, utentes, botoes, pedidos, tabelas, imagesBotoes)
│   └── images.js         # GET /imagesBotoes (flat listing; no subdirs)
├── controller/           # Request handlers (authController, utente*, botao*, etc.)
├── middleware/           # auth.js (requireStaff middleware)
├── Util/
│   ├── socketIO.js       # Socket.io setup + notificarAlteracaoBD broadcast
│   └── seedDefaults.js   # Create "Predefinida" template on first run
├── seeders/              # Seed scripts for testing data
├── migrations/           # Sequelize migrations (one-time; sync() now used instead)
├── public/               # Static files served by Express
│   ├── imagesBotoes/     # Flat structure (no subfolders); upload/delete here
│   └── [other assets]
├── views/                # Orphaned EJS views (replaced by React SPA)
├── database/
│   └── apcm.sqlite       # SQLite DB
└── main.js               # Entry point: sets up Express, socket.io, static file serving
```

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
- **Cookie-based sessions** (httpOnly, signed, no JWT) — simplifies stateless validation via HMAC; no session table.
- **Bcryptjs** (not native bcrypt) — cross-platform JS; avoids build issues on Windows.
- **Soft auth in frontend** (RequireStaff gate) vs **hard auth in backend** (requireStaff middleware on write routes).

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
| Reset staff password | `sqlite3 database/apcm.sqlite "DELETE FROM StaffAuth;"` then restart |
| Run migrations | `cd Server && npx sequelize-cli db:migrate` |
| Seed test data | `cd Server && npx sequelize-cli db:seed:all` |
| Lint Client | `cd Client && npm run lint` (requires eslint.config.js setup; not yet done) |

---

## Known Limitations & TODOs

- **ESLint v9 not configured** — `npm run lint` doesn't work; `eslint.config.js` not present (pré-existing).
- **CSS class cleanup** — `.new-container` / `.edit-container` in `index.css` no longer used (UtenteForm was refactored); safe to remove.
- **Safe-area inset for iPhone** — bottom nav could include `env(safe-area-inset-bottom)` in height for cleaner spacing near home indicator.
- **Orphaned components** — `Home.jsx`, `UtenteHome.jsx`, `AbrirUtente.jsx`, `BindUtente.jsx`, `EscreverMensagem.jsx` not in router (kept for reference).
- **Production HTTPS** — `secure: true` needed in cookie config (`authController.js`) when deployed over HTTPS.

---

## Memory & Context

See `DEVELOPMENT_LOG.md` for chronological decision log (authentication design, responsive mobile, image upload with cache-busting, kiosk flow, etc.). Key entries: 2026-06-09 (deployment unification), 2026-06-09 (staff auth), 2026-06-17 (image management), 2026-06-17 (responsive mobile).
