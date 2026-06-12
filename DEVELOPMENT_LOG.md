# Development Log — InovLAR

Registo cronológico das mudanças de arquitetura e decisões técnicas do projeto.
Entrada mais recente no topo.

---

## 2026-06-09 — Proteção das rotas de escrita do staff (`requireStaff`)

### Contexto
A autenticação do staff já existia, mas a API continuava toda aberta: o `RequireStaff` (React) só
esconde ecrãs — quem soubesse o URL escrevia na base de dados sem login. Faltava aplicar o middleware
`requireStaff` no servidor.

### Decisão
- Proteger as rotas de **escrita exclusivas do staff** com `requireStaff`.
- **Deixar abertas** as que o tablet do **utente** usa, senão partia o quarto:
  - `POST /pedidos` e `PUT /pedidos/:id` — o utente **cria** pedidos (botões/SOS) e **cancela/conclui os
    próprios** ("Estou Bem", toggle do SOS, gaveta ☰). Ver `MainContent.jsx` e `RequestListDrawer.jsx`.
  - Todos os `GET` — o `ContextProvider` carrega `utentes`/`botoes`/`pedidos/ativos/emergencia` em
    **todos** os dispositivos no arranque (incluindo o do utente).
- **Detalhe crítico no cliente:** os `fetch` de mutação não enviavam o cookie. Em produção (mesma
  origem) iria à mesma; em **dev** (Vite `:5173` → API `:3000`, cross-origin) **não** → daria 401. Logo,
  juntar `credentials: "include"` às 6 funções de mutação do staff.

### Alterações
**`Server/routes/route.js`** — `requireStaff` intercalado em **9 rotas** (sem imports novos, já estava
importado): `POST /utentes/create`, `PUT /utentes/:id`, `DELETE /utentes/:id`,
`POST|DELETE /utentes/:utenteId/botoes/:botaoId`, `POST /botoes`, `PUT /botoes/:id`,
`DELETE /botoes/:id`, `DELETE /pedidos/:id`.

**`Client/src/ContextProvider.jsx`** — `credentials: "include"` em **6 funções**: `editBotao`,
`postBotao`, `postUtente`, `editUtente`, `deleteUtente`, `deleteBotao`.
(`postPedido` e `updatePedido` **não** foram tocados — batem nas rotas abertas do utente.)

### Aberto vs. protegido
| Aberto (utente / leitura) | Protegido (`requireStaff`) |
|---|---|
| todos os `GET` | `POST /utentes/create`, `PUT`/`DELETE /utentes/:id` |
| `POST /pedidos` | `POST`/`DELETE /utentes/:id/botoes/:id` |
| `PUT /pedidos/:id` | `POST /botoes`, `PUT`/`DELETE /botoes/:id`, `DELETE /pedidos/:id` |

### Teste
Servidor arrancado, pedidos **sem cookie**:
- As 8 rotas protegidas → **401** (o controller nem corre → nada é criado/alterado).
- `GET /utentes`, `GET /botoes` → 200; `PUT /pedidos/:id` → não-401.
- `npm run build` do Client → OK.
- (Já estava provado que **com** cookie o `requireStaff` deixa passar — ver `change` na entrada abaixo.)

### Notas
- As rotas de associação de botões (`/utentes/:id/botoes/:id`) não têm uso na UI atual; ficam protegidas
  por higiene. Se forem ligadas, a função que as chamar também precisa de `credentials: "include"`.
- Regra daqui para a frente: **qualquer** nova rota de escrita do staff nasce com `requireStaff` no
  servidor + `credentials: "include"` no `fetch` do cliente.

### Estado
- [x] `requireStaff` nas 9 rotas de escrita do staff
- [x] `credentials: "include"` nas 6 mutações do staff (cliente)
- [x] Rotas do utente (`GET`, `POST`/`PUT /pedidos`) intactas — testado
- [x] Build do Client OK

---

## 2026-06-09 — Autenticação do staff (palavra-passe geral + cookie de sessão)

### Contexto
A app tem dois lados: **utentes** (tablet em cada quarto, comunicação aumentativa — muitos não
conseguem escrever no teclado) e **staff** (gestão de utentes, botões e pedidos). Os dispositivos são
**partilhados** e não havia qualquer autenticação: qualquer pessoa entrava na área de gestão.

Requisito de produto que condicionou tudo: depois de autenticar **uma vez** no dispositivo, **não
voltar a pedir** — os utentes não escrevem e o staff não pode perder tempo a autenticar-se a cada uso.

### Decisão e porquê (autenticação + tecnologia)

