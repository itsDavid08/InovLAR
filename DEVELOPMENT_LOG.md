# Development Log — InovLAR

Registo cronológico das mudanças de arquitetura e decisões técnicas do projeto.
Entrada mais recente no topo.

---

## 2026-06-09 — Deployment unificado: Express serve o build do React (opção C)

### Contexto
O projeto está dividido em `Client/` (SPA React + Vite) e `Server/` (Express + Sequelize + Socket.io).
Em produção é sempre a **mesma máquina** a correr os processos, na LAN, e os utilizadores apenas abrem
o browser.

Até aqui corriam **dois processos** (Vite na `:5173` + Express na `:3000`), o que obriga a CORS e a um
`apiUrl` dependente do host (`window.location.hostname:3000`).

### Decisão
Manter os dois pacotes **separados** — são alvos de execução diferentes (browser vs Node), e essa
separação de responsabilidades é correta. Mas **unificar o deployment**: o Express passa a servir o
build estático do React (`Client/dist/`) na mesma porta da API e do Socket.io (`:3000`).

Resultado: **um só processo, uma só porta** em produção. Sem CORS, sem `:3000` hardcoded.

> Isto é só o setup de **produção/demonstração**. O desenvolvimento continua com `npm run dev`
> (Vite + Hot Module Replacement). As funcionalidades de runtime do React (`useEffect`, reatividade,
> re-render só do componente afetado) são preservadas — só o HMR é exclusivo do dev.

### Alterações — `Server/main.js`

**1.** Junto aos `require` do topo (a seguir a `const multer = require('multer');`):
```js
const path = require('path');
const DIST = path.join(__dirname, '../Client/dist');
```

**2.** A seguir a `app.use(express.static('public'));` — tem de ficar **antes** de `app.use(router)`:
```js
app.use(express.static(DIST));
```
> Para o `/` servir o `index.html` do React em vez da rota `GET /` antiga.

**3.** A seguir a `app.use(imagesRouter);` — tem de ser o **último** middleware:
```js
app.use((req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});
```
> Fallback da SPA: F5 em `/staff/pedidos` (ou qualquer rota do React Router) devolve o `index.html`.

**Bloco final em `main.js`:**
```js
app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.use(express.static(DIST));          // novo

app.use(router);
app.use(imagesRouter);
app.use((req, res) => {                  // novo
  res.sendFile(path.join(DIST, 'index.html'));
});
```

### Como correr
```bash
cd Client && npm run build     # gera Client/dist  (FAZER ANTES de arrancar o servidor)
cd ../Server && node main.js   # serve React + API + Socket.io em http://<ip>:3000
```
> ⚠️ Build primeiro, servidor depois: sem `dist/`, abrir `/` dá erro (ainda não existe `index.html`).

### Cuidados / notas
- A rota `GET /` antiga (`viewController.renderIndexView`, `routes/route.js:90`) fica à sombra do
  `express.static(DIST)` — deixa de ser usada (inofensivo).
- O `apiUrl` do cliente **não precisa de mudar**: `hostname:3000` servido a partir do `:3000` já é a
  mesma origem.
- O `cors()` deixa de ser necessário (mesma origem), mas é inofensivo mantê-lo.
- Os `.mp3` de `Client/public/` vão para a raiz do `dist/` no build → continuam a ser servidos
  (alarmes OK).

### Estado
- [ ] Inserção 1 — requires `path` / `DIST`
- [ ] Inserção 2 — `app.use(express.static(DIST))`
- [ ] Inserção 3 — fallback da SPA
- [ ] `npm run build` + `node main.js` testado no browser