**1. Autenticação "geral" (uma palavra-passe partilhada), não contas por pessoa.**
Funciona como o código de acesso de um telemóvel: um segredo do **dispositivo/grupo**, sem nome de
utilizador.
- *Porquê:* num lar com dispositivos partilhados, o que interessa é "esta pessoa tem permissão de
  staff", não *quem* é. Evita gerir contas, nomes e recuperações individuais, e é mais rápido — o que
  é crítico num tablet partilhado.
- *Trade-off assumido:* não há auditoria por pessoa nem permissões diferenciadas. Aceitável para o
  âmbito atual; dá para evoluir para contas mais tarde sem deitar isto fora.

**2. A palavra-passe é definida pelo próprio staff, não imposta por nós.**
Na 1ª utilização aparece "Definir palavra-passe"; depois pode ser alterada no ecrã de staff.
- *Porquê:* não queremos obrigar os enfermeiros a uma password fixa decidida no código — eles gerem-na.
- Guardada **cifrada com bcrypt** (`bcryptjs`), **nunca em texto**.
- *Porquê `bcryptjs` e não `bcrypt` nativo:* é JavaScript puro, sem compilação nativa → evita
  problemas de build no Windows. O bcrypt aplica *salt* automático e tem fator de custo (resistente a
  força bruta).

**3. Sessão por COOKIE assinado e `httpOnly` (`cookie-parser`) — não JWT, não `localStorage`.**
- *Porquê cookie (e com validade longa, ~1 ano):* cumpre o requisito "não voltar a autenticar". O
  browser reenvia-o sozinho em cada pedido.
- *Porquê `httpOnly`:* o JavaScript da página **não consegue ler** o cookie → mitiga roubo de sessão
  por XSS.
- *Porquê **assinado** em vez de guardar sessões numa tabela:* a assinatura (HMAC com `COOKIE_SECRET`)
  prova que foi o servidor a emitir o cookie → não é falsificável. Como só precisamos de um *gate*
  binário ("passou / não passou"), **não é preciso tabela de sessões** → mais simples e *stateless*.
- *Porquê não JWT:* o JWT compensa quando há identidade/claims/expiração por utilizador; aqui não há
  utilizador. Seria complexidade a mais para o mesmo resultado.
- *Porquê não `localStorage` + token no header:* o `localStorage` é legível por JS (exposto a XSS) e
  obrigaria a anexar o token à mão em cada pedido. O cookie `httpOnly` é mais seguro e automático.
- Como o cookie é `httpOnly`, o frontend **não o lê**; pergunta ao servidor o estado em
  `GET /auth/staff/status`.

**4. CORS com credenciais + `SameSite=Lax`.**
- Em **dev** correm duas origens (Vite `:5173` ↔ API `:3000`) → cross-origin. Para o cookie viajar é
  preciso `credentials: true` no CORS (a origem é **refletida**, nunca `*`) e `credentials: "include"`
  no `fetch`.
- Em **produção** o Express serve o build na mesma porta → mesma origem; a config cobre os dois casos.
- `SameSite=Lax` chega porque é tudo o mesmo *host* (portas diferentes continuam a ser o mesmo *site*).
  Se um dia separarmos por domínios → passa a `SameSite=None` + HTTPS.

**5. Criar a tabela com `StaffAuth.sync()` no arranque, não com migration.**
O `initDb()` existe mas **nunca é chamado** (o esquema veio de migrations corridas à mão). Para não
obrigar a um passo manual, o arranque faz `StaffAuth.sync()` → `CREATE TABLE IF NOT EXISTS`, que **não
altera nem apaga** as outras tabelas.

**6. Guarda no frontend (UX) ≠ segurança (backend).**
O `RequireStaff` (React) só decide **o que mostrar**; quem souber o URL chama a API na mesma. A
segurança real é o middleware `requireStaff` nas rotas. Por agora só protege `POST /auth/staff/change`.
As rotas de **escrita** do staff ainda **não** estão protegidas **de propósito**, porque o tablet do
utente usa GETs e `POST /pedidos` sem login — isso fica para quando existir autenticação dos utentes.

### Alterações

**Servidor — novos ficheiros**
- `config/auth.js` — `COOKIE_SECRET` (segredo técnico de assinatura; lê de `process.env`).
- `middleware/auth.js` — `requireStaff` + `COOKIE_NAME` (`"staff_session"`).
- `models/StaffAuth.js` — tabela com 1 linha: `passwordHash`.
- `controller/authController.js` — `status` / `setup` / `login` / `change` / `logout`.

**Servidor — alterados**
- `models/index.js` — regista o modelo `StaffAuth`.
- `routes/route.js` — rotas de autenticação (ver tabela).
- `main.js` — `cookie-parser`, CORS com credenciais e `StaffAuth.sync()` no arranque:
```js
const cookieParser = require('cookie-parser');
const { COOKIE_SECRET } = require('./config/auth');
const { StaffAuth } = require('./models');
StaffAuth.sync(); // cria a tabela se não existir (não toca nas outras)

app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true })); // antes: cors()
app.use(cookieParser(COOKIE_SECRET)); // antes das rotas (preenche req.signedCookies)
```

**Endpoints**
| Método | Rota | Body | Protegido | Devolve |
|---|---|---|---|---|
| GET | `/auth/staff/status` | — | não | `{ configurado, autenticado }` |
| POST | `/auth/staff/setup` | `{ password }` | só 1ª vez (409 se já existe) | `{ autenticado }` + cookie |
| POST | `/auth/staff/login` | `{ password }` | não | `{ autenticado }` + cookie |
| POST | `/auth/staff/change` | `{ currentPassword, newPassword }` | **`requireStaff`** | `{ alterado }` |
| POST | `/auth/staff/logout` | — | não | limpa o cookie |

**Cookie de sessão** (`authController.js`):
```js
{ httpOnly: true, signed: true, sameSite: "lax", secure: false /* true em HTTPS */, maxAge: ~1 ano }
```

**Cliente — novos ficheiros**
- `src/api/auth.js` — chamadas com `credentials: "include"` (`staffStatus/Setup/Login/Change/Logout`).
- `src/Components/Keypad.jsx` — teclado numérico reutilizável (login e alterar password).
- `src/Components/RequireStaff.jsx` — guarda: consulta `status` e reencaminha para `/staff/login`.
- `src/Pages/StaffLogin.jsx` — define a password (1ª vez) **ou** pede-a (login), com teclado.
- `src/Pages/ChangePassword.jsx` — alterar em 3 passos: atual → nova → confirmar.

**Cliente — alterados**
- `src/App.jsx` — rota `/staff/login`, `/staff/alterar-password` e `RequireStaff` à volta das rotas de
  staff (`/staff`, `/staff/pedidos`, `/editBotoes`, `/new-utente`, `/edit-utente/:id`).
- `src/Pages/StaffHome.jsx` — botões **"Alterar palavra-passe"** e **"Terminar sessão"** na sidebar.
- `src/index.css` — estilos do ecrã de login/teclado, botão de logout e ecrã de sucesso.

**Dependências instaladas no `Server`:** `bcryptjs`, `cookie-parser`.

### Fluxo (UI)
1. Home → **Staff** → `/staff` → `RequireStaff` vê que não há cookie → vai para `/staff/login`.
2. **1ª vez** (sem password): "Definir palavra-passe" (PIN ≥ 4 dígitos, com confirmação) → autenticado.
3. A partir daí, o dispositivo tem o cookie (~1 ano) → entra **direto**. Noutro dispositivo, pede o PIN.
4. No ecrã de staff: **Alterar palavra-passe** (pede a atual) e **Terminar sessão** (limpa o cookie → Home).

### Como testar
- Backend validado com um script efémero que arranca/desliga o servidor no mesmo processo — todos os
  passos passaram: `status` (com/sem cookie), `setup`, `setup` repetido → 409, `login` certo/errado,
  `change` com/sem cookie (401 sem). Cookie confirmado como `HttpOnly`.
- `cd Client && npm run build` → OK.
- **Reset da palavra-passe** (esqueceram-se): `sqlite3 ./database/apcm.sqlite "DELETE FROM StaffAuth;"`
  → no arranque seguinte volta ao modo "Definir palavra-passe".

### Cuidados / notas
- **Produção (HTTPS):** pôr `secure: true` no cookie (`authController.js`, `opcoesCookie`).
- **`COOKIE_SECRET`:** definir por variável de ambiente em produção. Mudá-lo **desloga todos os
  dispositivos** (é o nosso "revogar tudo").
- Mínimo de 4 dígitos (constante `MIN_DIGITOS` no `authController.js`).
- Aviso de CSS pré-existente, não relacionado: `index.css:536` tem `#ff8080; !important;` (o `;` a mais
  faz o `!important` ser ignorado).

### Estado
- [x] Backend: `setup` / `login` / `change` / `logout` / `status` — testado
- [x] Cookie assinado `httpOnly` persistente (~1 ano)
- [x] Frontend: ecrã de login + guarda de rotas (`RequireStaff`)
- [x] Alterar palavra-passe (3 passos) + Terminar sessão
- [x] `npm run build` do Client OK
- [x] Proteger as rotas de **escrita** do staff no backend — feito (ver entrada mais recente no topo)
- [ ] HTTPS + `secure: true` em produção

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
