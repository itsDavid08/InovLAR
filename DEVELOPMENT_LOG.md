# Development Log — InovLAR

Registo cronológico das mudanças de arquitetura e decisões técnicas do projeto.
Entradas por ordem cronológica — a mais recente é a última (append no fim).

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
- [x] Proteger as rotas de **escrita** do staff no backend — feito (ver a entrada "Proteção das rotas de escrita do staff", logo a seguir)
- [ ] HTTPS + `secure: true` em produção

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
- (Já estava provado que **com** cookie o `requireStaff` deixa passar — ver `change` na entrada anterior, "Autenticação do staff".)

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

## 2026-06-15 — Legibilidade com Windhawk "Translucent Windows" (não era bug do projeto)

### Contexto
As letras liam-se bem no telemóvel mas mal no **Brave** e no **VS Code** (ambos no Windows). O VS Code
não usa **nada** do CSS do projeto → se também ali se lia mal, a causa não podia ser o projeto. O
denominador comum é o mod **Translucent Windows** (Windhawk, `@include *`), que torna as janelas
translúcidas e baixa o contraste do texto sobre o que está por trás.

Confirmado pelo *source* do mod: os knobs responsáveis são `type` (`acrylicblur`/`mica`…),
`RenderingMod.ThemeBackground` (pinta fundos a preto p/ deixar passar o blur), `ExtendFrame` (estende a
"glass frame" para a client area) e `RenderingMod.Syscolors` (`COLOR_WINDOW`→preto, texto→cinza claro).
Para conteúdo web (Chromium) o texto **não** é recolorido pelo mod; o problema é a **translucidez da
janela**, não a cor da letra.

### Decisão
**A) Corrigir na origem (Windhawk) — fix real:** adicionar *process rules* (`RuledPrograms`) para
`brave.exe` e `Code.exe` com Background type = **Default** e **Theme background / Extend frame /
Immersive dark** desligados → essas janelas voltam a ser opacas, mantendo o translucent nas restantes
apps. (`Syscolors` é global, não tem override por-app.)

**B) Defesa no projeto (CSS):** garantir base opaca e letra preta por omissão:
- `html, body, #root { background-color:#fff }` — base opaca, o translucent não "passa" por trás.
- `body { color:#000 }` — letra preta para tudo o que não define cor própria (o Bootstrap já punha
  `#212529` sobre `#fff`; passámos o default a preto puro). As cores já definidas (`white`, `#333`…)
  não são afetadas — são mais específicas.

### Alterações
**`Client/src/index.css`**
- Bloco global: `html, body, #root` com fundo branco opaco + `body { color:#000 }`.
- `button, input, select, textarea { color: inherit }` — ver "Update" abaixo.

### Update — só os botões da `.action-sidebar` ficavam ilegíveis
Causa: os `<button class="sidebar-button">` (`index.css:170`) têm `background-color:#E0E0E0` mas **não
definem `color`** — os únicos botões da app sem cor própria. Os `<button>` **não herdam `color`** do
`body`; usam a cor de sistema **`ButtonText`**, que o Windhawk com `SysColors:1` troca por `RGB(220,220,220)`
(quase branco) → quase-branco sobre cinza claro = invisível. Por isso o `body { color:#000 }` não chegou
lá e só estes partiam (o `Terminar sessão` tem `#c0392b` explícito; os outros botões também têm cor
própria). O `SysColors` é **global** no mod → a regra `brave.exe` não o corrige. `color: inherit` força
os controlos a usar o preto do `body` (corrige também botões/inputs de `.edit-container`/`.new-container`,
com o mesmo defeito latente).

### Notas
- A mudança de CSS é sobretudo **defensiva**; o fix que se nota é o **A** (excluir as apps no Windhawk).
- Greys secundários ainda por rever (opcional): `.login-subtitulo` `#777`, `.pedido-info-container`
  `#7f8c8d`, inline `#666`/`#888` em `BindUtente.jsx`/`EditBotoes.jsx`, `.pin-placeholder` `#ccc`
  (este é propositadamente fraco — placeholder do PIN).

### Estado
- [x] CSS: base opaca + letra preta por omissão (`index.css`)
- [x] CSS: controlos de formulário com `color: inherit` → corrige `.sidebar-button` (root cause real)
- [ ] Windhawk: regras para `brave.exe` e `Code.exe` (passo manual do utilizador)
- [ ] (Opcional) Reforçar contraste dos greys secundários

---

## 2026-06-15 — Reorganização do front-end (split de layouts + camada `api/`)

### Contexto
Vários ficheiros React acumulavam responsabilidades a mais. O caso mais visível: `EditBotoes.jsx`
(323 linhas) tinha **dois layouts** no mesmo ficheiro — a lista/seleção e o formulário criar/editar.
O mesmo shell de sidebar+header estava **duplicado** entre `StaffHome` e a lista de botões, os
formulários de utente estavam em dois ficheiros quase iguais, e o `ContextProvider` (300 linhas)
misturava todo o estado com **todas** as chamadas HTTP.

### Decisão
Reorganização **sem alterar o funcionamento** (puro *refactor* estrutural):
- **Containers vs. apresentação:** a lógica/estado fica no container; cada layout sai para um
  componente presentacional que recebe `props`.
- **Camada `api/`:** os `fetch` saem do `ContextProvider` para módulos por recurso. Espelham
  *exatamente* os pedidos originais (URLs, métodos, `credentials`, verificações de `res.ok`,
  mensagens de erro). O `ContextProvider` mantém o estado e as atualizações otimistas.

### Alterações
**Camada `api/` (nova)** — `Client/src/api/`
- `client.js` — `apiUrl` (base partilhada) + `get()` / `mutate()`. `mutate({ auth })`: só envia o
  cookie de sessão com `auth: true` (mutações de staff); os pedidos do utente ficam **sem**
  credenciais, como antes (ver entrada de 2026-06-09).
- `botoes.js`, `utentes.js`, `pedidos.js` — funções puras que devolvem dados.
- `auth.js` — passa a **importar** `apiUrl` de `client.js` (antes duplicava a constante).

**`ContextProvider.jsx`** — delega os `fetch` na camada `api/`; mantém estado, `try/catch`,
`setState` e *optimistic updates* idênticos. `apiUrl` deixa de ser `useState` (nunca mudava) e passa
a constante importada. Removidos 2 `console.log` de depuração (`fetchUtente`, `updatePedido`).

**Split de layouts** — `Client/src/Components/`
- `botoes/` — `EditBotoes.jsx` (container) + `BotoesList.jsx` (lista) + `BotaoForm.jsx` (form+preview).
- `utentes/` — `EditUtente.jsx` / `NewUtente.jsx` (wrappers de rota) + `UtenteForm.jsx` (form partilhado).
- `layout/StaffShell.jsx` — shell de sidebar+header partilhado por `StaffHome` e `BotoesList`
  (antes duplicado). `props`: `sidebar`, `headerRight`, `children`.

**Movidos** (imports atualizados em `App.jsx`): `Components/{EditBotoes,EditUtente,NewUtente}.jsx`
→ `Components/{botoes,utentes}/`.

### Preservação de comportamento (verificado por leitura)
- DELETE sem corpo → sem `Content-Type`, com `credentials` (igual).
- `pedidos` POST/PUT → continuam **sem** cookie (`auth:false`).
- `get("/imagesBotoes")` mantém a barra inicial e a `//` dupla do original.
- Chaves do `Context.Provider value` **inalteradas** → consumidores intactos.
- Ficheiros órfãos (`BindUtente`, `AbrirUtente`, `EscreverMensagem`) **não tocados** (decisão do utilizador).

### Teste
- `npm run build` (Client) → OK, antes e depois (mesmo aviso pré-existente do CSS na linha 555).
- `npm run lint` **não corre** no repo (ESLint 9 sem `eslint.config.js`) — pré-existente, não relacionado.

### Estado
- [x] Camada `api/` (`client` + `botoes`/`utentes`/`pedidos`) + `auth.js` a reutilizar `apiUrl`
- [x] `ContextProvider` slim (delega nos `api/`)
- [x] `EditBotoes` dividido em container + `BotoesList` + `BotaoForm`
- [x] `StaffShell` partilhado (`StaffHome` + `BotoesList`)
- [x] `UtenteForm` partilhado (`EditUtente` + `NewUtente`)
- [x] `App.jsx` com imports atualizados; ficheiros antigos removidos; `npm run build` OK
- [ ] (Opcional) Migrar config do ESLint para v9 para voltar a ter `lint`

---

## 2026-06-15 — Fluxo "Pin-to-Exit" (kiosk: bloqueio → staff → gaiola do utente)

### Contexto
O fluxo antigo tinha um ecrã inicial a escolher "Utente" vs "Staff", com o lado do utente
**livremente acessível** (qualquer um escolhia um perfil e usava o tabuleiro) e o lado do staff
protegido por um cookie persistente (~1 ano) — ou seja, **nunca** bloqueava no arranque. Para um
tablet partilhado num lar isto é frágil: o utente podia sair do seu tabuleiro e o staff não tinha de
se autenticar ao reiniciar.

### Decisão — modelo kiosk com saída por PIN
O tablet passa a ter 3 estados encadeados:
1. **Ecrã de bloqueio** (raiz `/`) — pede o PIN (ou define-o na 1ª vez). Rápido (teclado numérico).
2. **Console de staff** (`/staff`, …) — gestão de utentes/botões/pedidos. Protegido.
3. **Gaiola do utente** (`/main/:id`) — o tabuleiro do utente, **sem saída livre**. A única saída é
   um ícone discreto "🛠" que abre um **modal de PIN**; PIN correto reabre o staff, cancelar/errar
   mantém o utente no tabuleiro.

**Mecanismo:** um gate de cliente `staffUnlocked` (estado em memória no `ContextProvider`). Arranca a
`false` → a app abre sempre no bloqueio (reinício/F5 re-bloqueia). O PIN é **sempre** validado no
servidor (`staffLogin` → bcrypt + renova o cookie), por isso a flag não é falsificável num kiosk.
Coerente com a filosofia já registada: *guarda no frontend (UX) ≠ segurança (backend)* — o
`requireStaff` nas rotas de escrita continua a ser a segurança real.

> Nota: não há endpoint `utenteBind` no servidor (os órfãos `AbrirUtente`/`BindUtente` chamam uma
> função que nem existe). Por isso a gaiola é imposta no cliente, com o PIN verificado no servidor.

### Alterações — `Client/src/`
- **`ContextProvider.jsx`** — novo estado `staffUnlocked` + `setStaffUnlocked` no `value`.
- **`Components/RequireStaff.jsx`** — passa a ler `staffUnlocked` (instantâneo) em vez de consultar
  `staffStatus()`; se bloqueado → `<Navigate to="/" />`.
- **`Pages/StaffLogin.jsx`** (ecrã de bloqueio) — deixa de saltar via cookie (`autenticado`); pede
  sempre o PIN. Sucesso (login **ou** setup) → `setStaffUnlocked(true)` + `/staff`. Removido o
  "← Voltar" (é a raiz).
- **`Components/PinPrompt.jsx`** (novo) — modal de PIN sobre o tabuleiro; valida com `staffLogin`;
  `onSuccess`/`onCancel`. Reutiliza `Keypad` e os estilos `.login-screen`.
- **`Pages/MainContent.jsx`** (gaiola) — o botão "🛠" deixa de navegar livre para `/utente`; agora
  abre o `PinPrompt`. PIN correto → `setStaffUnlocked(true)` + `/staff`. Botão tornado discreto.
  **Fecha o gate (`setStaffUnlocked(false)`) ao montar** (ver "Race condition" abaixo).
- **`Pages/StaffHome.jsx`** — "Voltar Atrás" e "Terminar Sessão" passam a `setStaffUnlocked(false)`
  (sair do console bloqueia o gate). "Iniciar Sessão" (`handleOpen`) **não** mexe no gate — só navega.

### Race condition (corrigida) — entrar no tabuleiro pedia o PIN e voltava a `/staff`
1ª versão fechava o gate no `handleOpen` (`setStaffUnlocked(false)` + `navigate("/main/:id")`). O
React Router v7 trata a navegação como *transition* (baixa prioridade), mas o `setStaffUnlocked(false)`
é aplicado primeiro (alta prioridade) → nesse instante ainda em `/staff`, o `RequireStaff` via o gate
fechado e redirecionava para `/` (bloqueio). Sintoma: clicar "Aceder Perfil" → pedia PIN → voltava a
`/staff`. **Fix:** o fecho do gate passou para um `useEffect([])` no `MainContent` (rota não-guardada),
por isso nunca dispara o guarda durante a transição. (As saídas para `/` não sofrem disto: guarda e
`navigate` apontam ambos para `/`.)
- **`App.jsx`** — `/` → ecrã de bloqueio (era `Home`); removidas as rotas `/utente` (seletor livre)
  e `/staff/login`. `Home.jsx` e `UtenteHome.jsx` ficam **órfãos** (não apagados).
- **`index.css`** — `.pin-overlay` (camada fixa do modal de PIN).

### Comportamento de reload (decisão)
- `/staff` (e afins) → reload re-bloqueia (gate a false) → volta ao ecrã de bloqueio. ✓ kiosk.
- `/main/:id` **não** é guardado → reload mantém o utente no seu tabuleiro (não fica preso no
  bloqueio). A gaiola é imposta por não ter saída livre, não por guardar a rota.

### Teste
- `npm run build` (Client) → OK (bundle JS menor: `Home`/`UtenteHome` saíram por tree-shaking).
- Falta verificação visual em runtime (arrancar Server + Client) — pendente.

### Estado
- [x] Gate `staffUnlocked` no Context + `RequireStaff` a usá-lo
- [x] Ecrã de bloqueio na raiz (sempre pede PIN; sem auto-skip por cookie)
- [x] `PinPrompt` (saída da gaiola) + `MainContent` sem saída livre
- [x] `StaffHome` bloqueia o gate ao iniciar sessão / sair
- [x] `App.jsx` com rotas novas; `npm run build` OK
- [ ] Verificação visual do fluxo completo (bloqueio → staff → gaiola → PIN)
- [ ] (Opcional) Tornar `/main/:id` à prova de gestos de saída do browser/SO (modo kiosk do tablet)

---

## 2026-06-16 — Ecrã de boas-vindas na raiz (`/`), login movido para `/login`

### Contexto
A raiz `/` abria diretamente o `StaffLogin` (teclado de PIN). Pretendia-se uma **página de
boas-vindas** na raiz, com um botão que conduz o staff ao ecrã de autenticação por PIN.

### Decisão — página separada em vez de estado interno
Optou-se por uma **página `Welcome.jsx` dedicada** em `/` e mover o ecrã de bloqueio para `/login`,
em vez de acrescentar um estado de "boas-vindas" dentro do próprio `StaffLogin`. É mais explícito
(uma rota por ecrã) e mantém o `StaffLogin` focado só na autenticação. O `RequireStaff` **mantém** o
redirect para `/` (boas-vindas) — ver a nota da race mais abaixo.

**Fluxo:** `/` (boas-vindas) → botão **Iniciar sessão** → `/login` (PIN/definir) → `/staff`.
Acesso a rota protegida sem `staffUnlocked` → redirect para `/` (boas-vindas).

### Alterações — `Client/src/`
- **`Pages/Welcome.jsx`** (novo) — ecrã de boas-vindas; botão "Iniciar sessão" → `navigate("/login")`.
  Reutiliza `.login-screen`/`.login-subtitulo`.
- **`App.jsx`** — `/` passa a `<Welcome />`; nova rota `/login` → `<StaffLogin />`.
- **`Components/RequireStaff.jsx`** — redirect de bloqueio **mantém-se em `/`** (boas-vindas);
  testou-se `/login` mas reverteu-se (ver nota da race).
- **`Pages/StaffLogin.jsx`** — reposto o "← Voltar" (agora navega para `/` boas-vindas); comentário
  do topo atualizado (já não é a raiz, vive em `/login`).
- **`index.css`** — estilos novos `.welcome-box` e `.login-iniciar` (botão azul `#1E90FF`, coerente
  com o resto do tema).

### Estado
Build do cliente (`vite build`) passa sem erros novos (mantém-se apenas o aviso CSS pré-existente em
`#ff8080; !important;`).

### Race — "Terminar Sessão"/"Voltar Atrás" caíam em `/login`
Durante o desenvolvimento testou-se apontar o `RequireStaff` para `/login`; com isso, o logout passou
a cair em `/login` em vez do home. **Causa:** `setStaffUnlocked(false)` é um update **urgente** do
React, enquanto o `navigate("/")` do react-router v7 corre dentro de uma **transition** (diferida). O
urgente renderiza primeiro → nesse render o gate já é `false` mas a rota ainda é `/staff`, por isso o
`RequireStaff` dispara o `<Navigate>` para o seu alvo **antes** da navegação manual. Trocar a ordem das
linhas não resolve (o urgente salta sempre à frente da transition).
**Fix:** manter o alvo do `RequireStaff` em `/` (home) — ganhe a corrida o redirect do `RequireStaff`
ou o `navigate("/")`, o destino é sempre `/`. Os handlers de `StaffHome` ficam na forma original
(`setStaffUnlocked(false)` + `navigate("/")`).

> Nota/possível follow-up: `EditUtente.jsx` faz `navigate('/')` quando o utente não é encontrado —
> com a mudança, um staff autenticado cai no boas-vindas; talvez fizesse mais sentido `/staff`.
> Não alterado (fora do âmbito desta tarefa).

---

## 2026-06-16 — Sidebar de staff partilhado (`StaffSidebar`) + search funcional

### Contexto
`StaffHome` e `BotoesList` (editor de botões) tinham **sidebars quase iguais, duplicados** —
header/perfil, painel de ações e footer, tudo inline em cada página. A search bar do `StaffHome` era
um `<input>` estático (não filtrava nada) e o `BotoesList` nem tinha. A navegação de volta dependia de
botões "Voltar Atrás".

### Decisão — extrair `StaffSidebar` reutilizável
Um único componente `Components/layout/StaffSidebar.jsx` com estrutura fixa: header + **nav links com
highlight da rota ativa** (`useLocation`) + slot `children` para as ações específicas de cada página +
footer "Terminar Sessão". As páginas passam só o painel de ações como `children`.

- **Search:** estado controlado em cada página (local), a filtrar **só por nome** por agora — decisão
  consciente de adiar outros critérios (quarto/categoria) até serem precisos. Em `EditBotoes` o estado
  vive no container e desce a `BotoesList` (que é presentacional).
- **Removido o "Voltar Atrás"** (ambas as páginas). Era redundante com os nav links e, ao contrário do
  "Terminar Sessão", **não invalidava o cookie de servidor** — só fechava o gate de cliente. Num kiosk
  partilhado isso é mais risco do que conveniência. Volta-se à "Visão Geral dos Utentes" pelo nav link.

### Alterações — `Client/src/`
- **`Components/layout/StaffSidebar.jsx`** (novo) — sidebar partilhado; detém o `handleLogout`
  (`staffLogout` + `setStaffUnlocked(false)` + `navigate("/")`) e os nav links (`/staff`,
  `/staff/pedidos`, `/editBotoes`, `/staff/alterar-password`).
- **`Pages/StaffHome.jsx`** — usa `<StaffSidebar>`; removidos handlers que viraram nav links
  (`handleVoltar`/`handleLogout`/`handlePendingRequests`/`handleAlterarPassword`); search liga ao
  `<input>` e filtra a grelha (`utentesFiltrados`).
- **`Components/botoes/BotoesList.jsx`** — usa `<StaffSidebar>`; removido o header próprio e o `onBack`;
  novas props `searchQuery`/`onSearchChange` + search bar no header; filtra a grelha.
- **`Components/botoes/EditBotoes.jsx`** — novo estado `searchQuery` passado a `BotoesList`; removido o
  `useNavigate`/`onBack` (já sem uso).

### Estado
Build do cliente (`vite build`) passa sem erros novos. O `npm run lint` não corre — o projeto ainda
usa config antiga e o ESLint 9 exige `eslint.config.js` (pré-existente, não relacionado).

---

## 2026-06-16 — Ações por item (menu ⋮) + "Novo X" no cabeçalho; sidebar mais leve

### Contexto
Mesmo com o `StaffSidebar` partilhado, o painel "Ações" (Editar / Eliminar / Novo) por baixo dos nav
links deixava o sidebar **demasiado cheio**. Além disso, Editar/Eliminar exigiam **selecionar o item
primeiro** (clique no card) e só depois agir pelo sidebar — um passo a mais.

### Decisão
- **Editar/Eliminar → menu de 3 pontos (⋮) em cada card** (`ItemMenu`, popover subtil). Ação direta
  sobre aquele item, sem seleção prévia. Abre **dentro do card** (cabe num menu de 2 itens), por isso
  mantém-se o `overflow-hidden` e evitam-se portais / problemas de stacking entre cards da grelha.
- **"Novo X" → botão primário no cabeçalho** do conteúdo (lado direito do título, que estava vazio).
  Escolhido pelo utilizador entre 4 hipóteses (cabeçalho / FAB / card-fantasma / manter no sidebar).
- **Removido o estado de seleção** (`selectedUtente`; nos botões a seleção passou a ser definida pela
  própria ação de editar, que ainda alimenta o `handleSubmit`). O sidebar fica só com header + nav
  links + "Terminar Sessão" — o slot `children` do `StaffSidebar` deixa de ser usado (fica disponível).

### Alterações — `Client/src/`
- **`Components/layout/ItemMenu.jsx`** (novo) — botão ⋮ + popover Editar/Eliminar; fecha ao clicar fora.
- **`Pages/StaffHome.jsx`** — sai a seleção; `handleEdit(utente)`/`handleDelete(utente)` recebem o item
  do `ItemMenu`; botão "Novo Utente" no cabeçalho; `sidebar={<StaffSidebar />}`.
- **`Components/botoes/BotoesList.jsx`** — `ItemMenu` por card (⋮ no canto); botão "Novo Botão" no
  cabeçalho; removidas props `selectedBotao`/`onSelect`.
- **`Components/botoes/EditBotoes.jsx`** — `handleEdit(botao)`/`handleDelete(botao)` recebem o botão;
  removido `handleSelectBotao`; `selectedBotao` mantido (usado no `handleSubmit` do modo edit).

### Estado
Build do cliente (`vite build`) passa sem erros novos.

---

## 2026-06-17 — Upload e eliminação de imagens de botões + estrutura plana em `imagesBotoes/`

### Contexto
O editor de botões só deixava **escolher** imagens de um conjunto pré-existente, organizado em
**subpastas por categoria** (`imagesBotoes/chamar/`, `/medicamentos/`, `/necesidades/`, `/sinto/`,
`/tecnologia/`). Faltava: (1) **carregar** imagens novas a partir do dispositivo; (2) **eliminar**
imagens (ex.: upload incorreto ou imagem privada). Requisito crítico do utilizador: eliminar uma
imagem **não pode eliminar nem partir** os botões que a usam.

### Decisão

**1. Estrutura plana — todas as imagens na raiz de `imagesBotoes/`.**
As subpastas por categoria eram redundantes: a categoria já vive em `botao.categoria`. Migrou-se tudo
para a raiz, o que simplifica o upload (destino único) e a eliminação (sem ter de distinguir imagens
"de sistema" em subpastas de imagens carregadas pelo utilizador). A função recursiva de listagem
(`listarImagensRecursivo`) deixou de ser necessária → substituída por um `readdirSync` plano.

**2. Upload separado, botão referencia por path (rotas de create/update inalteradas).**
Fluxo: o utilizador escolhe um ficheiro → `POST /imagesBotoes/upload` (multipart) → o servidor guarda
em `imagesBotoes/` com nome único → devolve `{ path }` → o path entra na grelha e fica selecionado →
o submit continua a enviar **JSON com o path** (como antes). Assim, `createBotao`/`updateBotao` e o
controller **não mudam**.

**3. Eliminação que não parte os botões — `imagem` passa a poder ser `null`.**
`DELETE /imagesBotoes` (path no body) apaga o ficheiro e faz `Botao.update({ imagem: null })` nos
botões que o usavam — **não os elimina**. Para isso, `Botao.imagem` passou de `allowNull: false` para
`allowNull: true`. Quem usava a imagem fica com `imagem = null` e os sítios de exibição usam um
fallback. Se algum botão foi afetado, notifica os clientes por socket (`notificarAlteracaoBD`).
- **Segurança do path:** valida `startsWith('/imagesBotoes/')`, rejeita `..` e rejeita `/` aninhado
  (pós-migração tudo é plano) → impede *path traversal* e apagar fora da pasta.
- **Auth:** as duas rotas novas levam `requireStaff` (regra de 2026-06-09: escrita de staff nasce
  protegida no servidor + `credentials: "include"` no cliente).

### Migração (one-off, já executada)
- **52 ficheiros** movidos das 5 subpastas para `imagesBotoes/` (sem conflitos de nome); subpastas
  removidas. Total na raiz: 53 (com o `urgent.png` que já lá estava).
- **BD (`apcm.sqlite`):** 42 registos da tabela `Botoes` atualizados para o path plano
  (`/imagesBotoes/<sub>/x.png` → `/imagesBotoes/x.png`). O `id=1` (`urgent.png`) já estava na raiz.

### Alterações

**Servidor**
- **`routes/images.js`** — recursão (`listarImagensRecursivo`) → `readdirSync` plano (só ficheiros de
  imagem na raiz).
- **`models/Botao.js`** — `imagem`: `allowNull: false` + `notEmpty` → `allowNull: true`.
- **`routes/route.js`** — novo storage Multer para `../public/imagesBotoes` (nome único, mantém
  extensão) + `POST /imagesBotoes/upload` (devolve `{ path }`) + `DELETE /imagesBotoes` (apaga
  ficheiro + `imagem=null` nos botões afetados + socket). Imports novos: `{ Botao }` de `../models`,
  `{ notificarAlteracaoBD }` de `../Util/socketIO`. Removida a config Multer antiga (`uploads/`,
  não usada nos botões).

**Cliente — `src/`**
- **`api/botoes.js`** — importa `apiUrl` de `client.js`; novas `uploadImagemBotao(file)` (FormData,
  `credentials: include`) e `deleteImagemBotao(imgPath)` (DELETE com `{ path }` no body).
- **`Components/botoes/EditBotoes.jsx`** — `handleUploadImagem` (adiciona à grelha + seleciona) e
  `handleDeleteImagem` (confirma, apaga, remove da grelha, limpa a seleção se era a ativa); passados
  ao `BotaoForm`.
- **`Components/botoes/BotaoForm.jsx`** — botão "Carregar imagem" (input file escondido via `useRef`) +
  ícone de lixo (hover) por imagem na grelha; novas props `onUploadImagem`/`onDeleteImagem`.
- **`Pages/MainContent.jsx`** e **`Pages/PedidosPendentes.jsx`** (2 ocorrências) — fallback para
  `imagem = null` (corrige também o bug de precedência `apiUrl + x || ""` em PedidosPendentes).

### Verificação (por leitura)
- `express.json()` montado (`main.js`) → body do DELETE é lido. ✓
- Routers sem conflito: `POST`/`DELETE /imagesBotoes*` em `route.js`, `GET /imagesBotoes` em
  `images.js` (métodos diferentes; `express.static('public')` só responde a GET/HEAD). ✓
- `Botao` exportado de `models/index.js`; `notificarAlteracaoBD` resolvido em runtime (igual aos
  controllers). ✓

### Update (mesmo dia) — placeholder `default.png` + tratamento de erro
Aplicadas as duas correções que ficaram pendentes na revisão:
- **`default.png` neutro** gerado em `Server/public/imagesBotoes/` (PowerShell + `System.Drawing`:
  fundo cinza, ícone de "imagem" + texto "Sem imagem", 256×256). Os **5 sítios** de exibição passam a
  usar `/imagesBotoes/default.png` (com barra inicial): `MainContent.jsx`, `PedidosPendentes.jsx` (2×),
  `BotoesList.jsx`, `RequestListDrawer.jsx` e o preview do `BotaoForm.jsx`. Removido o `urgent.png`
  provisório (era o ícone de **emergência**, enganador para um botão sem imagem) e corrigida a barra
  inicial em falta que já existia nos fallbacks antigos.
- **Tratamento de erro** em `EditBotoes.jsx`: `handleUploadImagem` e `handleDeleteImagem` passam a ter
  `try/catch` com `console.error` + `window.alert` (coerente com o `handleSubmit`), eliminando as
  *unhandled rejections* e dando feedback ao staff quando o upload/delete falha.

### Update (mesmo dia) — nome original no upload: colisão de nomes + cache-busting (padrão reutilizável)
O upload passou a guardar com o **nome original** do ficheiro (em vez de um nome único gerado), a pedido
do utilizador (ficheiros reconhecíveis na pasta). Isso levanta três pontos, resolvidos aqui:

**1. Segurança — `path.basename()` no nome do ficheiro.**
Usar `file.originalname` diretamente no destino permitiria *path traversal*: um cliente que **falsifique
à mão** o header multipart com `filename: "../../x.png"` escreveria fora da pasta `imagesBotoes/`. Não é
explorável pela UI normal e exige staff já autenticado (`requireStaff`) — é **defesa em profundidade**,
não um buraco aberto — mas fecha-se com `path.basename(file.originalname)` no callback `filename` do
Multer, que descarta quaisquer componentes de caminho.

**2. Colisão de nomes — `ConflitoImagemModal` com 3 opções.**
Guardar pelo nome original faz com que dois ficheiros homónimos colidam. Quando o nome já existe
(deteção **no cliente** via `imagensDisponiveis`, fresca na sessão) abre um modal com:
- **Adicionar como cópia** → o backend procura o próximo nome livre `nome(1).ext`, `nome(2).ext`… (loop
  `fs.existsSync`). Formato `()` e **não** `_`, porque já há ficheiros que usam `_` no nome (ex.
  `mudar_de_posicao.png`) — `()` evita ambiguidade.
- **Substituir a existente** → escreve o nome original (sobrescreve).
- **Cancelar** → não faz nada.
O modo viaja por **query param** (`?onConflict=rename|replace`), não no corpo, porque está disponível de
forma síncrona no callback `filename` do Multer (os campos de texto do multipart só existem **depois** de
o Multer processar — tarde demais para decidir o nome).

**3. Cache-busting (`versoes`) — porquê existe e quando reutilizar.**
*Problema:* ao **substituir** uma imagem, o URL é exatamente o mesmo (`/imagesBotoes/Auxiliar.png`); o
browser serve a versão **em cache** e o staff não vê a nova. Em desktop um F5 resolve, mas **em
telemóvel/kiosk recarregar nem sempre é prático** — por isso resolve-se no código.
*Solução (cache-busting por query param):* um `Map` de estado `versoes: path → timestamp` em
`EditBotoes`. Quando um upload **substitui um path que já existia**, regista-se
`versoes.set(path, Date.now())`. Na renderização (`BotaoForm`), o `src` fica
`` `${apiUrl}${path}${versoes.get(path) ? '?v='+versoes.get(path) : ''}` ``. URLs diferentes = recursos
diferentes para o browser → vai buscar a nova; o Express **ignora** o query param ao servir o estático.
*Âmbito deliberadamente local:* o `versoes` vive só em `EditBotoes` e desce como prop a `BotaoForm`.
**Não é um conceito a espalhar pelo código** — o resto da app passa pelo API e vive no estado React
(re-render automático com dados frescos), por isso não sofre deste problema. Só **ficheiros estáticos
servidos num URL fixo cujo conteúdo é substituível** precisam disto.

> **⚠️ Reutilização futura — ler isto antes de reinventar.** Está planeado (ainda **não** implementado)
> permitir **foto de perfil dos utentes** — e eventualmente do staff. Esse caso é **idêntico**: ficheiro
> estático, URL fixo, conteúdo substituível. Quando chegar, aplicar **o mesmo padrão de cache-busting**
> (`?v=timestamp` no `src`, marcado no momento da substituição), confinado ao componente que edita/mostra
> essas fotos. Não inventar solução nova — é o `versoes` outra vez. (Alternativa, se um dia for genérico
> demais para gerir à mão: servir a pasta de uploads com `Cache-Control: no-cache`, mas isso penaliza
> **todas** as imagens, não só as substituídas — por agora não compensa.)

### Estado
- [x] Migração dos 52 ficheiros para a raiz + subpastas removidas
- [x] BD: 42 paths atualizados para a estrutura plana
- [x] `images.js` plano (sem recursão)
- [x] `Botao.imagem` `allowNull: true`
- [x] `POST /imagesBotoes/upload` + `DELETE /imagesBotoes` (com `requireStaff` e validação de path)
- [x] `uploadImagemBotao`/`deleteImagemBotao` no cliente + UI (carregar + lixo)
- [x] Fallback em `MainContent` e `PedidosPendentes`
- [x] **Placeholder `default.png` criado + os 5 sítios unificados** em `/imagesBotoes/default.png`
  (sem `urgent.png` provisório; barra inicial corrigida) — ver Update acima
- [x] **Tratamento de erro** (`try/catch` + `alert`) em `handleUploadImagem`/`handleDeleteImagem`
- [x] **Nome original no upload** + `path.basename()` (segurança contra *path traversal*)
- [x] **`ConflitoImagemModal`** (3 opções: cópia `nome(1)` / substituir / cancelar) + query `onConflict`
- [x] **Cache-busting `versoes`** (substituição visível sem refresh) — padrão reutilizável p/ fotos de perfil
- [ ] Verificação visual em runtime (carregar, selecionar, eliminar, colisão de nome, substituir;
  confirmar que o botão afetado não desaparece e mostra o placeholder)

---

## 2026-06-17 — Compactação do layout de staff (remover header + procura inline)

### Motivação
O header fixo "InovLAR" no topo das páginas de staff ocupava ~80px de altura sem
acrescentar informação (o branding já está na sidebar como "InovLAR Staff"). A caixa
de procura vivia nesse header, longe da ação principal. Objetivo: aproveitar o espaço
vertical, juntar procura + ação no mesmo cabeçalho de página e reduzir ligeiramente
tamanhos/paddings para tornar o ecrã mais denso e com menos cliques/scroll.

### Decisões
- **Eliminar o `<header>`** do `StaffShell` (e a prop `headerRight`). O shell é
  partilhado por `StaffHome` (Utentes) e `BotoesList` (Botões) → mudança aplicada
  às **duas páginas** para manter consistência.
- **Procura passa para o cabeçalho da página**, ao lado do botão "Novo Utente"/"Novo
  Botão" (antes só visível em `sm:` no header; agora aparece também em mobile,
  empilhada por cima da linha em ecrãs pequenos via `flex-col sm:flex-row`).
- **Compactar levemente** (pedido de "diminuir levemente"):
  títulos `text-3xl` → `text-2xl`, paddings de cartão `p-6` → `p-4`, grelha
  `gap-6` → `gap-4`, botões de ação `px-5 py-2.5` → `px-4 py-2`.

### Alterações — `Client/src/Components/layout/StaffShell.jsx`
- Removido todo o bloco `<header>` (título "InovLAR" + slot `headerRight`).
- Removida a prop `headerRight` da assinatura do componente.
- Padding do conteúdo: `p-6 md:p-12` → `p-6 md:px-10 md:py-8`.

### Alterações — `Client/src/Pages/StaffHome.jsx`
- Removida a const `headerRight`; `<StaffShell>` deixa de receber essa prop.
- Cabeçalho da página passa a `flex-col sm:flex-row` com grupo `procura + botão`
  alinhado à direita (procura `w-full sm:w-56`).
- Cartões: `gap-6`→`gap-4`, `p-6`→`p-4`, avatar `w-16 h-16 text-[24px]`→
  `w-14 h-14 text-[20px]`, espaçamentos internos `mb-4`→`mb-3`.

### Alterações — `Client/src/Components/botoes/BotoesList.jsx`
- Mesmo padrão da `StaffHome` (procura inline "Procurar botão...", remoção de
  `headerRight`).
- Cartões: `gap-6`→`gap-4`, `p-6`→`p-4`, imagem `w-32 h-32 mb-4`→`w-28 h-28 mb-3`.

### Notas
- A procura mantém a mesma lógica de filtragem (por nome) — só mudou de sítio.
- `grep headerRight` no código → 0 ocorrências (só resta esta referência histórica
  no log).

### Estado
- [x] `StaffShell` — header removido + prop `headerRight` eliminada
- [x] `StaffHome` — procura inline + cartões compactados
- [x] `BotoesList` — procura inline + cartões compactados
- [ ] Verificação visual no browser (Utentes + Botões, desktop e mobile)

---

## 2026-06-17 — Layout de staff responsivo (sidebar → barra inferior em mobile)

### Motivação
A sidebar do staff é `hidden md:block` → em smartphones **não havia navegação
nenhuma**. A partir de maquetes fornecidas pelo utilizador (versão mobile da
página de Utentes com barra de separadores no fundo), tornar a área de staff
responsiva: em mobile a navegação passa para uma **barra inferior fixa** (padrão
de app nativa), mantendo a sidebar no desktop.

### Decisões
- **Fonte única de navegação** (`navItems.js`): sidebar (desktop) e barra inferior
  (mobile) consomem a mesma lista → nunca dessincronizam. Cada item tem `label`
  (completo, sidebar) e `short` (curto, barra inferior).
- **Barra inferior só em mobile** (`md:hidden`); sidebar continua `hidden md:block`.
  Respeita a safe-area do iOS (`pb-[env(safe-area-inset-bottom)]`).
- **4º separador**: mantido como **"Password" + cadeado** (fiel à rota
  `/staff/alterar-password`), e **não** "Definições"/engrenagem da maquete —
  decisão do utilizador, para o rótulo não enganar.
- **Botão "voltar" na página Pedidos Pendentes**: é um ecrã independente (estilo
  monitor, sem shell). Em mobile, tocar no separador "Pedidos" levava lá sem saída
  (só havia Esc, inútil sem teclado) → adicionada seta ← fixa no canto superior
  esquerdo (`navigate("/staff")`), como na maquete.
- **Título maior em mobile**: `text-3xl md:text-2xl` (grande no telemóvel como na
  maquete, compacto no desktop).

### Ficheiros novos
- `Client/src/Components/layout/navItems.js` — `NAV_ITEMS` partilhado.
- `Client/src/Components/layout/StaffBottomNav.jsx` — barra inferior (mobile),
  com highlight do separador ativo via `useLocation`.

### Alterações
- `Client/src/Components/layout/StaffShell.jsx` — importa e renderiza
  `<StaffBottomNav />`; conteúdo ganha `pb-24 md:pb-8` (não fica tapado pela barra)
  e `p-4 sm:p-6` (menos padding em ecrãs pequenos).
- `Client/src/Components/layout/StaffSidebar.jsx` — `NAV_ITEMS` deixou de ser local;
  passa a importar de `navItems.js`.
- `Client/src/Pages/StaffHome.jsx` + `Client/src/Components/botoes/BotoesList.jsx` —
  título `text-3xl md:text-2xl`.
- `Client/src/Pages/PedidosPendentes.jsx` — botão de voltar fixo (←).

### Verificação
- `npx vite build` → ✓ built (3050 módulos). O *warning* de CSS
  (`#ff8080; !important;`) é pré-existente em `index.css`, não relacionado.

### Estado
- [x] `navItems.js` + `StaffBottomNav` criados
- [x] `StaffShell` renderiza barra inferior + reserva espaço
- [x] `StaffSidebar` usa fonte partilhada
- [x] Botão voltar em Pedidos Pendentes (entretanto substituído — ver abaixo)
- [x] `vite build` sem erros
- [ ] Verificação visual num telemóvel real / DevTools (mobile + desktop)

---

## 2026-06-17 — Barra inferior também em Pedidos Pendentes (substitui a seta voltar)

### Motivação / decisão
Em vez da seta "voltar" adicionada acima (saída ad-hoc da página de Pedidos),
o utilizador preferiu **a mesma barra inferior das outras páginas** também no
ecrã de Pedidos Pendentes — mais consistente. A seta foi removida.

### Alterações — `Client/src/Pages/PedidosPendentes.jsx`
- Removido o botão de voltar (←) fixo.
- Importado e renderizado `<StaffBottomNav />` (continua `md:hidden` → só mobile;
  em desktop a página mantém o aspeto de monitor, sem navegação).
- Adicionado espaçador `<div className="h-20 md:hidden" />` no fim do container
  para o conteúdo não ficar tapado pela barra fixa — abordagem robusta que não
  depende da especificidade do CSS de `.pedidos-container` (`index.css`).

### Verificação
- `npx vite build` → ✓ built (8.0s, sem erros novos).

### Estado
- [x] Seta voltar removida de Pedidos Pendentes
- [x] `StaffBottomNav` presente em Pedidos Pendentes (mobile) + espaçador
- [x] `vite build` sem erros
- [ ] Verificação visual mobile (a barra navega corretamente a partir de Pedidos)

---

## 2026-06-17 — Ajustes mobile: preview no topo, cartões e folga da barra inferior

### Motivação (feedback do utilizador, em mobile)
1. Nos formulários criar/editar, a **pré-visualização deve ficar em cima** (no
   telemóvel via-se o form todo antes da preview).
2. A **barra inferior tapava** a última linha de cartões nas listas.
3. Os **quadrados dos botões** eram grandes demais — só cabia 1 por linha; deviam
   caber **2 por linha**.
4. **Utentes**: tamanho está bom, não mexer.

### Alterações

**`StaffShell.jsx`** — folga inferior em mobile passou de `pb-24` (96px, ficava
aquém da barra de 64px + safe-area do iPhone) para
`pb-[calc(6rem+env(safe-area-inset-bottom))]`. Resolve (2) para as duas listas
sem mexer no tamanho dos cartões.

**`BotoesList.jsx`** — grelha `grid-cols-1 sm:grid-cols-2 …` → `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
(2 por linha já no telemóvel). Quadrado da imagem `w-28 h-28` →
`w-20 h-20 sm:w-24 lg:w-28` (cresce com o ecrã); padding `p-4`→`p-3 sm:p-4`,
título `text-xl`→`text-base sm:text-lg lg:text-xl`. Resolve (3). **StaffHome
(utentes) não foi tocado** — (4).

**`BotaoForm.jsx`** — preview movida para cima em mobile com utilitários `order`:
form `order-2 lg:order-1`, preview `order-1 lg:order-2`. Em desktop mantém-se
form à esquerda / preview à direita. Resolve (1) para o botão.

**`UtenteForm.jsx`** — reescrito para o mesmo estilo do `BotaoForm` (header com
voltar + grid form|preview) e **ganhou uma pré-visualização ao vivo**: cartão com
iniciais (avatar), badge "Estável", nome e quarto, a condizer com o cartão do
StaffHome. Decisão do utilizador (preferiu criar preview em vez de deixar o form
simples). `NewUtente`/`EditUtente` deixaram de passar a prop `containerClass`.

### Notas / dívida técnica
- As classes `.new-container` / `.edit-container` em `index.css` ficaram **sem uso**
  (o UtenteForm já não as aplica). Deixadas no ficheiro por agora — candidatas a
  limpeza futura.

### Verificação
- `npx vite build` → ✓ built (7.9s, sem erros novos).

### Estado
- [x] `StaffShell` — folga inferior corrigida (safe-area)
- [x] `BotoesList` — 2 por linha + quadrados mais pequenos
- [x] `BotaoForm` — preview no topo (mobile)
- [x] `UtenteForm` — redesenhado + pré-visualização ao vivo
- [x] `vite build` sem erros
- [ ] Verificação visual mobile (formulários, listas, sem cartões tapados)
- [ ] (Opcional) Remover CSS morto `.new-container` / `.edit-container`

---

## 2026-06-18 — Folga da barra inferior: espaçador fixo em vez de `padding-bottom`

### Motivação
A correção da entrada anterior ("Ajustes mobile…", 2026-06-17) reservava espaço com
`pb-[calc(6rem+env(safe-area-inset-bottom))]` no contentor do `StaffShell`. Mesmo
assim a barra inferior continuava a **tapar a última linha** de cartões (Utentes e
Botões) — e, depois de a substituir por um espaçador grande, a folga ficou
**exagerada**. Objetivo: folga igual ao espaço entre cartões, sem ser tapada.

### Causa
No mesmo `className` coexistiam `sm:p-6` e o `pb-[calc(...)]` base. Em ecrãs ≥ 640px
(`sm`) — onde a barra inferior ainda aparece mas já se aplica `sm:p-6` — a regra
`padding:1.5rem` do `sm:p-6` (dentro de `@media`, logo **mais abaixo** na folha de
estilos) **vencia** o `padding-bottom` base do `pb-[calc(...)]`, repondo-o para 24px
→ a barra de 64px tapava os cartões. (Isto abrange o intervalo 640–767px, em que a
sidebar ainda está escondida e a barra inferior está visível.)

### Decisão
Em vez de lutar com a especificidade do `padding`, **reservar o espaço com um
espaçador explícito** a seguir aos `children`:
```jsx
<div className="p-4 sm:p-6 md:px-10 md:py-8 flex-1 overflow-y-auto">
    {children}
    {/* Espaçador para o último cartão não ficar tapado pela barra inferior (h-16 = 64px). */}
    <div className="h-16 md:hidden" aria-hidden="true" />
</div>
```
- `h-16` = **64px** = altura exata da barra (`StaffBottomNav`, `h-16`). Com o padding
  do contentor dá a mesma folga visual do `p-4` (16px) entre cartões — nem a mais
  (a 1ª tentativa, `h-24`/96px, ficou exagerada) nem a menos.
- `md:hidden` → só existe em mobile; em desktop não há barra e o `md:py-8` chega.
- Imune à especificidade: é um elemento real no fluxo, não um `padding` reponível.

### Alterações — `Client/src/Components/layout/StaffShell.jsx`
- Removido `pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8` do contentor.
- Acrescentado `<div className="h-16 md:hidden" aria-hidden="true" />` após `{children}`.

### Notas
- Alteração só de classes no JSX (sem novos imports/JS); o `vite build` é corrido na
  entrada seguinte e cobre as duas alterações.

### Estado
- [x] Espaçador `h-16` em mobile (StaffShell) — última linha já não fica tapada
- [x] Folga reduzida de 96px → 64px (mesmo gap visual do `p-4`)
- [ ] Verificação visual mobile (Utentes + Botões: último cartão totalmente visível)
- [ ] (Opcional) Incluir `env(safe-area-inset-bottom)` no espaçador para iPhones com
  *home indicator* (`h-[calc(4rem+env(safe-area-inset-bottom))]`) — em ecrãs sem
  safe-area é idêntico aos 64px atuais

---

## 2026-06-18 — Clicar no cartão abre o menu de ações (⋮) — Utentes e Botões

### Motivação (feedback do utilizador)
Clicar no corpo do cartão (Utentes e Botões) não fazia nada; Editar/Eliminar só
estavam no ícone ⋮, pequeno para tocar em mobile. Pedido: **clicar no cartão também
abre o mesmo menu** do ⋮.

### Decisão — opção "reutilizar o `ItemMenu`" (a mais simples, sem UI nova)
Entre duas hipóteses apresentadas (A: reutilizar o dropdown do ⋮; B: estado
"selecionado" com botões inline), o utilizador escolheu **A**. O cartão inteiro passa
a abrir/fechar o popover já existente.

**`ItemMenu` passa a poder ser controlado:**
- Sem `open`/`onOpenChange` → continua a gerir o próprio estado (retrocompatível).
- Com `open` + `onOpenChange` → o estado vive no pai (a lista), para o clique no
  cartão e o clique no ⋮ partilharem o mesmo estado.
- Nova prop `boundaryRef`: a **fronteira do "clicar fora"** passa a ser o **cartão**,
  não só o ícone. Assim, clicar no corpo do cartão **alterna** (abre/fecha) sem o
  piscar "fecha-no-mousedown + reabre-no-click"; só cliques verdadeiramente fora
  fecham. O `onClick` do cartão faz toggle; o ⋮ e os botões de ação fazem
  `stopPropagation` para não dispararem o toggle do cartão.

### Alterações — `Client/src/`
- **`Components/layout/ItemMenu.jsx`** — modo controlado opcional (`open`,
  `onOpenChange`) + `boundaryRef`; `setOpen` encaminha para o pai quando controlado.
  Sem props, comporta-se exatamente como antes.
- **`Pages/StaffHome.jsx`** — `openMenuId` (qual cartão tem o menu aberto) +
  `openCardRef`; cartão com `onClick` (toggle), `ref` condicional e `cursor-pointer`;
  "Aceder Perfil" ganhou `stopPropagation` (mantém a ação primária intacta); `ItemMenu`
  controlado.
- **`Components/botoes/BotoesList.jsx`** — mesmo padrão (o cartão de botão não tinha
  ação primária → o cartão todo abre o menu).

### Notas
- **Um menu aberto de cada vez:** `openMenuId` é único por lista → abrir num cartão
  fecha o de outro. O `openCardRef` só é colado ao cartão atualmente aberto, por isso
  basta **um** ref por lista (não um por cartão).
- **Acessibilidade:** o cartão clicável é um `<div>` (segue o padrão já usado no
  projeto, ex.: imagens com `onClick` no `BotaoForm`). O ⋮ continua a ser um `<button>`
  real (focável por teclado) e, nos Utentes, "Aceder Perfil" também → as ações têm
  sempre um alvo focável. Tornar o cartão `role="button"` + suporte de teclado fica
  como follow-up opcional.

### Verificação
- `npm run build` (Client) → ✓ built (3050 módulos). Mantém-se só o aviso CSS
  pré-existente (`#ff8080; !important;`, `index.css:555`) e o aviso de tamanho de
  chunk, ambos não relacionados.

### Estado
- [x] `ItemMenu` controlado + `boundaryRef`
- [x] `StaffHome` — clicar no cartão abre o menu; "Aceder Perfil" intacto
- [x] `BotoesList` — clicar no cartão abre o menu
- [x] `vite build` sem erros novos
- [ ] Verificação visual mobile (abrir por clique no cartão e pelo ⋮; fechar fora;
  Editar/Eliminar; "Aceder Perfil" não abre o menu)

---

## 2026-06-18 — Menu de ações como *bottom sheet* em mobile (popover só no desktop)

### Motivação (feedback do utilizador, em mobile)
Na grelha de Botões em telemóvel são 2 colunas → cartões pequenos (~170px). O menu
do ⋮ era um popover `absolute` de `w-40` (160px) ancorado dentro do cartão: ocupava
quase toda a largura, **sobrepunha-se à imagem/título e ficava espremido/cortado**
(o cartão tem `overflow-hidden`). No desktop, com cartões maiores, o popover fica bem.

### Decisão — menu responsivo dentro do próprio `ItemMenu`
Mantém-se **um só componente**, com duas apresentações por *breakpoint*:
- **Desktop (`md+`)**: o popover de sempre, ancorado ao ⋮ (`md:absolute md:right-0
  md:top-full md:w-40`).
- **Mobile (`<md`)**: **bottom sheet** que desliza de baixo (`fixed inset-x-0
  bottom-0`), com **fundo escurecido** (backdrop), **pega**, **cabeçalho** (miniatura
  + nome + subtítulo do item) e linhas grandes **Editar / Eliminar / Cancelar**.

Porquê assim:
- Padrão **nativo** reconhecível (intuitivo para quem não conhece a app) e com **alvos
  de toque grandes**. Mantém o ⋮ visível como gatilho descobrível (não repete o erro
  do "estado selecionado" testado e descartado, que escondia o gatilho e fazia crescer
  todos os cartões da linha).
- **Sem portais:** o painel usa `position: fixed`, que **escapa ao `overflow-hidden`**
  do cartão. Nenhum ascendente tem `transform`/`filter`/`contain`, por isso o `fixed`
  é relativo à *viewport* (confirmado na árvore StaffShell → grid → cartão).

### Mecânica de fecho (sem piscar)
- O backdrop e o painel são **descendentes do cartão no DOM** (apesar de `fixed`), por
  isso o `boundaryRef` (= cartão) **contém-nos** → o handler de "clicar fora"
  (`mousedown`) **não** fecha ao tocar no sheet. O fecho vem do `onClick` explícito do
  backdrop / "Cancelar" / escolha de ação (todos com `stopPropagation`).
- `z-index`: backdrop `z-40`, painel `z-50` (fica acima da `StaffBottomNav`, `z-40`,
  que o sheet tapa por completo).
- Safe-area do iPhone no fundo do sheet: `pb-[calc(0.5rem+env(safe-area-inset-bottom))]`.

### Alterações — `Client/src/`
- **`Components/layout/ItemMenu.jsx`** — painel reescrito: backdrop `md:hidden` +
  painel com classes responsivas (sheet em mobile / popover em `md+`); cabeçalho e
  "Cancelar" são `md:hidden`; botões Editar/Eliminar crescem em mobile
  (`py-3.5 md:py-2`, ícone `text-[22px] md:text-sm`). Novas props **`title`**,
  **`subtitle`**, **`thumbnail`** para o cabeçalho do sheet (opcionais → sem elas o
  comportamento desktop é igual ao anterior).
- **`Pages/StaffHome.jsx`** — passa `title={utente.nome}`, `subtitle="Quarto Geral"` e
  `thumbnail` (iniciais) ao `ItemMenu`.
- **`Components/botoes/BotoesList.jsx`** — passa `title={botao.nome}`,
  `subtitle={categoria}` e `thumbnail` (imagem do botão) ao `ItemMenu`.

### Notas
- O ⋮ e o clique no cartão continuam a abrir o mesmo menu (lógica controlada
  `open`/`onOpenChange` + `boundaryRef` da entrada anterior, "Clicar no cartão abre o
  menu"). Só mudou a **apresentação** em mobile.
- Antes do *bottom sheet* foi experimentada (e descartada pelo utilizador) a opção do
  "estado selecionado" com botões inline — guardada numa branch à parte.

### Verificação
- `npm run build` (Client) → ✓ built (3050 módulos). Só o aviso CSS pré-existente
  (`#ff8080; !important;`, `index.css:555`) e o de tamanho de chunk — não relacionados.

### Estado
- [x] `ItemMenu` — sheet em mobile + popover em desktop (responsivo)
- [x] Backdrop + pega + cabeçalho (miniatura/nome) + Cancelar (mobile)
- [x] `StaffHome` e `BotoesList` passam `title`/`subtitle`/`thumbnail`
- [x] `vite build` sem erros novos
- [ ] Verificação visual mobile (sheet desliza, não tapa nada, fecha por backdrop/
  Cancelar/ação) e desktop (popover inalterado)

---

## 2026-06-18 — Correção: ⋮ dos outros cartões por cima do bottom sheet (Botões)

### Sintoma
No ecrã de Botões, com o bottom sheet aberto, os ícones ⋮ dos **outros** cartões
apareciam **por cima** do sheet e continuavam clicáveis. No ecrã de Utentes não
acontecia.

### Causa — *stacking context* aprisionado
Em `BotoesList`, o ⋮ está dentro de `<div className="absolute top-2 right-2 z-10">`.
Esse `position + z-index` cria um **contexto de empilhamento**, que prende o
backdrop (`z-40`) e o painel (`z-50`) do sheet ao nível **`z-10`** relativo à
*viewport*. Como os ⋮ dos outros cartões também estão a `z-10` e vêm **depois no
DOM**, pintam por cima do backdrop. Em `StaffHome` o ⋮ não tem wrapper com
`z-index`, por isso o sheet já escapava para o contexto raiz (sem o problema).

### Correção — elevar o cartão aberto
Quando um cartão está aberto, ganha **`z-50`** (já tinha `relative`). Isso eleva
**todo o seu subárvore** — incluindo o backdrop/painel `fixed` — acima dos cartões
vizinhos (`z-auto`/`z-10`) e da `StaffBottomNav` (`z-40`). O backdrop passa a tapar
e a **bloquear cliques** nos ⋮ dos outros cartões. Sem portais — coerente com a
decisão registada de os evitar; resolve o "problema de stacking entre cartões" que
essa mesma nota previa.

### Alterações — `Client/src/`
- **`Components/botoes/BotoesList.jsx`** — cartão: `className` condicional com `z-50`
  quando `openMenuId === botao.id`.
- **`Pages/StaffHome.jsx`** — mesma elevação condicional (defensivo/consistente;
  ali já funcionava por não haver wrapper `z-10`).

### Notas
- `z-index` é só ordem de pintura → sem alteração de layout. `overflow-hidden` do
  cartão continua a **não** cortar o sheet (é `fixed`, contido pela *viewport*; nenhum
  ascendente tem `transform`/`filter`).

### Verificação
- `npm run build` (Client) → ✓ built (3050 módulos). Só o aviso CSS pré-existente
  e o de tamanho de chunk — não relacionados.

### Estado
- [x] Cartão aberto elevado a `z-50` (Botões + Utentes)
- [x] `vite build` sem erros novos
- [ ] Verificação visual mobile (Botões: ⋮ dos outros cartões tapados e não clicáveis
  com o sheet aberto)

---

## 2026-06-18 — Animação de abertura do menu de ações (sheet / popover / fundo)

### Motivação
O menu (popover no desktop, bottom sheet em mobile) **aparecia instantaneamente**.
Pedido: abrir **com animação**.

### Decisão — animações de *entrada* via config do Tailwind (sem libs)
Como o Tailwind é carregado por CDN com **config inline** no `index.html`, as
animações foram registadas aí (`theme.extend.keyframes` + `theme.extend.animation`),
ficando disponíveis como utilitários normais (com variantes `md:`):
- **`fade-in`** (200ms) — fundo escurecido (backdrop) do sheet.
- **`sheet-up`** (260ms) — o painel desliza de baixo (`translateY(100%)→0`) em mobile.
- **`pop-in`** (140ms) — *fade* + leve escala (`scale(.96)→1`) no popover do desktop,
  com `origin-top-right` (cresce a partir do ⋮).

Aplicação no painel (um só elemento, responsivo): `animate-sheet-up` (base/mobile)
**+** `md:animate-pop-in md:origin-top-right` (desktop sobrepõe a animação). O backdrop
leva `animate-fade-in`.

Porquê só CSS/keyframes: as animações **correm ao montar** (o painel é
`{open && …}`), sem estado extra nem dependências (framer-motion etc.). Coerente com a
stack atual (React + Tailwind).

### Alterações
- **`Client/index.html`** — `keyframes` + `animation` (`fade-in`, `sheet-up`, `pop-in`)
  no `theme.extend`.
- **`Client/src/Components/layout/ItemMenu.jsx`** — backdrop `animate-fade-in`; painel
  `animate-sheet-up md:animate-pop-in md:origin-top-right`.

### Notas / limitação
- **Só animação de entrada.** Ao fechar, o menu desmonta de imediato (sem animação de
  saída) — animar a saída exigiria manter o elemento montado durante a transição
  (estado "a fechar" + `onAnimationEnd` para desmontar). Fica como follow-up se se
  quiser o fecho também animado.

### Verificação
- `npm run build` (Client) → ✓ built (3050 módulos). Só o aviso CSS pré-existente
  e o de tamanho de chunk — não relacionados.

### Estado
- [x] Keyframes/animation no `index.html` (Tailwind config)
- [x] `ItemMenu` — sheet desliza (mobile), popover faz *pop-in* (desktop), backdrop *fade*
- [x] `vite build` sem erros novos
- [ ] Verificação visual (abrir em mobile e desktop)
- [ ] (Opcional) Animação de **fecho** (saída)

---

## 2026-06-18 — Sessão persistente por cookie + esqueleto (revê o reload do Pin-to-Exit)

### Contexto — decisão revista (ler antes de "corrigir")
Em 2026-06-15 ("Fluxo Pin-to-Exit") decidiu-se que **qualquer reload/reinício
re-bloqueia** (gate `staffUnlocked` só em memória, arranca a `false`). O utilizador
pediu agora para **manter o acesso no reload** (como o cookie de 2026-06-09), mas
**sem perder o objetivo do kiosk** — que um utente não chegue ao staff sem PIN.

Modelo acordado (palavras do utilizador):
> autentica → mantém cookie → entra na tabela do utente → **perde acesso (cookie)** →
> botão 🛠 → pede PIN → reautentica → … → terminar sessão → perde cookie.

Ou seja: a fronteira do kiosk **deixa de ser o reload** e **passa a ser entrar no
tabuleiro do utente** (a "gaiola"). Esta entrada **substitui** a regra "reload
re-bloqueia" do Pin-to-Exit; o resto desse fluxo mantém-se.

### Decisão
1. **Restaurar o acesso do cookie ao arrancar.** O `ContextProvider` pergunta ao
   servidor (`staffStatus`) e, se `autenticado`, faz `setStaffUnlocked(true)`. Novo
   estado `staffChecked` (false até a verificação terminar).
   - **Anti-race:** o restauro **não corre em `/main`** (verifica
     `window.location.pathname`) — senão reabriria o acesso dentro da gaiola, que
     a montar faz exatamente o contrário.
2. **Esperar pela verificação sem branco.** O `RequireStaff` mostra um **esqueleto**
   (`StaffSkeleton`) enquanto `!staffChecked`, em vez de página em branco ou
   "A carregar…" — pedido do utilizador (estilo Instagram: chrome real + blocos
   `animate-pulse`). Só depois decide: render ou `Navigate("/")`.
3. **Entrar na gaiola revoga o acesso.** O `MainContent`, ao montar, além de
   `setStaffUnlocked(false)`, passa a chamar **`staffLogout()`** (limpa o cookie).
   Assim, voltar ao staff exige o PIN (🛠 → `PinPrompt` → `staffLogin`).
4. **Logout** continua a limpar o cookie (`StaffSidebar`, inalterado).

### Alterações — `Client/src/`
- **`ContextProvider.jsx`** — importa `staffStatus`; novo `staffChecked`; `useEffect`
  de restauro do cookie (salta `/main`); expõe `staffChecked` no Context.
- **`Components/RequireStaff.jsx`** — usa `staffChecked`; enquanto verifica → render
  `<StaffSkeleton />`; só depois redireciona/permite.
- **`Components/layout/StaffSkeleton.jsx`** (novo) — esqueleto com o shell real
  (`StaffShell` + `StaffSidebar`) e cartões "fantasma" (`animate-pulse`).
- **`Pages/MainContent.jsx`** — `staffLogout()` ao entrar na gaiola (revoga acesso).
- **`Pages/StaffLogin.jsx`** — só comentário (deixou de ser verdade "pede PIN em cada
  arranque"; o reload com cookie já não passa por aqui).

### Tradeoff de segurança (assumido)
Um reinício do tablet **mantém** o staff autenticado se a sessão não tiver sido
"entregue" a um utente. A proteção do kiosk passa a estar na **entrega do tabuleiro**
(entrar em `/main` revoga), não no reinício. A segurança do servidor (`requireStaff`
nas rotas de escrita) é independente disto e mantém-se.

### Verificação
- `npm run build` (Client) → ✓ built (3051 módulos; +1 = `StaffSkeleton`). Só o aviso
  CSS pré-existente e o de tamanho de chunk.

### Estado
- [x] Restauro do acesso por cookie ao arrancar (`staffChecked`)
- [x] `RequireStaff` mostra esqueleto durante a verificação (sem branco)
- [x] Entrar na gaiola (`/main`) limpa o cookie (revoga acesso)
- [x] `vite build` sem erros novos
- [ ] Verificação no dispositivo: reload em `/staff` mantém; entrar num utente +
  voltar pede PIN; logout pede PIN

---

## 2026-06-18 — Polir o menu de ações: forma do popover + hover recortado

### Sintomas (desktop/tablet)
1. O popover (⋮) tinha **cantos exageradamente redondos** (parecia uma cápsula).
2. O **hover** de Editar/Eliminar era **retangular** e ultrapassava os cantos
   redondos do painel.

### Causa
- **Raios:** o `tailwind.config` (inline no `index.html`) **redefine a escala** —
  `rounded` = 1rem (16px), `rounded-lg` = **2rem (32px)**, `rounded-xl` = 3rem
  (48px). Bom para os **cartões** (elementos grandes), mas grande demais para um
  menu pequeno: o painel a `rounded-lg` (32px) e os botões a `rounded-xl` (48px)
  ficavam quase cápsulas.
- **Hover:** o painel não tinha `overflow-hidden`, por isso o fundo retangular do
  botão em hover transbordava os cantos redondos.

### Correção — `Client/src/Components/layout/ItemMenu.jsx`
- **`overflow-hidden`** no painel → o hover dos botões é recortado pela forma
  redonda do painel.
- **Raios explícitos** (a contornar a escala do config): painel
  `rounded-t-[16px]` (sheet) / `md:rounded-[14px]` (popover); miniatura
  `rounded-[10px]`.
- **Botões sem cantos próprios e encostados às margens** (removido
  `rounded-xl md:rounded-md` e o padding interno do painel) → o realce ocupa a
  largura toda e encaixa nos cantos do painel (padrão de dropdown limpo). Em
  mobile, linhas full-width; "Cancelar" separado por `border-t`.
- Popover um pouco mais largo (`md:w-44`) e ícones `md:text-[18px]`.

### Nota (pegadinha a lembrar)
A escala de `borderRadius` do projeto é grande de propósito (cartões). Para
elementos pequenos (menus, chips), usar **valores explícitos** `rounded-[Npx]` em
vez de `rounded-lg/xl`, senão ficam com cantos enormes.

### Verificação
- `npm run build` (Client) → ✓ built (3051 módulos). Só o aviso CSS pré-existente.

### Estado
- [x] `overflow-hidden` + raios explícitos no painel
- [x] Hover encaixa nos cantos redondos (desktop e mobile)
- [x] `vite build` sem erros novos
- [ ] Verificação visual (popover em pc/tablet; sheet em mobile)

---

## 2026-06-18 — Popover invisível no desktop: separar popover (md) do sheet (mobile)

### Sintoma
Depois de adicionar `overflow-hidden` (entrada anterior), o popover no desktop/tablet
**deixou de se ver** — só uma linha fina no cartão.

### Causa — altura a colapsar (estava lá antes, ficou exposta)
O menu era **um só elemento** com classes base (sheet) + overrides `md:` (popover).
No desktop ficava com `md:top-full` (topo) **e** `bottom-0` da base ao mesmo tempo,
ambos relativos ao contentor minúsculo do ⋮ → **altura ≈ 0**. Antes do
`overflow-hidden`, os botões **transbordavam** para fora da caixa de 0px e viam-se
(daí o aspeto "cápsula" do screenshot anterior). Ao adicionar `overflow-hidden`, esse
conteúdo transbordante passou a ser **recortado** → nada visível.

### Correção — dois elementos separados
Em vez de um elemento com overrides `md:` (frágil: depende de TODos os
`fixed`/`inset-x-0`/`bottom-0` da base serem corretamente anulados), agora são **dois**:
- **Popover desktop** (`hidden md:block`): `absolute right-0 top-full mt-1 w-44` — só
  `top`/`right`, **sem `bottom` nem `fixed`** → a altura vem do conteúdo, **não
  colapsa**. `overflow-hidden` + `rounded-[14px]` mantêm o hover recortado.
- **Sheet mobile** (`md:hidden`): `fixed inset-x-0 bottom-0` + backdrop, como antes.
- Botões Editar/Eliminar extraídos para um helper `acoes(compact)` (sem duplicação;
  `compact` = popover, normal = sheet).

### Alterações — `Client/src/Components/layout/ItemMenu.jsx`
- Bloco `{open && …}` reescrito: popover e sheet como elementos distintos; helper
  `acoes`. Comentário de topo atualizado.

### Lição
Para um componente com **duas formas por breakpoint**, é mais seguro **dois elementos**
(`hidden md:block` / `md:hidden`) do que um só a depender de anular `position`/`inset`
da base com `md:` — um override em falta colapsa o layout silenciosamente.

### Verificação
- `npm run build` (Client) → ✓ (3051 módulos). Só o aviso CSS pré-existente.
- [ ] **Visual (pendente, confirmar no dispositivo):** popover no pc/tablet aparece
  como dropdown arredondado com Editar/Eliminar visíveis; hover encaixa nos cantos;
  sheet em mobile inalterado.

---

## 2026-06-19 — Preview dos formulários à direita no desktop (corrige `order` que não pega no Play CDN)

### Sintoma (feedback do utilizador)
Em **Editar Utente** e **Editar/Novo Botão**, no **desktop** a pré-visualização aparecia
à **esquerda** do formulário — devia estar à **direita**. Em mobile já estava bem (em cima).

### Causa — o `lg:order-*` não sobrepõe o `order-*` base no Tailwind **Play CDN**
A entrada de 2026-06-17 pôs a preview em cima no mobile com `order`:
`form order-2 lg:order-1`, `preview order-1 lg:order-2`. A teoria era "desktop volta a
form à esquerda / preview à direita", mas **nunca aconteceu**.

O projeto carrega o Tailwind pelo **Play CDN** (`cdn.tailwindcss.com`, ver `index.html`),
não por um build. Medido com `getComputedStyle` na página real (viewport 1280):
- `order(form)` = **2** e `order(preview)` = **1** → os `lg:order-*` **não ganham** ao
  `order-*` base. A ordem do mobile "vaza" para o desktop e a preview (order-1) fica na
  **coluna esquerda**.
- `lg:grid-cols-2`, `lg:flex-row` e afins funcionam — é **só o utilitário `order`** que
  falha o override no CDN. (Daí parecer correto no código mas render errado.)

### Correção — deixar de usar `order-*`
Trocar o mecanismo por `flex` (sem `order`):
- Contentor: `grid grid-cols-1 lg:grid-cols-2` → **`flex flex-col-reverse lg:flex-row`**.
- Form e Preview: tiram `order-* lg:order-*` e ganham **`w-full lg:flex-1`**.

`flex-col-reverse` põe a preview (2.º filho no DOM) **em cima** no mobile; `lg:flex-row`
volta à ordem do DOM (**form à esquerda, preview à direita**) no desktop. `w-full` garante
largura total no mobile (que o `grid-cols-1` dava de borla) e `lg:flex-1` colunas iguais
no desktop. **Não se reordena o JSX** (form continua primeiro no código).

### Alterações
- **`BotaoForm.jsx`** e **`UtenteForm.jsx`** — contentor + classes do form/preview como
  acima; comentários atualizados a avisar para **não voltar a usar `order-*`** (o CDN
  não o respeita em override por breakpoint).

### Verificação (medido no componente real, não só em teoria)
Servidor de preview + `getComputedStyle`/`getBoundingClientRect` no ecrã real
**Novo Botão** (BotaoForm):
- **1280px:** `flex-direction: row`, preview à **direita**, colunas iguais (568px). ✓
- **375px:** `flex-direction: column-reverse`, preview **em cima**, largura total (327px),
  empilhado. ✓
- UtenteForm: mesma mudança (classes idênticas). ✓

### Lição
Com o **Tailwind Play CDN**, um `lg:<util>` **nem sempre** sobrepõe o `<util>` base do
mesmo elemento — confirmado a falhar no `order`. Para inverter posição por breakpoint,
preferir `flex-col-reverse`/`lg:flex-row` (ou reordenar o DOM) em vez de `order-*`.

---

## 2026-06-19 — Editor de Tabela por utente ("Gerir Tabela") — Fase 1 a 3

### Contexto
A tabela do kiosk (`/main/:id`) mostra botões **hardcoded por categoria**, igual para todos os
utentes. A junction `UtenteBotoes` (com `associarBotao`/`desassociarBotao`) existe mas **nenhum
frontend a usa**, e não guarda posição, ordem nem layout por dispositivo. Pedido: um editor visual
*drag-and-drop* por utente, acessível pelo menu ⋮ do cartão em `/staff`, com layout independente por
**smartphone / tablet / pc** e persistido em BD. Desenho seguiu o mockup **B (Material 3)** do Claude
Design — alinhado aos tokens M3 já usados no staff.

### Decisão
1. **Tabela dedicada ao layout** (`TabelaLayout`), não estender `UtenteBotoes`. Uma linha por
   `(utenteId, dispositivo)`; tudo num campo **`config` JSON**: `{ cols, size, cells }`.
   - `cells` é um **array achatado** (índice = posição *row-major* na grelha; `null` = vazio).
     Mover/trocar = mexer no array; sem tabela de posições. SQLite suporta `DataTypes.JSON`.
2. **Persistência por `Model.sync()`** em `main.js` (como o `StaffAuth.sync()` já fazia) — o projeto
   **não corre migrações**; o `sync({force:false})` cria a tabela se não existir.
3. **GET público / PUT `requireStaff`** — o GET vai ser preciso no kiosk (Fase 4); o PUT é só staff,
   como as outras escritas.
4. **`@dnd-kit/core`** (sem `sortable` — bastam `useDraggable`/`useDroppable`). Cada célula é
   *droppable*; botão da biblioteca e botão colocado são *draggable*. Largar na biblioteca = remover.
5. **Estilo B com tokens M3 existentes** (`primary`, `surface-container`, `outline-variant`…), sem
   cores hardcoded. Cor de categoria fica só como **ponto decorativo** no agrupamento da biblioteca
   (as cores nos botões "ficam para depois", como pedido).
6. **`ItemMenu` com ação opcional `onManage`** — o `BotoesList` não a passa, por isso fica intacto.

### Alterações
- **Backend (novos):** `Server/models/TabelaLayout.js`, `Server/controller/tabelaController.js`.
- **Backend (editados):** `Server/models/index.js` (regista o modelo), `Server/main.js`
  (`TabelaLayout.sync()`), `Server/routes/route.js` (rotas GET/PUT
  `/utentes/:id/tabela/:dispositivo`).
- **Frontend (novos):** `Client/src/api/tabela.js`; `Client/src/Pages/GerirTabela.jsx` (wrapper:
  carrega os 3 layouts, estado por dispositivo, guarda só os alterados);
  `Client/src/Components/tabela/{constants.js, ButtonTile.jsx, TabelaEditor.jsx}` (editor M3 +
  *frame* a simular o dispositivo via `maxWidth`/`aspect-ratio` + lógica DnD).
- **Frontend (editados):** `Client/src/Components/layout/ItemMenu.jsx` (`onManage` + ação "Gerir
  Tabela"), `Client/src/Pages/StaffHome.jsx` (`handleManage` + prop), `Client/src/App.jsx` (rota
  `/gerir-tabela/:id` protegida por `RequireStaff`).
- **Dependência:** `@dnd-kit/core` em `Client/`.

### Estado
- `npm run build` (Client) ✓ — 3059 módulos, dnd-kit resolvido. `node --check` ✓ nos 5 ficheiros
  do servidor. Falta **teste manual end-to-end** (arrastar/guardar/recarregar) e a **Fase 4**:
  o `MainContent` ler o `config` guardado em vez do layout hardcoded.
- Cuidado conhecido: o aviso `[esbuild css minify] ... #ff8080; !important` é **pré-existente**
  (CSS antigo), não vem desta mudança.

---

## 2026-06-22 — Editor de tabelas: dispositivo na horizontal, foco da pesquisa e zona de lixo

### Contexto
Três problemas reportados no editor (`Client/src/Components/tabela/`):
1. A moldura do dispositivo (telemóvel/tablet/PC) aparecia **na vertical** e os botões **transbordavam**
   para fora da moldura em todos os tamanhos.
2. A barra de pesquisa da biblioteca **perdia o foco** logo após a 1ª tecla (só escrevia uma letra).
3. Não havia forma de **eliminar** botões já colocados além do `x` no hover (pouco descoberto).

### Decisão
1. **Horizontal + caber sempre.** Todos os modelos passam a paisagem em `constants.js` (smartphone
   `9/16`→`16/9`; tablet `4/3` e pc `16/10` já eram horizontais). A grelha passa a ter
   `gridTemplateRows: repeat(rows, minmax(0,1fr))` dentro de uma moldura com `aspect-ratio` fixo +
   `overflow-hidden`: a grelha **divide a altura do "ecrã"** e os tiles encolhem para nunca saírem da
   moldura, em vez de empurrarem o conteúdo para fora (antes era `content-start` + `minHeight` por
   célula → transbordo). Os tiles ganham um modo **`fill`** no `ButtonTile` (imagem
   `flex-1 min-h-0 object-contain`, texto `truncate`) para escalarem dentro da célula; a biblioteca e o
   `DragOverlay` mantêm tamanho fixo via `minHeight` (prop `fill` ausente). Trade-off assumido: muitos
   botões → tiles pequenos, mas sempre contidos — também serve de feedback de que o quadro está cheio
   para aquele dispositivo.
2. **Foco da pesquisa.** Causa-raiz: `LibDrop` estava **definido dentro** de `TabelaEditor`. Cada
   `setBusca` criava uma **nova identidade de componente** → o React desmontava/remontava a subárvore
   (incluindo o `<input>`) → perda de foco no DOM. Movido para o **nível do módulo** (identidade
   estável entre renders). `LibraryTile`/`GridCell`/`Segment` já estavam fora — só o `LibDrop` falhava.
3. **Zona de lixo.** Novo componente `TrashZone` (droppable `id:"trash"`), barra flutuante `fixed` no
   fundo, visível só durante o arrasto (`visible={!!activeId}`, via opacity/translate). O `onDragEnd`
   trata `o.tipo === "trash"` em conjunto com o `lib` já existente (largar = `null` no slot). Mantém-se
   também a remoção ao largar na biblioteca (inofensivo) e o `x` no hover.

### Alterações — `Client/src/Components/tabela/`
- **`constants.js`** — `DISPOSITIVOS` em paisagem (smartphone `16/9` `cols 4`/`rows 3`/`maxW 640`;
  tablet `4/3` `cols 5`/`rows 4`/`maxW 760`; pc `16/10` `cols 6`/`rows 4`/`maxW 1000`).
- **`ButtonTile.jsx`** — prop `fill`: quando ligada, `h-full min-h-0` + imagem `flex-1 object-contain`
  com `maxHeight: t.icon` (escala para caber); quando ausente, comportamento antigo (`minHeight: t.min`).
- **`TabelaEditor.jsx`** — grelha com `gridTemplateRows` `1fr` + moldura `overflow-hidden`; wrapper
  `items-center` + cadeia `min-h-0`; `GridCell` sem `minHeight` (`h-full min-h-0` + `fill`, `z-10` no
  botão remover); `LibDrop` e novo `TrashZone` ao nível do módulo; `onDragEnd` apaga também no lixo;
  import de `TAMANHOS` removido (deixou de ser usado aqui).

### Estado
- `npm run build` (Client) ✓ — sem erros novos (mantém-se o aviso pré-existente `#ff8080; !important`).
- Falta **verificação visual** no browser: arrastar/colocar/trocar, encolhimento dos tiles em cada
  dispositivo, pesquisa a escrever continuamente, e eliminar via zona de lixo.

---

## 2026-06-22 — Editor de tabelas: biblioteca com scroll interno (página não cresce)

### Contexto
A coluna da biblioteca de botões (`LibDrop`) fazia a **página crescer** quando tinha muitos botões. A
lista interna já tinha `flex-1 overflow-y-auto`, mas **nada limitava a altura**: a raiz era
`min-h-screen` (pode crescer) e nenhum antepassado fixava a altura, por isso o `overflow-y-auto` nunca
engatava e a biblioteca empurrava a página para baixo.

### Decisão
Fixar a altura do editor ao ecrã **só no desktop** (`lg:`) e fechar a cadeia flex com `min-h-0`, para o
scroll passar a ser **interno à biblioteca**. No mobile (`< lg`) mantém-se o comportamento atual (a
página rola normalmente, biblioteca empilhada por baixo do canvas).

### Alterações — `Client/src/Components/tabela/TabelaEditor.jsx`
- **Raiz** — `min-h-screen` → `min-h-screen lg:h-screen lg:overflow-hidden` (fixa a 100vh no desktop).
- **Corpo** — adiciona `min-h-0` e `lg:overflow-hidden` (mantém `overflow-auto` para o mobile).
- **`LibDrop`** — adiciona `min-h-0` (deixa a coluna encolher para a lista interna rolar).
- **Lista de botões** — `flex-1 overflow-y-auto` → `flex-1 min-h-0 overflow-y-auto`.

### Estado
- `npm run build` (Client) ✓ — sem erros novos (mantém-se o aviso pré-existente `#ff8080; !important`).
- Desktop: barra superior fixa, biblioteca com scroll interno, página não cresce. Mobile inalterado.
  Falta **verificação visual** no browser (desktop com muitos botões + mobile).

---

## 2026-06-22 — Editor de tabelas: slider de tamanho + tiles quadrados + scroll interno da moldura

### Contexto
O tamanho dos botões era controlado por 3 saltos discretos (P/M/G) que, no modelo anterior, esticavam
os tiles para encher a moldura — logo o P/M/G só mexia no ícone/texto e os tiles **não eram quadrados**.
O utilizador queria: (a) tiles **sempre quadrados**; (b) um controlo **contínuo** (slider) em que botão
mais pequeno = cabem mais; (c) **valores intermédios** (entre "muito grande" e "muito pequeno").

### Decisão
- **Um só controlo (slider) substitui o P/M/G e o dropdown "Colunas".** Como os tiles são quadrados, o
  tamanho do botão é `larguraMoldura / colunas` — discreto mas com **7 níveis** (2–8 colunas), o que dá
  os intermédios que faltavam. O slider mexe diretamente nas **colunas** (que é o valor determinístico
  já guardado, indexa o array `cells` em *row-major*); evita-se `auto-fill` de CSS porque colunas
  dinâmicas quebrariam o mapeamento guardado.
- **Orientação intuitiva:** slider à **direita = botões maiores** (menos colunas). Implementado com
  `value = COLS_MIN + COLS_MAX - cols` (sem inverter o significado de `cols` no resto do código).
- **Escala do ícone/texto derivada das colunas** (`escalaPorColunas`: ≤4→G, ≤6→M, senão P) — mantém o
  `ButtonTile`/`TAMANHOS` sem alterações estruturais. O `size` guardado continua sincronizado
  (`handleCols` faz `setCols` + `setSize`), por isso o backend/kiosk (Fase 4) não muda.
- **Tiles quadrados** (`aspect-square`) e **scroll interno** na moldura (`overflow-y-auto` + `maxHeight:
  100%`): quando há mais botões do que cabem, a moldura rola por dentro (continuam dentro da borda do
  dispositivo, sem transbordar nem crescer a página).
- **`ButtonTile` (modo `fill`)** — a imagem deixa de ter cap fixo de px (`maxHeight: t.icon`) e passa a
  `flex-1 w-full object-contain`, para o ícone **escalar com o tile** (botão maior → ícone maior).

### Alterações
- **`constants.js`** — `COLS_MIN=2`, `COLS_MAX=8`, `escalaPorColunas(cols)`. `COL_OPCOES` fica órfão
  (mantido, inofensivo).
- **`ButtonTile.jsx`** — imagem do modo `fill` passa a `flex-1 min-h-0 w-full object-contain` (sem
  `maxHeight`).
- **`TabelaEditor.jsx`** — import atualizado; `escala`/`handleCols`; **removido** o segmented P/M/G da
  barra superior; **dropdown "Colunas" → slider** (ícones `apps`/`crop_square`); `GridCell` quadrada
  (`aspect-square`); grelha só com `gridTemplateColumns` + `content-start`; moldura com scroll interno;
  `GridCell` recebe `size={escala}`.

### Estado
- `npm run build` (Client) ✓ — sem erros novos (mantém-se o aviso pré-existente `#ff8080; !important`).
- Falta **verificação visual**: arrastar/largar com tiles quadrados, o slider a mudar tamanho/densidade
  em cada dispositivo, e o scroll interno quando há muitos botões.

---

## 2026-06-22 — Editor de tabelas: grelha enche a moldura (sem scroll nem espaço em branco)

### Contexto
A versão anterior (tiles `aspect-square` de tamanho fixo + scroll interno) deixava **espaço em branco**
por baixo da grelha (os quadrados fixos não enchiam a altura da moldura) e o utilizador **não quer
scroll** — o objetivo dos tamanhos variáveis é caber tudo num ecrã. Além disso, no PC os botões ficavam
**demasiado grandes** mesmo no extremo "pequeno" (máx. 8 colunas: `1000/8 ≈ 125px`).

### Decisão
- **A grelha enche sempre a moldura** com `h-full` + `grid-template-rows: repeat(rows, 1fr)` e a moldura
  a `overflow-hidden` → **sem scroll e sem espaço em branco**, para qualquer `rows`.
- **`rows` calculado geometricamente** a partir das colunas e do rácio da moldura
  (`round(cols * aspH / aspW)`), para as células ficarem **~quadradas** ao encher (ex.: PC 16/10 a 8
  colunas → 5 linhas → células `125×125` exatas). Garante-se também `>= ceil((lastFilled+1)/cols)` para
  nunca esconder botões já colocados (se exceder a capacidade, as células comprimem em vez de fazer
  scroll). Removido o `aspect-square` e o `rowsDefault`.
- **Limites de colunas por dispositivo** (`colsMin`/`colsMax` em `DISPOSITIVOS`), com **PC até 14
  colunas** (`1000/14 ≈ 71px`) para permitir botões bem mais pequenos. O slider passa a usar
  `dev.colsMin`/`dev.colsMax` (substitui as constantes globais `COLS_MIN`/`COLS_MAX`, removidas).
- **Compromisso assumido:** encher a moldura tem **prioridade** sobre o quadrado perfeito — as células
  ficam *quase* quadradas em algumas combinações de colunas/rácio. Foi o pedido explícito ("não quero
  scroll nem espaço em branco").

### Alterações
- **`constants.js`** — `DISPOSITIVOS` com `colsMin`/`colsMax` (PC 2–14, tablet 2–10, telemóvel 2–8);
  `rowsDefault` e as constantes `COLS_MIN`/`COLS_MAX` removidas.
- **`TabelaEditor.jsx`** — import sem `COLS_MIN`/`COLS_MAX`; `rows` geométrico (parse do `aspect` para
  `aspW`/`aspH`); `GridCell` volta a `h-full min-h-0` (sai `aspect-square`); slider usa `dev.colsMin/
  colsMax`; moldura `overflow-hidden` + grelha `h-full` com `gridTemplateRows` `1fr`.

### Estado
- `npm run build` (Client) ✓ — sem erros novos (mantém-se o aviso pré-existente `#ff8080; !important`).
- Falta **verificação visual**: confirmar que não há vazio nem scroll em cada dispositivo, e que no PC
  o slider no extremo pequeno dá botões suficientemente pequenos.

---

## 2026-06-22 — Editor de tabelas: espaçamento proporcional (padding/gap em %)

### Contexto
Com botões grandes o espaçamento parecia bem, mas com botões pequenos (slider no extremo) o `gap-3`
(12px) e o `p-1` internos — **fixos em px** — ficavam enormes em proporção (parecia "3/4 padding") numa
célula de ~70px.

### Decisão
Tornar o espaçamento **proporcional ao tamanho da célula**, usando **percentagens** (que o CSS resolve
sempre relativamente à largura do bloco), em vez de px fixos. Assim escala sozinho com o slider, sem
precisar de saber as colunas nem de unidades de container.
- **Espaço entre botões** deixa de ser o `gap` da grelha e passa a vir do **inset da célula**
  (`GridCell` com `padding: 4%`) → gap visível = `2 × 4%` da largura da célula.
- **Padding interno do tile** (`fill`) passa de `p-1` para `padding: 6%`, e o espaço ícone/texto para
  `gap: 4%`.
- **Bezel do dispositivo** passa a constante e menor (`p-3 sm:p-4` → `p-2 sm:p-3`) — é a "borda" física,
  não deve escalar com os botões.

### Alterações
- **`ButtonTile.jsx`** — modo `fill`: remove `gap-1 p-1`, usa `style={{ padding: "6%", gap: "4%" }}`
  (o modo não-`fill` mantém `gap-1 p-1` + `minHeight`).
- **`TabelaEditor.jsx`** — `GridCell` com `style={{ padding: "4%" }}`; grelha sem `gap-3` (`grid h-full`);
  bezel `p-2 sm:p-3`.

### Estado
- `npm run build` (Client) ✓ — sem erros novos (mantém-se o aviso pré-existente `#ff8080; !important`).
- Valores `4%`/`6%` facilmente afináveis. Falta **verificação visual** (botões pequenos vs grandes).

---

## 2026-06-22 — Gerir Tabela: feedback do "Guardar" (Fase 1 da view de Tabelas)

### Contexto
O "Guardar" gravava na tabela **`TabelaLayouts`** (modelo `TabelaLayout`; uma linha por
`(utenteId, dispositivo)`, `config` JSON `{cols,size,cells}`) via `PUT /utentes/:id/tabela/:dispositivo`,
mas no front-end **não havia feedback**: o `onSave` só fazia `setDirty({})`/`setSaving(false)` e **não
tratava erros** (se o `PUT` falhasse, parecia guardado). Primeira fase do plano maior (view "Tabelas" +
templates `TabelaPadrao` — ainda por fazer).

### Decisão
Snackbar M3 leve (sem componente novo), renderizado no `GerirTabela` ao lado do `<TabelaEditor>` (é
`position: fixed`, não precisa de estar dentro do layout do editor). Sucesso = `primary`, erro =
`error`, auto-dismiss em 3s. **No erro mantém-se o `dirty`** (botão "Guardar" continua ativo para repetir).
`mutate` já lança em `!res.ok` ([client.js:26]), por isso o `catch` apanha.

### Alterações — `Client/src/Pages/GerirTabela.jsx`
- Estado `feedback` + `useEffect` de auto-dismiss (3s).
- `onSave` com `try/catch`: sucesso → `{tipo:"ok"}` ("Tabela(s) guardada(s)"); erro → `{tipo:"erro"}`
  sem limpar `dirty`.
- Return embrulhado em fragmento com o snackbar (`fixed bottom-6`).

### Estado
- `npm run build` (Client) ✓ — sem erros novos (aviso CSS `#ff8080; !important` pré-existente).
- Próximas fases (planeadas, não feitas): **Fase 2** — `GET /tabelas` bulk + `TabelaPreview` +
  view de leitura; **Fase 3** — modelo `TabelaPadrao` + editor em modo template + "Aplicar a utente".
  Caveat: `Utente` não tem foto de perfil (usar avatar de inicial por agora).

---

## 2026-06-22 — View "Tabelas" (Fase 2): lista com preview + mini-seletor de dispositivo

### Contexto
Segunda fase do plano da view de Tabelas: uma página de leitura (estilo "Utentes"/"Botões") que mostra,
por utente, uma **pré-visualização** da tabela e permite abrir o editor. Decisões fechadas com o
utilizador: **avatar de inicial** (o `Utente` não tem foto de perfil) e **mini-seletor por card**
(telemóvel/tablet/PC trocam a preview no próprio card).

### Decisão
- **Endpoint bulk `GET /tabelas`** (público, como os outros GET) devolve **todas** as linhas de
  `TabelaLayouts` (`utenteId`, `dispositivo`, `config`). O cliente junta com `utentes`/`botoes` que já
  vêm do `Context` → evita N×3 pedidos e não duplica dados.
- **`TabelaPreview`** reaproveita a lógica de linhas do editor (`round(cols*aspH/aspW)`), read-only,
  espaçamentos em % (escala com o tamanho). Estado vazio = "Sem botões".
- **Mini-seletor por card**: mostra os 3 dispositivos; os sem layout ficam esbatidos mas clicáveis
  (preview "Sem botões"). Default = primeiro com layout. `stopPropagation` para o clique nos ícones não
  navegar.
- Clicar no card → `/gerir-tabela/:id` (abre no dispositivo **default `pc`** do editor; abrir já no
  selecionado fica como follow-up opcional — exigiria passar o device ao `GerirTabela`).
- Sem botão "Novo" aqui — a criação de **templates** é a Fase 3.

### Alterações
- **Backend:** `tabelaController.listarTabelas` (`findAll`); `route.js` → `GET /tabelas` (antes da rota
  `/utentes/:id/tabela/:dispositivo`, sem conflito).
- **Frontend (novos):** `Client/src/Components/tabela/TabelaPreview.jsx`; `Client/src/Pages/TabelasView.jsx`.
- **Frontend (editados):** `api/tabela.js` (`fetchTabelas`); `layout/navItems.js` (item "Tabelas",
  ícone `grid_view`, a seguir a "Botões" → barra inferior mobile passa a 5 itens); `App.jsx` (import +
  rota `/staff/tabelas` protegida por `RequireStaff`).

### Estado
- `npm run build` (Client) ✓ e `node --check` (controller + route) ✓ — sem erros.
- Falta **verificação visual**: a lista, o mini-seletor a trocar o dispositivo, e o clique a abrir o
  editor. Confirmar também que a barra inferior mobile aguenta os 5 itens.

---

## 2026-06-22 — Templates de tabela (Fase 3): modelo `TabelaPadrao`, editor de template e "Aplicar"

### Contexto
Terceira e última fase: criar **tabelas default (templates)** reutilizáveis e aplicá-las a utentes.
Decisões fechadas com o utilizador: **template cobre os 3 dispositivos** (não um por dispositivo) e
**Aplicar substitui** os layouts existentes (com confirmação). Feita em 3 sub-passos.

### Decisão
- **Modelo `TabelaPadrao`** (`{ nome, configs }`, `configs` = `{ smartphone, tablet, pc }`, cada um no
  formato do `TabelaLayout`). Independente do utente (sem `utenteId`) — em vez de reaproveitar
  `TabelaLayout` com sentinela.
- **Editor reutilizado:** `TabelaEditor` ganha só uma prop `titulo` (default "Gerir Tabela"). Novo
  `GerirTemplate` espelha o `GerirTabela`, mas carrega/guarda um template (1 linha com os 3 configs);
  o **nome** define-se na criação/renomear (na view), não dentro do editor.
- **Aplicar = snapshot:** copia o `configs` do template para os `TabelaLayout` do utente (upsert por
  dispositivo), **não** liga — editar o template depois não mexe nas tabelas já aplicadas. Notifica por
  socket (`notificarAlteracaoBD`).
- **UI:** secção "Modelos" na view de Tabelas com `Novo Template` (`window.prompt` → cria vazio → abre
  editor), cards com preview + mini-seletor + Editar/Aplicar/Renomear/Eliminar, e **modal** para escolher
  o utente ao aplicar (confirmação de substituição). `window.prompt`/`confirm` para nomes — sem mais
  componentes.

### Alterações
- **Backend (novos):** `models/TabelaPadrao.js`, `controller/tabelaPadraoController.js`
  (listar/criar/atualizar/eliminar/aplicar).
- **Backend (editados):** `models/index.js` (regista o modelo), `main.js` (`TabelaPadrao.sync()`),
  `routes/route.js` (5 rotas `/tabelas-padrao*`; GET público, escritas com `requireStaff`).
- **Frontend (novos):** `api/tabelasPadrao.js`; `Pages/GerirTemplate.jsx`.
- **Frontend (editados):** `Components/tabela/TabelaEditor.jsx` (prop `titulo`); `App.jsx` (rota
  `/gerir-template/:id`); `Pages/TabelasView.jsx` (secção "Modelos" + modal de aplicar + snackbar;
  `devsComLayout` passou a receber o objeto de configs para servir utentes e templates).

### Estado
- `npm run build` (Client) ✓ e `node --check` (5 ficheiros backend) ✓ — sem erros.
- Falta **verificação visual end-to-end**: criar template → editar layout dos 3 dispositivos → guardar →
  aplicar a um utente → confirmar que a tabela do utente passou a ser a do template. (Tabela
  `TabelaPadroes` criada por `sync()` no 1º arranque do servidor.)
- **Fase 4 (ainda por fazer):** `MainContent` (tabuleiro do utente) ler o `config` guardado em vez do
  layout hardcoded.

---

## 2026-06-22 — Tabuleiro do utente usa a tabela personalizada (Fase 4)

### Contexto
Última fase: o tabuleiro do utente (`MainContent`) passa a renderizar a **tabela personalizada** guardada
(`TabelaLayout`), em vez do layout fixo por categorias. Requisito forte do utilizador: **não partir** a
criação de pedidos, que já funciona. Decisões fechadas: **responsivo** (o layout segue o tamanho do ecrã)
e **SOS dentro da grelha** (sem botão SOS fixo).

### Contexto técnico encontrado
- O tabuleiro antigo mostrava **todos** os `botoes` (globais) agrupados por categoria; o pedido nasce em
  `handleButtonClick` → `postPedido({ emergencia:false, utenteId, botaoId })`. O **SOS** é `id=1`,
  `nome:"SOS"`, `categoria:"SOS"`, com `handleButtonSOS` (toggle de emergência). `Botao` **não** tem campo
  `emergencia` — o SOS identifica-se por nome/categoria.

### Decisão
- **Fallback seguro:** o ramo de render antigo fica **intacto**. Só quando existe layout com células
  (`configAtiva`) é que se renderiza a grelha nova. Sem layout → tabuleiro por categorias como antes.
- **Responsivo:** `tipoDispositivo()` mapeia `window.innerWidth` (<600 telemóvel, <1024 tablet, senão PC),
  com listener de `resize`. Usa o layout do dispositivo detetado; se vazio, o **primeiro** configurado;
  senão `null` → fallback.
- **Carregamento:** `MainContent` busca os 3 layouts do utente (`fetchTabela(id, d)`) no arranque/`id`.
  Enquanto não carrega, `configAtiva` é `null` → mostra o tabuleiro antigo (sem flash de erro, sem partir).
- **Grelha-pedido:** reaproveita o mesmo modelo (`cols` + `cells` row-major); `rows = ceil(filled/cols)`
  a encher o ecrã com `1fr` (sem scroll). Célula com botão → `handleButtonClick`; se for o SOS
  (`categoria==="SOS"||nome==="SOS"`) → `handleButtonSOS` (vermelho). Célula vazia → div em branco.
- **Pedidos inalterados:** mesmos `handleButtonClick`/`handleButtonSOS`/`cancelarTodosPedidos`; controlos
  "Estou Bem"/gaveta/🛠 mantidos num cabeçalho compacto. Modais extraídos para `overlays` (reutilizados no
  ramo novo; o ramo antigo mantém os seus inline).

### Alterações — `Client/src/Pages/MainContent.jsx`
- Imports: `useMemo`, `fetchTabela`, `DISPOSITIVOS`.
- `botaoPorId`; deteção responsiva de `dispositivo` (+resize); fetch dos `configs`; `temCells`/`configAtiva`.
- `overlays` + `renderTabela(config)`; novo ramo de `return` (grelha) **antes** do return existente
  (que fica como fallback, sem alterações).

### Estado
- `npm run build` (Client) ✓ — sem erros novos (aviso CSS `#ff8080; !important` pré-existente).
- Falta **verificação visual end-to-end**: utente com tabela → vê a grelha e cria pedidos (normal + SOS);
  utente sem tabela → mantém o tabuleiro antigo. Confirmar a deteção responsiva no dispositivo real.
- **Follow-up opcional:** atualização **ao vivo** do tabuleiro quando o staff edita/aplica com o utente já
  no ecrã (ligar ao socket / re-fetch); por agora só carrega no arranque/troca de utente.

### Correção (mesmo dia) — linhas do tabuleiro não batiam certo com o editor
Sintoma: um layout 6×4 com 2 botões na 1ª linha aparecia no tabuleiro como **2 células esticadas a toda a
altura** do ecrã. Causa: `renderTabela` calculava `rows = ceil(célulasPreenchidas/cols)` = 1 (só a 1ª linha
tinha conteúdo), enquanto o **editor** usa linhas **geométricas** (`round(cols*aspH/aspW)` = 4 no PC 16/10).
Fix: o tabuleiro passa a usar a **mesma fórmula geométrica** (com o `aspect` do `dispositivoAtivo`), por isso
reproduz o desenho (botões no topo-direito, células vazias em branco) em vez de esticar. Acrescentado
`dispositivoAtivo` (qual dos 3 layouts está a ser mostrado) para ir buscar o `aspect` correto.

### Ajuste (mesmo dia) — células vazias mostram a grelha a tracejado
A pedido do utilizador, as células vazias do tabuleiro do utente deixam de ficar em branco e passam a
mostrar o **recuadro a tracejado**, igual ao editor. Em `MainContent.renderTabela`, a célula vazia
(`if (!b)`) passou de `<div key={i} />` para
`<div className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low" />`
— reutiliza os mesmos tokens M3 do editor, para o aspeto coincidir. `npm run build` (Client) ✓.

---

## 2026-06-22 — Drawer de pedidos: animação de abrir/fechar (a anterior estava partida)

### Contexto
O `RequestListDrawer` (lista de pedidos do utente, aberta pelo ☰) não animava: "saltava" para o ecrã.

### Decisão
A causa era CSS inconsistente: estado fechado em `right: -100%` mas aberto em `left: 0`, e a `transition`
era em `left` indo de `auto → 0` (**não animável**). Trocado para animar por **`transform`** (desliza da
**esquerda**, onde está o ☰) e overlay com **fade** por `opacity`/`pointer-events`. O componente já está
sempre montado e só alterna a classe `open` (do `isOpen`), por isso anima a **abrir e a fechar**.

### Alterações
- **`index.css`** — `.custom-drawer`: `left: 0` + `transform: translateX(-100%)` → `.open { translateX(0) }`,
  `transition: transform 0.3s ease`. `.drawer-overlay`: `opacity: 0` + `pointer-events: none` +
  `transition: opacity 0.3s`; nova regra `.drawer-overlay.open { opacity: 1; pointer-events: auto }`
  (substitui o seletor de irmão `.custom-drawer.open + .drawer-overlay`).
- **`RequestListDrawer.jsx`** — overlay passa a estar **sempre montado** com classe condicional
  (`drawer-overlay ${isOpen ? "open" : ""}`) em vez de `{isOpen && …}`, para o fade poder animar.

### Estado
- `npm run build` (Client) ✓. Falta confirmação visual (abrir/fechar a deslizar + fade do overlay).

---

## 2026-06-22 — Densidade das views de staff (cards mais pequenos, cabem mais)

### Contexto
Os cards das views de staff (Utentes, Botões, Tabelas) estavam grandes e desperdiçavam espaço em ecrãs
largos. Pedido: itens menores para caberem mais por página.

### Decisão
Primeira passagem de densidade (afinável): **mais colunas** nos breakpoints grandes + **menos padding** +
**elemento dominante menor** (avatar/imagem). Em ecrãs grandes: Utentes até **5** col, Botões até **6**,
Tabelas até **4**. As previews das Tabelas encolhem sozinhas com a largura da coluna.

### Alterações
- **`StaffHome.jsx`** — grelha `…xl:grid-cols-4 2xl:grid-cols-5 gap-3`; card `p-4`→`p-3`; avatar
  `w-14 h-14 text-[20px]`→`w-11 h-11 text-[16px]`.
- **`BotoesList.jsx`** — grelha `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6
  gap-3`; imagem `…lg:w-28`→`…lg:w-24` (e `mb-3`→`mb-2`); nome `…lg:text-xl`→`…lg:text-lg`.
- **`TabelasView.jsx`** — ambas as grelhas (Modelos e Utentes) ganham `xl:grid-cols-4` e `gap-3`.

### Estado
- `npm run build` (Client) ✓ (aviso CSS `#ff8080; !important` pré-existente). Valores (colunas/tamanhos)
  fáceis de subir/baixar conforme o gosto após verificação visual.

---

## 2026-06-22 — Cards de template com o fluxo do `ItemMenu` (popover/bottom-sheet)

### Contexto
Os cards de **template** (secção "Modelos" da view de Tabelas) tinham as ações num rodapé (Editar/Aplicar
+ ícones renomear/eliminar). Pedido: mesmo fluxo dos botões — clicar no card abre um **popover** (desktop)
ou **bottom sheet** (telemóvel) com as opções (Editar, Aplicar, Renomear, Eliminar).

### Decisão
- **`ItemMenu` ganhou 2 ações opcionais:** `onAplicar` (ícone `person_add`) e `onRenomear`
  (`drive_file_rename_outline`), entre o "Editar" e o "Eliminar". As já existentes (`onManage`/`onEdit`/
  `onDelete`) ficam iguais; o popover/sheet responsivo é reutilizado tal e qual.
- **Card de template** passou a seguir o padrão da `StaffHome`/`BotoesList`: card clicável que alterna
  `openMenuTpl` (estado no pai) + `ItemMenu` controlado com `boundaryRef`. Removido o rodapé de botões.
  O mini-seletor de dispositivo mantém-se (com `stopPropagation` para não abrir o menu). Só os cards de
  **template** mudaram — os dos utentes ficam como estavam.
- O `overflow-hidden` do card não corta o popover (cabe na altura do card, que tem a preview) e o sheet é
  `position: fixed` (escapa na mesma).

### Alterações
- **`ItemMenu.jsx`** — props `onAplicar`/`onRenomear` + 2 botões em `acoes`.
- **`TabelasView.jsx`** — imports `useRef` + `ItemMenu`; estado `openMenuTpl`/`openTplRef`; card de
  template reescrito (clicável + `ItemMenu`, sem rodapé).

### Estado
- `npm run build` (Client) ✓. Falta verificação visual (popover no desktop + bottom sheet no telemóvel,
  e as 4 ações a funcionar).

---

## 2026-06-22 — Editor de tabelas: tap-to-place (Passo A; pinch-zoom é o Passo B)

### Contexto
Para facilitar a edição no telemóvel (o arrastar é mau no toque), introduzir **clicar-para-selecionar →
clicar-para-colocar**, com a animação pedida (linha tracejada a mexer = "marching ants"). Decidido:
**tap-to-place sempre ativo** (telemóvel + desktop, coexiste com o arrastar). O **pinch-zoom** fica para
o Passo B.

### Decisão
- **Coexiste com o drag** sem trocar de sensor: o `PointerSensor` tem `distance: 6`, por isso um toque
  sem movimento dispara `onClick` (selecionar/colocar) e só um movimento >6px inicia o arrastar.
- **Seleção** num estado `selecionado` = `{tipo:"lib", botaoId}` ou `{tipo:"slot", pos}`. Clicar na
  biblioteca seleciona o botão; clicar numa célula vazia coloca; numa célula cheia troca/substitui;
  clicar num botão colocado (sem seleção) seleciona-o para mover; clicar no mesmo cancela. `onDragStart`
  limpa a seleção. A lógica de `setCells` espelha a do `onDragEnd`.
- **Marching ants:** overlay SVG (`<svg class="ants-svg"><rect/></svg>`) com a geometria/animação em CSS
  (propriedades SVG via CSS: `x/y/width/height/rx` + `stroke-dashoffset` animado). Segue os cantos
  arredondados (`rx:14px`) e a cor `primary` (via `currentColor`).

### Alterações
- **`index.css`** — `.ants-svg` + `.ants-svg rect` + `@keyframes marching-ants`.
- **`TabelaEditor.jsx`** — componente `MarchingAnts`; `LibraryTile`/`GridCell` com `selecionado`+`onSelect`/
  `onCellClick`; estado `selecionado` + `aoSelecionarLib`/`aoClicarCelula`; `onDragStart` limpa seleção;
  props ligadas na grelha e na biblioteca.

### Estado
- `npm run build` (Client) ✓. Falta verificação visual (selecionar/colocar/mover + a animação).
- **Passo B (a seguir):** pinch-zoom (dois dedos) — `MouseSensor`+`TouchSensor` (delay) para separar
  tap/drag/pinch no toque, estado `zoom` + `transform: scale` na moldura com scroll.

### Passo B — pinch-zoom (dois dedos)
- **Separação de gestos:** trocado `PointerSensor` por **`MouseSensor`** (rato, `distance:6`) +
  **`TouchSensor`** (`delay:200`, `tolerance:8`). No toque: tap rápido → colocar (tap-to-place);
  manter premido → arrastar; dois dedos → zoom (o movimento do pinch excede a `tolerance` e **cancela** o
  arrastar). No rato, o arrastar fica como antes.
- **Zoom:** estado `zoom` (1–3) + `zoomRef` (para o handler não depender de re-render). Listeners de
  `touchstart/move/end/cancel` **não-passivos** (via `addEventListener`, para poder `preventDefault`)
  no wrapper da moldura (`frameWrapRef`); a distância entre os 2 dedos define o fator. Aplica-se com
  `transform: scale(zoom)` na moldura.
- **Scroll/pan:** wrapper com `overflow-auto` + `touch-action: pan-x pan-y` (pan com 1 dedo, sem zoom de
  página). Camada intermédia `min-h-full flex justify-center` separa o centrar do scroll (evita o bug
  flex-center+overflow que cortava o topo ao ampliar). Botão **"1:1"** flutuante repõe o zoom (cartão do
  canvas passou a `relative`).

### Estado (Passo B)
- `npm run build` (Client) ✓. Falta **verificação no telemóvel real**: pinch a ampliar/reduzir, pan com
  scroll, e confirmar que tap/long-press/pinch não se atrapalham (sobretudo o tap-to-place após tocar).

---

## 2026-06-22 — Todos os utentes com tabela: template predefinido + backfill (Fase A de 4)

### Contexto
Objetivo (do utilizador): garantir que **todos** os utentes têm tabela ao entrar no tabuleiro, para poder
**remover o tabuleiro antigo por categorias**. Plano em 4 fases: **A** seeder do template "Predefinida"
(converte o tabuleiro antigo para o novo formato) + backfill; **B** criar utente com template obrigatório
(+ corrigir `createUtente` que não devolvia resposta); **C** remover o fallback por categorias no
`MainContent`; **D** renomear para `TabuleiroComunicacao` + rota ofuscada `/t/:token` (fixa por utente).

### Decisão (Fase A)
- **Seeder no arranque** (não migração — o projeto usa `sync()`): `Server/Util/seedDefaults.js`
  - `garantirTemplatePadrao()` — só se **não existir nenhum** `TabelaPadrao`: lê os `Botao` reais,
    agrupa por categoria (ordem `SOS, Sinto-me, Necessidades, Tecnologias, Chamar`, cada secção numa nova
    linha → sobram brancos, aceitável) e cria a "Predefinida" com `configs` para os 3 dispositivos.
  - `backfillTabelas()` — aplica o **primeiro** template aos utentes com **zero** `TabelaLayout` (não
    sobrescreve quem já tem). Idempotente; corre em todos os arranques.
- `main.js` passa a **await** dos `sync()` e depois `seedDefaults()`.

### Alterações
- **Novo:** `Server/Util/seedDefaults.js`.
- **`Server/main.js`** — IIFE async: `await sync()` (StaffAuth/TabelaLayout/TabelaPadrao) + `seedDefaults()`.

### Estado
- `node --check` ✓ nos dois ficheiros. Falta **arrancar o servidor** para confirmar que a "Predefinida" é
  criada (instalação fresca) e que utentes sem tabela ficam com layout. (Na BD atual já há templates → o
  seeder não cria; o backfill aplica o 1º template aos utentes sem tabela.)
- Edge conhecido: instalação 100% nova sem botões semeados → template vazio (editar depois).

---

## 2026-06-22 — Criar utente com template + "Criar do zero" + popup de alterações por guardar (Fase B)

### Contexto
Fase B do plano: ao criar utente, escolher um **template** (dropdown) — ou um botão **"Criar do zero"**
que cria o utente e abre logo o editor da tabela dele. E corrigir o `createUtente` (não devolvia resposta).
O utilizador pediu ainda um **popup de "alterações por guardar"** no editor (Guardar / Descartar / Cancelar).

### Decisão
- **Backend `createUtente`:** lê `nome/quarto/templateId`; cria o utente; se houver `templateId`, copia
  os `configs` do template para os `TabelaLayout` (upsert por dispositivo); **devolve `201` com o utente**
  (antes não enviava resposta — a request ficava pendurada e só funcionava porque o cliente navegava logo).
- **`postUtente`** passou a **devolver o utente criado** (`res.json()`), para o "Criar do zero" obter o id.
- **`UtenteForm`** (partilhado): renderiza o dropdown de templates + botão "Criar do zero" **só** quando
  recebe `templates`/`onCriarNovo` (i.e., no `NewUtente`; o `EditUtente` fica igual).
- **"Criar do zero":** valida nome+quarto, cria o utente **sem** template (tabela vazia) e navega para
  `/gerir-tabela/:id`. Se o staff sair sem guardar, o backfill (Fase A) apanha-o no próximo arranque.
- **Popup de saída (`GerirTabela`):** o "Voltar" passa por `handleVoltar` — se `dirty`, abre modal com
  **Guardar e sair / Descartar e sair / Cancelar**. `onSave` passou a devolver `true/false`; em "Guardar e
  sair" só navega se gravou (em falha mantém-se na página com o snackbar de erro).

### Alterações
- **`Server/controller/utenteController.js`** — import `TabelaPadrao`/`TabelaLayout`; `createUtente` reescrito.
- **`Client/src/ContextProvider.jsx`** — `postUtente` devolve o utente criado.
- **`Client/src/Components/utentes/UtenteForm.jsx`** — props `templates`/`onCriarNovo` + campo do template.
- **`Client/src/Components/utentes/NewUtente.jsx`** — carrega templates, pré-seleciona o 1º, `handleSubmit`
  (com template) + `handleCriarDoZero` (sem template → editor da tabela).
- **`Client/src/Pages/GerirTabela.jsx`** — estado `confirmarSaida` + `handleVoltar`/`guardarESair`/
  `descartarESair`; `onSave` devolve boolean; modal de confirmação.

### Estado
- `node --check` (backend) ✓ e `npm run build` (Client) ✓. Falta verificação visual: criar com template,
  "Criar do zero" → editor, e o popup ao sair com alterações.
- **Falta a Fase C** (remover o tabuleiro antigo por categorias no `MainContent`) e a **Fase D** (renomear
  `TabuleiroComunicacao` + rota ofuscada `/t/:token`).

---

## 2026-06-22 — MainContent só usa a tabela personalizada (Fase C)

### Contexto
Com todos os utentes a terem tabela (Fase A backfill + Fase B criação), o tabuleiro antigo por categorias
ficou redundante. Removido.

### Decisão
- **Um só `return`:** removidos o ramo `if (configAtiva)` + o tabuleiro antigo (renderSection + secções
  Sinto-me/Necessidades/Tecnologias/Chamar + SOS fixos). Agora: cabeçalho (Estou Bem/gaveta/🛠) + conteúdo
  condicional + `overlays`.
- **Conteúdo:** `!carregado` → "A carregar…"; senão `configAtiva` → grelha (`renderTabela`); senão
  **estado "Sem tabela configurada"** (rede de segurança para o caso raro de um utente sem layout).
- Adicionado `carregado` (set após o fetch dos 3 layouts) para **não piscar** o estado "sem tabela"
  durante o carregamento.
- Removidos os consts de categoria (`botoesSintoMe/...Chamar`); **mantido** `SOS_BUTTON` (usado por
  `handleButtonSOS`). Os pedidos (`handleButtonClick`/`handleButtonSOS`) ficam intactos.

### Alterações — `Client/src/Pages/MainContent.jsx`
- Removidos os 4 filtros de categoria e o `renderSection`; estado `carregado`; `return` único com
  carregar/grelha/sem-tabela.

### Estado
- `npm run build` (Client) ✓. Falta verificação visual (utente com tabela → grelha; sem tabela → mensagem).
- **Falta a Fase D:** renomear `MainContent` → `TabuleiroComunicacao` + rota ofuscada `/t/:token` (fixa por
  utente) — a tratar à parte, com o detalhe da ofuscação e o impacto na navegação/PIN/gaiola.

---

## 2026-06-22 — TabuleiroComunicacao + rota ofuscada `/:token` (Fase D — fim do plano)

### Contexto
Renomear o `MainContent` (nome inicial, pouco descritivo) para `TabuleiroComunicacao` e mudar a URL de
`/main/:id` para um `/<número>` fixo e ofuscado por utente — para um curioso com acesso à web não entrar
facilmente, mas o utente não precisar de autenticar (tab fixada que abre direto na sua tabela).

### Decisão
- **Ofuscação (`Client/src/utils/utenteToken.js`):** cifra de **Feistel de 32 bits** (bijeção, reversível
  no cliente). `tokenDoUtente(id)` → string numérica dispersa; `idDoToken(token)` → id. **Não é segurança**
  (a chave está no bundle) — é só dissuasão: o espaço é ~4,3 mil milhões, por isso um número ao acaso quase
  nunca cai num utente real. Token inválido → `NaN` → `setUtenteId(NaN)` ignorado (`if (utenteId)` é falsy)
  → estado "Sem tabela". Confirmado que `setUtenteId` dispara `fetchUtente`+`fetchPedidosUtilizador`, logo
  o **acesso direto por URL** (tab fixada) carrega tudo só com o token.
- **Rota na raiz `/:token`** (colocada no fim): o React Router v6 ordena por especificidade, por isso as
  estáticas (`/login`, `/staff`, `/new-utente`, `/editBotoes`, `/`) ganham; `/:token` só apanha um segmento
  único que não seja nenhuma delas. Alternativa `/t/:token` se houver conflito futuro.
- **Backend inalterado** (continua a usar o id real). Fluxo gaiola/PIN igual; só muda o caminho.

### Alterações
- **Novo:** `Client/src/utils/utenteToken.js`.
- **Renomeado:** `Pages/MainContent.jsx` → `Pages/TabuleiroComunicacao.jsx` (`git mv`); componente e
  `export` renomeados; lê `token` do `useParams` e decodifica (`idDoToken`).
- **`App.jsx`** — import `TabuleiroComunicacao`; rota `/main/:id` → `/:token` (no fim).
- **`StaffHome.jsx`** — `handleOpen` navega para `/" + tokenDoUtente(utente.id)`.
- Órfãos (`AbrirUtente`/`BindUtente`/`UtenteHome`) não tocados (fora do router; ainda referem `/main/`).

### Estado
- `npm run build` (Client) ✓ (sem erros de import → rename ok). **Plano de 4 fases concluído.**
- Falta **verificação visual/funcional**: abrir um utente pela `StaffHome` (URL passa a `/<número>`),
  recarregar nessa URL (carrega o utente direto), token inválido → "Sem tabela", e o PIN/gaiola na nova rota.

---

## 2026-06-22 — Editor de tabelas: eliminar botão por toque (zona de lixo)

### Contexto
Já havia tap-to-place (tocar para selecionar → tocar para colocar). Faltava **eliminar** da mesma forma
(por toque), em vez de só pelo `x` no hover ou arrastar para o lixo.

### Decisão
A `TrashZone` (que só aparecia ao arrastar) passa a aparecer também quando há um **botão colocado
selecionado** (`selecionado.tipo === "slot"`) e fica **clicável**: tocar nela elimina o selecionado.
Continua a ser *droppable* para o arrasto. Estado vazio/lib não mostra o lixo (não há nada a eliminar).

### Alterações — `Client/src/Components/tabela/TabelaEditor.jsx`
- `TrashZone` ganha props `tap` + `onClick` (texto "Toque para eliminar" e estilo `error-container` no
  modo toque; mantém "Arraste/Solte para eliminar" no arrasto).
- Novo `aoEliminarSelecionado` (remove o slot selecionado + limpa a seleção).
- Render: `visible = arrasto || slot selecionado`; `tap = slot selecionado && !arrasto`; `onClick`.

### Estado
- `npm run build` (Client) ✓. Falta verificação visual (selecionar um botão → zona de lixo aparece →
  tocar elimina; o arrasto para o lixo continua a funcionar).

---

## 2026-06-24 — Campo "Categoria" do formulário de botão como dropdown (+ "Nova categoria")

### Contexto
No formulário criar/editar botão (`BotaoForm`), a "Categoria" era um `<input type="text">` com
`<datalist>` — texto livre com sugestões. Pretendia-se um **dropdown** a sério e, dentro dele, um
botão **"Nova categoria"** para acrescentar categorias.

### Decisão
- **Dropdown custom** (`CategoriaDropdown`), não `<select>` nativo: o nativo não permite um botão
  "Nova categoria" no interior nem casa com o tema M3/Tailwind. Fecha ao clicar fora (mesmo padrão do
  `ItemMenu`); reutiliza `animate-pop-in` e o ponto de cor por categoria (`COR_CATEGORIA`, fallback
  cinza para categorias sem cor definida).
- **"Nova categoria"** abre um campo inline (Enter confirma, Esc cancela). Em caso de duplicado
  (case-insensitive) seleciona a existente em vez de criar outra.
- **Lista de categorias deixa de ser fixa.** Em `EditBotoes` passa a ser derivada (`useMemo`):
  conjunto base ∪ categorias **já usadas pelos botões** ∪ as **criadas nesta sessão**
  (`categoriasNovas`). Assim uma categoria nova **reaparece após guardar** o botão (as categorias não
  têm tabela própria — vivem em `botao.categoria`, coerente com o modelo existente).

### Alterações — `Client/src/Components/botoes/`
- **`CategoriaDropdown.jsx`** (novo) — dropdown + criação inline; props `value`/`categorias`/
  `onChange`/`onAddCategoria`.
- **`BotaoForm.jsx`** — substitui o `input`+`datalist` por `<CategoriaDropdown>`; nova prop
  `onAddCategoria`.
- **`EditBotoes.jsx`** — `categoriasDisponiveis` via `useMemo` (base ∪ usadas ∪ novas) em vez de
  `useState` fixo; estado `categoriasNovas` + `handleAddCategoria` (dedup case-insensitive); passa
  `onAddCategoria` ao `BotaoForm`. Import de `useMemo`.

### Notas
- Categoria nova fica cinza na biblioteca até se acrescentar uma cor em `COR_CATEGORIA` (`constants.js`).

### Estado
- `npm run build` (Client) ✓ (mantém só o aviso CSS pré-existente `#ff8080; !important;`).
- Falta verificação visual (abrir dropdown, escolher categoria, criar "Nova categoria" → fica
  selecionada e na lista; editar um botão mostra a categoria atual selecionada).

---

## 2026-06-25 — Redesign do board "Pedidos Pendentes" (3 layouts responsivos: TV / Tablet / Telemóvel)

### Contexto
A `PedidosPendentes.jsx` era um board único a 2 colunas (emergências à esquerda, fila paginada por
setas à direita) com estilo nas classes `.pedidos-*` do `index.css`. Com o Claude Design fizeram-se
mockups novos (`Pedidos Pendentes.dc.html`) com 3 variantes para TV + versões Tablet/Telemóvel. Decisão
do utilizador: **Opção B para PC/TV**, **Opção A para tablet**, **lista de cartões para telemóvel**.

### Decisões
- **Container "burro + layouts" :** `PedidosPendentes.jsx` mantém o que é transversal (estado do
  Context, áudio, teclado) e **escolhe o layout por largura de ecrã**; cada layout é um componente
  presentacional sem lógica. Ficheiros em `Client/src/Components/pedidos/`.
- **Breakpoints** (`useViewportMode`): `<640px` telemóvel · `640–1279px` tablet (Opção A) · `≥1280px`
  TV/PC (Opção B). Um laptop conta como "TV" (board), o que é aceitável.
- **TV/Tablet fluidos (vh/vw/clamp/fr)**, não escala fixa 1920×1080 — escolha do utilizador. Preenchem
  qualquer proporção de ecrã sem scroll; tipografia escala com `clamp(min, vw, max)`.
- **Overflow → rotação automática de páginas** (escolha do utilizador), não setas nem scroll. Hook
  `usePagedRotation(list, pageSize, intervalMs)`: fila/grelha mostram `pageSize` itens e avançam de
  página sozinhas (fila TV 6/8s; grelha tablet 6/8s; emergências 2/7s). Badge "N a aguardar" mostra o
  total e o indicador `página/total`. Com ≤1 página não roda.
- **Ícone = imagem real**, não emoji: o mockup usa emojis, mas a app tem `botao.imagem`
  (fallback `/imagesBotoes/default.png`). Os layouts usam `<img>`.
- **Cores por tempo de espera** (`decorate.js`, paleta do mockup, fiel ao aprovado): emergência
  vermelho; `<5min` verde; `5–11min` âmbar; `>11min` vermelho. `decorate` aproveita a ordem do servidor
  (`emergencia DESC, hora ASC`) — não reordena; `split()` só separa emergências/normais.
- **Navegação:** telemóvel mantém a `StaffBottomNav` (com `paddingBottom` na lista); tablet/TV são
  "boards" full-bleed sem barra (igual ao desktop anterior), com `Esc → /staff`.

### Alterações
**Novos — `Client/src/Components/pedidos/`**
- `decorate.js` — `decorate(pedido, now)` (props visuais + cores) e `split(pedidos, now)`.
- `useViewportMode.js` — `'phone' | 'tablet' | 'tv'` por `window.innerWidth` (listener de resize).
- `usePagedRotation.js` — paginação auto-rotativa (reinicia se a lista encolher; pausa com ≤1 página).
- `PedidosTV.jsx` — Opção B (coluna de emergências 34% + fila), fluido.
- `PedidosTablet.jsx` — Opção A (banner(s) de emergência + grelha `auto-fill minmax`), fluido.
- `PedidosPhone.jsx` — lista de cartões com scroll.

**Reescrito** — `Client/src/Pages/PedidosPendentes.jsx`: container que consome o Context, faz `split`,
mantém áudio/teclado e despacha para o layout consoante `useViewportMode()`.

**`Client/src/index.css`** — removidas as classes `.pedidos-*`/`.pedido-*` (só esta página as usava) e
os 3 retalhos correspondentes na media query `max-width:768px`; ficam só as `@keyframes`
`emgFlash`/`emgBorder`/`bell` (usadas inline pelos layouts). Removeu também a linha com o aviso CSS
pré-existente `#ff8080; !important;` (vivia no `.Pedido-Emergencia`).

### Nota de comportamento — áudio
O `useEffect` do alarme passou a depender de `[pedidosPendentes]` (antes corria a **cada render**, o que
fazia o sino tocar repetidamente). Agora: `warning` em loop enquanto houver emergência; senão o sino toca
quando a lista muda (chega pedido novo). É uma melhoria, não uma regressão.

### Estado
- [x] `decorate`/`split`, `useViewportMode`, `usePagedRotation`
- [x] Layouts TV (Opção B) / Tablet (Opção A) / Telemóvel
- [x] Container reescrito (áudio + `Esc` preservados; `StaffBottomNav` só no telemóvel)
- [x] `index.css` limpo (classes antigas removidas; keyframes mantidas) — sem o aviso `#ff8080`
- [x] `npm run build` (Client) ✓
- [ ] Verificação visual em runtime nos 3 tamanhos (emergência a piscar + som; rotação de páginas com
  muitos pedidos; fallback de imagem; redimensionar a janela troca de layout)

### Update (mesmo dia) — tablet passa a usar o layout do telemóvel (Opção A descartada)
A pedido do utilizador, o **tablet** deixa de ter layout próprio e passa a usar **a mesma lista de
cartões do telemóvel**. Agora só há **dois** layouts efetivos: o board (Opção B) na TV/PC (`≥1280px`)
e a lista de cartões em tudo abaixo disso.
- **`PedidosPendentes.jsx`** — `mode === "tv"` → `PedidosTV`; caso contrário (tablet **e** telemóvel)
  → `PedidosPhone` + `StaffBottomNav`.
- **`PedidosTablet.jsx`** — **removido** (sem uso).
- **`useViewportMode.js`** — mantém os 3 valores (descreve a viewport), mas o comentário nota que
  'phone' e 'tablet' são tratados igual; fica reutilizável caso se queira voltar a diferenciar.
- `npm run build` (Client) ✓.
- Nota: a `StaffBottomNav` é `md:hidden` (Tailwind, <768px) → em tablets 768–1279px a lista mostra-se
  mas sem a barra inferior (o `paddingBottom:88` da lista deixa um espaço em baixo). Se se quiser a barra
  também aí, é preciso mexer no breakpoint da `StaffBottomNav` (partilhada com as outras páginas).

### Update (mesmo dia) — ícones maiores nos cartões/board
A imagem dentro da caixa do ícone ocupava ~62–64% (muita margem). Subiu para **85%** mantendo
`objectFit: contain` (sem distorção): `PedidosTV.jsx` (emergência + fila) e `PedidosPhone.jsx` (cartões).
Só mudou a imagem — o tamanho da caixa/cartão é o mesmo. `npm run build` ✓.

---

## 2026-06-25 — PIN do staff também pelo teclado físico (não só pelo rato)

### Contexto
O PIN do staff só se podia introduzir **clicando** nos botões do `Keypad` (rato/toque). Num PC com
teclado isso é lento; pretendia-se poder **digitar** o PIN diretamente no teclado.

### Decisão
Adicionar o suporte de teclado **dentro do próprio `Keypad`** (componente partilhado), não em cada
ecrã. Assim os **três** consumidores ganham de uma vez e sem duplicação: `StaffLogin` (definir/login),
`ChangePassword` (alterar) e `PinPrompt` (sair da gaiola). O teclado físico chama **os mesmos handlers**
dos botões (`onDigit`/`onDelete`/`onConfirm`), por isso herda automaticamente o limite de 8 dígitos e a
lógica de cada pai — clicar e digitar ficam 100% equivalentes.

### Alterações — `Client/src/Components/Keypad.jsx`
- `useEffect` com listener global de `keydown`:
  - `0-9` (teclado normal **e** numpad chegam como `e.key` "0".."9") → `onDigit(Number(e.key))`.
  - `Backspace` → `onDelete` (com `preventDefault` para não disparar o "voltar" do browser).
  - `Enter` → `onConfirm`.
- Guardas: ignora se `Ctrl/Alt/Meta` estiverem premidos e se houver um `input`/`textarea`/
  `contenteditable` focado (defensivo — estes ecrãs não têm campos, mas evita surpresas).
- Os handlers mais recentes são lidos via `useRef` (atualizado a cada render) para o listener ficar
  estável (anexado uma só vez), apesar de as props mudarem de identidade.

### Notas
- Só há **um** `Keypad` montado de cada vez (ecrã de bloqueio / alterar password / modal de PIN), logo
  o listener global não colide entre instâncias.
- Os botões do rato continuam exatamente iguais (apresentação inalterada).

### Estado
- [x] Teclado físico (0-9 / Backspace / Enter) no `Keypad` → cobre login, alterar password e `PinPrompt`
- [x] `npm run build` (Client) ✓
- [ ] Verificação visual: digitar o PIN no teclado nos 3 ecrãs (definir, login, modal de saída)

---

## 2026-06-25 — Tabuleiro do utente: usável em retrato e paisagem (força paisagem por rotação)

### Contexto
A tabela do utente (`TabuleiroComunicacao`) é desenhada **em paisagem** (uma config por dispositivo).
Em **retrato** num telemóvel (S25 Ultra), a grelha mantinha as colunas da paisagem espremidas na largura
→ botões **altos e finos** (esticados). Além disso, a deteção de dispositivo era **só por largura**
(`w<600 / <1024`), por isso **rodar** o ecrã mudava de modelo (e carregava outra config, muitas vezes
vazia → "Sem tabela").

### Decisão (escolha do utilizador)
"Manter o layout e rodar os botões" → **rodar o quadro INTEIRO 90°** em retrato para o utente usar o
aparelho **deitado** (paisagem). Mantém o desenho exato e botões grandes; o conteúdo fica de lado (é o
objetivo: aparelho montado/usado virado). Entre as variantes oferecidas, o utilizador escolheu rodar
tudo (conteúdo incluído), não só o arranjo.

### Alterações — `Client/src/Pages/TabuleiroComunicacao.jsx`
- **Deteção estável à rotação:** `dispositivo` passa a derivar do **lado mais curto**
  (`Math.min(w,h)`) com os mesmos limiares (600/1024) → um telemóvel é sempre "smartphone" e um tablet
  sempre "tablet", em pé ou deitado. Novo estado `vp` ({w,h}) atualizado em `resize` **e**
  `orientationchange` (substitui o `tipoDispositivo`/`setDispositivo` antigos).
- **Rotação:** `portrait = vp.h > vp.w && dispositivo !== "pc"`. Quando `portrait`, o componente é
  envolvido numa moldura `position: fixed` de tamanho **trocado** (`width:100vh; height:100vw`) com
  `transform: rotate(90deg) translateY(-100vw)` e `transform-origin: top left` → enche o ecrã como
  paisagem. O container interno passou de `height:100vh` para `height:100%` (segue a moldura). Em
  paisagem/PC a moldura é normal (`100vw×100vh`).
- O cálculo de linhas (`renderTabela`, geométrico pelo `aspect` do dispositivo) **não mudou** — a
  moldura rodada já é paisagem, por isso reproduz o desenho do editor.

### Overlays (acompanham a rotação)
Dentro de um ancestral com `transform`, os `position: fixed` passam a ser relativos à **moldura rodada**,
mas `vh/vw` continuam a apontar para o viewport não rodado. Por isso:
- **`SuccessModal.jsx`** — deixou de ser `Modal` do Ant (que faz **portal para o `body`** e escaparia à
  rotação) e passou a um overlay simples in-tree (`position: fixed; inset:0`) → roda com o quadro.
  (Só era usado no tabuleiro.)
- **`index.css`** — overrides scoped à moldura: `.tab-rot .custom-drawer { height:100% }` e
  `.tab-rot .login-screen { min-height:100% }` (trocam o `100vh` por `100%` só quando rodado; fora da
  moldura, StaffLogin/ChangePassword mantêm `100vh`). A gaveta e o PIN usam `inset:0`/translate → já
  ficam corretos na moldura.

### Notas
- **Sentido da rotação:** está `rotate(90deg)`. Se o utente tiver de virar o aparelho para o lado
  "errado", troca-se trivialmente para `rotate(-90deg)` (com o translate ajustado).
- A rotação **não** se aplica a "pc" (um monitor em janela alta não roda).
- Quando o aparelho é fisicamente rodado para paisagem (auto-rotate do SO), `portrait` fica `false` e o
  quadro mostra paisagem **nativa** — ou seja, o quadro está **sempre** em paisagem.

### Estado
- [x] Deteção de dispositivo estável à rotação (lado mais curto)
- [x] Rotação do quadro inteiro 90° em retrato (tablet/telemóvel)
- [x] Overlays acompanham a rotação (`SuccessModal` in-tree + overrides `.tab-rot`)
- [x] `npm run build` (Client) ✓
- [ ] Verificação visual no telemóvel/tablet: retrato roda para paisagem com botões grandes; gaveta de
  pedidos, modal de sucesso e PIN corretos; confirmar o **sentido** da rotação

### Update (mesmo dia) — trocar rotação da página inteira por remapeamento da grelha (controlos no topo, botões a prumo)
A rotação de **toda** a página punha os controlos (☰ / "Estou Bem" / 🛠) de lado e os botões deitados.
Pedido do utilizador: **controlos no topo** (a direito), **mesmo arranjo** que enche o ecrã, mas **botões
legíveis na vertical**. Solução mais limpa: deixar de rodar a página e, em retrato, **rodar só o
ARRANJO** da grelha (remapear as células 90° no sentido horário) mantendo os botões a prumo.
- **`TabuleiroComunicacao.jsx`** — removida a moldura `transform: rotate(90deg)`; volta a um único
  container `height:100vh` (controlos no topo, overlays normais). Em `renderTabela`, quando `portrait`,
  a grelha passa a `gCols = rowsL` (linhas da paisagem) × `gRows = cols` e as células são remapeadas
  `gCells[i*gCols+j] = cells[(rowsL-1-j)*cols + i]` (rotação 90° CW das posições) — mesmo arranjo que se
  via, mas com tiles direitos. Em paisagem/PC nada muda. `portrait`/`vp`/deteção pelo lado mais curto
  mantêm-se.
- **`SuccessModal.jsx`** — revertido para o `Modal` do Ant (já não é preciso o overlay in-tree, porque
  a página deixou de rodar).
- **`index.css`** — removidos os overrides `.tab-rot` (já não há moldura rodada).
- `npm run build` (Client) ✓.
- Nota: assumi "percetíveis verticalmente" = **botões a prumo/legíveis** (não conteúdo deitado). Se a
  intenção era o conteúdo de cada botão rodado de lado, é uma linha a acrescentar (rotate ao tile).
- Nota: o **sentido** do remap é 90° CW (igual ao que se via). Se ficar ao contrário do desejado,
  troca-se a fórmula para `cells[j*cols + (cols-1-i)]` (CCW).

---

## 2026-06-29 — Som das notificações só ao adicionar + foco visual no nome do utente

### Contexto
Duas afinações na vista de **Pedidos Pendentes** (TV/PC, tablet e telemóvel), pedidas para reduzir
confusão do staff:
1. **Som.** O sino tocava a **cada** atualização da lista — tanto ao **adicionar** como ao
   **retirar/cancelar** um pedido. Como a lista é re-obtida por completo a cada evento `bd_alterado`
   (socket), qualquer mudança fazia `pedidosPendentes.length > 0` continuar verdadeiro e o sino tocava
   outra vez. Resultado: campainha a tocar quando o staff **conclui** um pedido — ruído enganador.
2. **Foco visual.** O destaque principal de cada cartão era o **quarto** (tipografia grande) e o **nome**
   ficava em legenda. O staff reconhece os utentes pelo **nome**, não pelo número do quarto → inverter a
   hierarquia.

### Decisão
**1. Som — detetar pedido novo por IDs, não por comprimento.**
Em vez de comparar `length` (a abordagem do plano), guarda-se o **conjunto de ids** da renderização
anterior num `useRef` e toca-se o sino só quando aparece **um id que ainda não existia**.
- *Porquê ids e não comprimento:* se num mesmo refetch **sai um** pedido e **entra outro**, o comprimento
  não muda — a comparação por comprimento **não tocaria** para o pedido genuinamente novo. A comparação
  por ids deteta sempre a entrada, e nunca toca em remoções (o conjunto só perde ids). É estritamente
  mais correto para o requisito "tocar **apenas** ao adicionar".
- *Emergência inalterada:* o `Warning-alarm-tone.mp3` continua em **loop** enquanto existir emergência;
  tem prioridade sobre o sino, exatamente como antes.
- *No primeiro carregamento* (ref a vazio), se já houver pedidos em espera ao abrir a vista, todos contam
  como novos → o sino toca uma vez. Comportamento equivalente ao anterior (que tocava com `length > 0`).

**2. Foco — nome em destaque, quarto como legenda.**
Inversão da hierarquia tipográfica nos **3 layouts** (consistência). O quarto passa a legenda com prefixo
`🚪` por baixo do nome; a mensagem do botão (`label`) mantém-se a seguir. O nome leva
`title={r.nome}` + `text-overflow: ellipsis` para nomes longos (ver risco de truncamento no plano).

### Alterações
**`Client/src/Pages/PedidosPendentes.jsx`** (correção do som)
- Novo ref `prevIdsRef = useRef(new Set())` (junto a `bellRef`/`warningRef`).
- No `useEffect([pedidosPendentes])`: calcula `idsAtuais` + `houvePedidoNovo` (algum id atual que não
  estava no `prevIdsRef`); o sino só toca se `houvePedidoNovo` (no ramo sem emergência). No fim,
  `prevIdsRef.current = new Set(idsAtuais)` para a próxima comparação. Cleanup do warning inalterado.

**`Client/src/Components/pedidos/PedidosTV.jsx`** (foco no nome — vista PC/TV)
- *Fila normal:* removido o bloco de largura fixa que mostrava `r.quarto` em grande. O bloco flexível
  passa a: **nome** `900 clamp(24px,2.4vw,44px)` (com `title` + ellipsis) → `🚪 quarto`
  `700 clamp(13px,1.2vw,22px)` → `label` (mensagem). O selo de tempo (`r.ago`) mantém-se.
- *Coluna de emergências:* a linha `{e.quarto} · {e.nome}` passou a duas linhas — **nome** em destaque
  (`900 clamp(24px,2.3vw,44px)`, `#7f1d1d`) e `🚪 quarto` por baixo (`#991b1b`).

**`Client/src/Components/pedidos/PedidosPhone.jsx`** (foco no nome — telemóvel/tablet)
- O cartão passou a liderar com o **nome** (`800 18px`, `r.titleColor`, com `title` + ellipsis), depois
  `🚪 quarto` (legenda), depois a `label` (mensagem) e por fim `r.ago`. Antes o título era a `label` e o
  `quarto · nome` vinha numa linha só.

> `decorate.js` **não** foi tocado — já expõe `nome` e `quarto` em separado; foi só reordenar a
> apresentação nos layouts.

### Teste
- `cd Client && npm run build` → **OK** (`✓ built in 10.47s`). Mantém-se apenas o aviso pré-existente de
  chunk > 500 kB (não relacionado).
- Falta **verificação visual em runtime** (arrancar Server + Client):
  - Som: adicionar pedido → sino toca **uma vez**; concluir/cancelar pedido → **silêncio**; emergência →
    warning em loop; entrada simultânea de um e saída de outro → sino toca para o novo.
  - Foco: confirmar nome em destaque e quarto em legenda nos 3 tamanhos de ecrã; nomes longos cortam com
    reticências sem partir o layout.

### Estado
- [x] Som: deteção por ids (`prevIdsRef`) — toca só ao adicionar; remoções não tocam
- [x] Emergência (warning em loop) preservada
- [x] Foco no nome (quarto → legenda) em PedidosTV (fila + emergências)
- [x] Foco no nome em PedidosPhone
- [x] `npm run build` (Client) ✓
- [ ] Verificação visual em runtime (som + 3 layouts)
- [ ] (Adiado) Categorização por cores no editor — tarefa 3 do plano `plano-implementacao.html`

---

## 2026-06-29 — Resolver (concluir) pedidos a partir da própria vista de Pedidos Pendentes

### Contexto
A vista de Pedidos Pendentes (board TV/PC + telemóvel) era **só de leitura**: mostrava os pedidos mas o
staff não os podia resolver ali — tinha de ir ao tabuleiro do utente / gaveta. Pedido: **concluir o
pedido na própria vista**.

### Decisão
- **Resolver = marcar como `"concluido"`** (`updatePedido(pedido, "concluido")`), **não eliminar**.
  - *Porquê concluir e não `DELETE`:* preserva o histórico e é exatamente o que o utente já faz no
    `RequestListDrawer` (botão ✔️). O servidor lista pendentes com `where: { estado: 'pendente' }`
    (`pedidoController.getPedidosAtivosPorEmergencia`), por isso ao concluir o pedido **sai da lista
    sozinho**. Reutiliza a rota **aberta** `PUT /pedidos/:id` (a mesma do utente) → sem fricção de auth
    (a vista já está atrás do `RequireStaff`, mas a ação não depende disso).
- **Pedido ORIGINAL, não o decorado.** O handler procura o pedido em `pedidosPendentes` pelo `id` antes
  de chamar `updatePedido`, porque `decorate.js` deita fora campos do pedido. `updatePedido` espalha o
  objeto no body (`{ ...pedido, estado }`); o `Pedido.update` do Sequelize ignora as chaves que não são
  colunas (ex. `botao`, `utente` do include) — é o mesmo padrão já em produção na gaveta.
- **Confirmação** (`window.confirm`, idioma já usado no projeto) com o nome do utente, para evitar
  cliques acidentais no board que **roda páginas sozinho** (7–8 s).
- **Ambas as vistas** (board TV + telemóvel) e também os cartões de **emergência**.
- **Sem update otimista** — depois de concluir, o servidor emite `bd_alterado` (socket) → todos os
  clientes refazem o fetch e o pedido cai da lista. Mesmo fluxo dos restantes mutadores.
- Interação com o **som** (entrada anterior): concluir **encolhe** a lista (id removido) e a nova lógica
  do sino só toca em **ids novos** → resolver **não** dispara o sino. ✓

### Alterações — `Client/src/`
- **`Pages/PedidosPendentes.jsx`** — `updatePedido` do Context; novo `handleResolver(id)` (procura o
  original → `window.confirm` → `updatePedido(pedido, "concluido")`); passa `onResolver={handleResolver}`
  a `PedidosTV` e `PedidosPhone`.
- **`Components/pedidos/PedidosTV.jsx`** — assinatura recebe `onResolver`; botão verde **✔ Concluir** no
  cartão de emergência e **✔** no cartão da fila (a seguir ao selo de tempo).
- **`Components/pedidos/PedidosPhone.jsx`** — assinatura recebe `onResolver`; botão **✔** (46×46) no fim
  de cada cartão.

> `api/pedidos.js`, `ContextProvider.updatePedido` e o servidor **não** foram tocados — a operação já
> existia (usada pela gaveta do utente); só passou a estar disponível no board.

### Teste
- `cd Client && npm run build` → **OK** (mantém apenas o aviso pré-existente de chunk > 500 kB).
- Falta **verificação visual em runtime**: clicar ✔ num pedido normal e numa emergência (board e
  telemóvel) → confirma → o cartão desaparece da lista em todos os dispositivos; cancelar o `confirm` não
  faz nada; o sino não toca ao concluir.

### Estado
- [x] `handleResolver` (concluir o pedido original, com confirmação) em `PedidosPendentes`
- [x] Botão ✔ no board (fila + emergências) e no telemóvel
- [x] Reutiliza `updatePedido`/`PUT /pedidos/:id` (sem mudanças no servidor)
- [x] `npm run build` (Client) ✓
- [ ] Verificação visual em runtime (concluir em board + telemóvel; confirmar/cancelar; som silencioso)

---

## 2026-07-03 — Migração SQLite → MariaDB (Fase 2: código, testado localmente)

### Contexto — porque saímos do SQLite

Sintoma: `sqlite3` (módulo nativo N-API) provoca **SEGV reprodutível** na Raspberry Pi 500 de
produção — userspace **armhf 32-bit** sobre kernel **aarch64**, SoC BCM2712.

Causa raiz confirmada por backtrace `gdb` → `napi_module_register_by_symbol`. Só se chegou aqui
depois de **eliminar sete hipóteses** com evidência real, por ordem:

- **Arquitetura do processo** — não era só "32 vs 64"; o crash mantinha-se com o Node certo.
- **Versão do Node** — testadas várias; SEGV persiste (não é regressão de versão).
- **Versão do `sqlite3`** — downgrades/upgrades do pacote não resolvem.
- **Binário corrompido** — rebuild limpo do módulo nativo → mesmo crash.
- **`libarmmem` do sistema** — descartada como origem.
- **Cache de ABI** — limpa; sem efeito.
- **Conflito de PATH do nvm** — o Node v22 do nvm mascarava `/usr/local/bin/node`; corrigido
  usando **sempre caminho absoluto** do node/npm na Pi. Não era a causa do SEGV, mas contaminava
  o diagnóstico.

Decisão: **abandonar `sqlite3`** e migrar para **MariaDB**. O driver é JavaScript puro (sem binário
nativo), logo elimina de raiz esta classe de bug de arquitetura.

### O que NÃO era o problema (para não reabrir)
Versão do Node · versão do `sqlite3` · binário corrompido · `libarmmem` · cache de ABI · PATH do nvm.
Todos eliminados com evidência. **Não reabrir esta investigação.**

### Alterações de código (Fase 2)

- **`config/database.js`** — deixa de instanciar `sqlite` diretamente; passa a ler de `config/config.js`
  (fonte única de credenciais), por `NODE_ENV`.
- **`config/config.js`** (novo, substitui `config/config.json`) — lê `.env` via `dotenv`; dialeto
  MariaDB; `charset/collate` utf8mb4.
- **`.sequelizerc`** (novo) — aponta o `sequelize-cli` para `config/config.js` + pastas models/migrations/seeders.
- **`.env` / `.env.example`** — credenciais fora do repo (`.env` no `.gitignore`).
- **`package.json`** — removidos `sqlite` e `sqlite3` (fonte do SEGV); adicionado `dotenv`.
- **Migrations corrigidas** (bugs que o SQLite mascarava — ver abaixo).

### Dois bugs de schema que o SQLite escondia (apanhados por teste real)

1. **`imagem` NOT NULL vs model `allowNull:true`** — a migration `create-botoes` tinha
   `imagem: allowNull:false`, mas o model (e a feature de apagar imagem, que faz *nullify*) exige
   nullable. Em MariaDB, criar botão sem imagem → `ER_BAD_NULL_ERROR`. Corrigido para `allowNull:true`.
2. **`UtenteBotoes` sem `updatedAt`** — o `belongsToMany({ through:"UtenteBotoes" })` usa
   `timestamps:true` (espera `createdAt` **e** `updatedAt`), mas a migration só criava `createdAt`.
   Carregar os botões de um utente → `Unknown column 'updatedAt'`. Adicionada a coluna.

> Ambos "funcionavam" no SQLite porque a BD tinha sido criada por `sync()` (que gera o schema a partir
> dos models); ao passar a criar por **migrations**, a divergência migration↔model veio ao de cima.
> Numa instalação de raiz (a Pi) teriam rebentado. Este é o valor de testar contra a BD real, não "no papel".

### Driver: `mariadb`, não `mysql2` (mudança face ao plano inicial)

Com `dialect:'mysql'` + `mysql2` contra um servidor **MariaDB**, as colunas `JSON` (TabelaLayout.config,
TabelaPadrao.configs) voltam como **string** — o MariaDB guarda JSON como `LONGTEXT` e o dialeto mysql
do Sequelize não faz `JSON.parse` na leitura. Isto partia todo o tabuleiro (o cliente faz `config.cells`,
`configs[dispositivo]`) e o `seedDefaults`.

Correção: `dialect:'mariadb'` + conector oficial **`mariadb`** (também **JS puro / ARM-safe**, portanto
mantém a razão original de fugir a binários nativos). `mysql2` removido. JSON passa a fazer parse
automático. Confirmado por `res.json()` real: `"configs":{"smartphone":{...}}` (objeto, não string).

### Teste local (MariaDB 12.3.2, Windows) — output real

- `npx sequelize-cli db:migrate` → 4 migrations OK, tabelas InnoDB + utf8mb4, ENUM/BOOLEAN/FK nativos.
- Arranque do servidor → `sync()` das 3 tabelas auxiliares + `seedDefaults` OK.
- CRUD por model (create+read): Utente (acentos utf8mb4 intactos), Botao (`imagem` null), N:N
  UtenteBotoes, Pedido (ENUM+BOOLEAN+FK+join), TabelaLayout/TabelaPadrao (**JSON round-trip = objeto**).
- `GET /tabelas-padrao` via HTTP → `configs` como objeto aninhado. ✅

### Estado
- [x] Código migrado para MariaDB e **testado localmente** contra MariaDB 12.3.2 (x86_64 Windows).
- [x] Dois bugs de schema (migration↔model) corrigidos.
- [x] Driver `mariadb` (JS puro) — JSON round-trip resolvido.
- [ ] **Validação final em produção (Pi, ARM32) — PENDENTE** (Fase 3). A Pi usará o MariaDB da distro
      (Raspberry Pi OS bookworm = **10.11 LTS**), não 12.3 — ver nota armhf abaixo.
- [x] `install.sh` da Pi (TAREFA 2) — criado na raiz do repo (`bash -n` OK; valida-se na Pi, não corre no Windows).
- [ ] Kiosk mode (Fase 4) — só depois da Fase 3 limpa.

### `install.sh` (TAREFA 2) — decisões
- **Versão do MariaDB NÃO fixada em 12.3 na Pi.** Os repositórios oficiais do MariaDB (incl. 12.3) só
  publicam para arm64/amd64, **não para armhf 32-bit**. Usa-se o `mariadb-server` da distro (Raspberry
  Pi OS bookworm = **10.11 LTS**). Compatível: JSON + conector `mariadb` funcionam desde a 10.5+. O
  script imprime a versão instalada para confirmação manual.
- **Idempotente:** `CREATE ... IF NOT EXISTS`, reutiliza a password do `.env` se já existir.
- **Password gerada** (`openssl rand`), nunca hardcoded; escrita em `Server/.env` (600), lida pela app via dotenv.
- **Node ≥20 procurado e VALIDADO, não um caminho fixo.** Ver "Bug real na Pi" abaixo — `/usr/local/bin/node`
  fixo era, ele próprio, uma versão antiga. O script agora corre `find_node()`, que testa candidatos
  (`/usr/local/bin/node`, `$PATH`, todas as versões nvm de `SERVICE_USER`) e só aceita o primeiro com
  major ≥20; nunca assume que um caminho "absoluto" tem a versão certa.
- Utilizador da BD criado para `127.0.0.1` (app liga por TCP) **e** `localhost` (CLI) — evita o mismatch
  clássico entre `user@localhost` e ligação TCP no Linux.
- Serviço systemd `inov-lar` (arranca no boot, `After/Requires=mariadb.service`).
- **`.gitattributes`** novo: força LF em `*.sh` (CRLF do Windows parte o shebang na Pi).
- **Não** instala nem remove `sqlite3` (já não existe no projeto).
- **Migrations sem `npx`.** O `npx-cli.js` relança um novo processo `node` via `$PATH` — reapanharia o
  Node v22 do nvm, derrotando o caminho absoluto (a estratégia que funcionou para `npm-cli.js` **não**
  se generaliza ao `npx`). Por isso `sequelize-cli` passou a **dependência** do projeto e o script
  chama o binário direto: `"$NODE_BIN" node_modules/sequelize-cli/lib/sequelize db:migrate`. Verificado
  localmente com `db:migrate:status` (as 4 migrations `up`, lidas da `SequelizeMeta` no MariaDB).

### Bug real na Pi (2026-07-03) — `/usr/local/bin/node` era Node 18, mariadb exige ≥20

Primeira corrida real do `install.sh` na Pi: `mariadb-server` instalado OK (10.11.3), BD/user OK, `npm
install`/build do Client OK — mas as migrations falharam: `please upgrade node: mariadb requires at
least version 20.0.0`.

**Causa:** `NODE_BIN="/usr/local/bin/node"` estava fixo no script (lição anterior sobre PATH/nvm), mas
esse caminho é um **symlink para uma instalação manual do Node v18.20.5** — nunca se verificou a
*versão* desse caminho "absoluto", só se assumiu que "absoluto" implicava "correto". Entretanto o
utilizador da Pi tem **Node v22.23.1 instalado via nvm** (`~/.nvm/versions/node/v22.23.1/`), que
satisfaz o requisito — só não estava a ser usado porque o script apontava para outro sítio.

**Correção:** substituída a atribuição fixa por `find_node()` — testa `/usr/local/bin/node`, o `node`
do `$PATH`, e todas as versões nvm de `SERVICE_USER` (da mais recente para a mais antiga via `sort
-Vr`), e só aceita o primeiro cujo `major` seja ≥20 (`NODE_MIN_MAJOR`). Se nada qualificar, o script
para com mensagem clara em vez de falhar a meio das migrations. Lógica testada localmente (Windows)
com binários `node` falsos a simular o layout da Pi: encontra corretamente o v22 e ignora o v18;
recusa-se a escolher quando só há v18 disponível.

**Lição:** "caminho absoluto" resolve *ambiguidade de PATH*, não garante *versão suficiente*. Quando a
dependência importa a versão (aqui, `engines.node >=20` do pacote `mariadb`), o script tem de validar,
não assumir.

### Validação na Pi (Fase 3) — agora via `install.sh`
O `install.sh` automatiza a instalação do MariaDB, criação da BD/utilizador (password gerada),
dependências, build do Client, migrations e o serviço systemd. Na Pi:
```bash
# código já copiado para /opt/inov-lar; node/npm em /usr/local/bin (caminho absoluto)
cd /opt/inov-lar
sudo bash install.sh
mariadb --version                              # CONFIRMAR o major instalado (distro = 10.11 LTS; não 12.3)
curl -v http://localhost:3000                  # app a responder?
sudo journalctl -u inov-lar -n 30 --no-pager   # logs do serviço
```
Depois de "curl" e "journalctl" limpos, validar a app (criar botão sem imagem, abrir o tabuleiro de
um utente, guardar um layout — os 3 casos que exercitam os bugs corrigidos + o round-trip JSON).

### Fase 3 — SUCESSO (2026-07-03), com correção de Node aplicada

Corrida do `install.sh` já com o `find_node()` (ver secção acima): encontrou e usou o Node v22.23.1 via
nvm (`/home/informatica/.nvm/versions/node/v22.23.1/bin/node`), não o v18 de `/usr/local/bin/node`.
Resultado:
- `mariadb-server` 10.11.3 (distro) — já presente, `systemctl enable --now` OK.
- BD `inovlar` + user `inovlar_app` criados, password gerada, `.env` escrito.
- `npm install` (Server + Client) e `vite build` OK.
- **As 4 migrations correram e ficaram `migrated`** — antes falhavam com "please upgrade node".
- Serviço systemd `inov-lar` instalado e **ativo** (`Main PID` a correr `node` do nvm v22).
- `curl http://localhost:3000` → **200 OK**, HTML completo da SPA servido.

**Nota sobre o `journalctl` mostrar SEGV:** as entradas `code=killed, status=11/SEGV` com restart
counter a chegar a 2417 são de uma unidade systemd **anterior a esta sessão** (descrição antiga
"Inov-LAR Server", distinta da atual "InovLAR (Express + Socket.io + MariaDB)") — resíduo de uma
instalação prévia presa num ciclo de crash-loop há muito tempo, provavelmente ainda ligada ao
`sqlite3` original. O `install.sh` sobrescreveu o `.service` e fez `daemon-reload`+`restart`; a partir
da entrada `Started inov-lar.service - InovLAR (Express + Socket.io + MariaDB)` às 14:47:31 não há mais
crashes. Não é uma regressão — é histórico antigo no mesmo ficheiro de log. Opcional para limpar o
contador: `sudo systemctl reset-failed inov-lar`.

### Bug real na Pi (2026-07-03) — `install.sh` corria migrations mas nunca os seeders

Depois do serviço ficar ativo, faltavam os 43 botões predefinidos e o template "Predefinida" ficou
vazio. Causa: o script só chamava `db:migrate`, nunca `db:seed:all` (`Server/seeders/20250506190850-seed-botoes.js`).
Isto também tem uma consequência em cascata: `Server/Util/seedDefaults.js` corre a cada arranque do
`main.js` e só cria o template "Predefinida" **uma vez** (`if (await TabelaPadrao.count() > 0) return`).
Se o serviço arranca com `Botoes` vazia, o template fica vazio **para sempre**, mesmo depois de
semear os botões mais tarde — precisa de o apagar para se regenerar (ver instruções abaixo).

**Diferença importante migrations vs. seeders:** as migrations ficam registadas em `SequelizeMeta`
(idempotentes por construção). Os **seeders não têm essa tabela** — confirmado ao correr
`db:seed:all` duas vezes localmente: a segunda vez rebenta com `SequelizeUniqueConstraintError:
Duplicate entry '1' for key 'PRIMARY'` (o seeder usa IDs fixos). Por isso o `install.sh` não podia só
"adicionar mais um comando"; precisava de uma guarda.

**Correção:** adicionado um passo entre migrations e o arranque do serviço — conta as linhas de
`Botoes` via `SELECT COUNT(*)`; só corre `db:seed:all` se a tabela estiver vazia. Testado localmente
contra o MariaDB de dev nos dois cenários: tabela cheia → salta (confirmado); tabela vazia → semeia as
43 linhas com sucesso, acentos (Emergência, Medicação, Café/Chá) intactos.

### `/opt/inov-lar` continha uma instalação antiga, pré-migração

Ao investigar onde ficava o `.env` (o `install.sh` escreve-o ao lado de onde o próprio script está —
`SCRIPT_DIR`, não um caminho fixo), percebeu-se que a app real tinha sido corrida a partir de
`/home/informatica/Documentos/InovLAR-main`, e que `/opt/inov-lar` continha uma cópia **antiga**:
tinha pastas `Server/core` e `Server/build` que não existem na árvore atual do repositório — quase de
certeza a instalação pré-migração, ainda com `sqlite3`, e provável origem do crash-loop antigo
("Inov-LAR Server", SEGV) visto no `journalctl` numa sessão anterior.

**Ação:** `/opt/inov-lar` renomeado para `/opt/inov-lar.old` (não apagado — só depois de confirmar
tudo a funcionar do novo sítio), a app real movida de `Documentos/InovLAR-main` para `/opt/inov-lar`,
e o `install.sh` corrido outra vez de lá — reescreve o `.service` com o `WorkingDirectory`/`ExecStart`
corretos e reaproveita a password do `.env` já existente (idempotência confirmada: "Reutilizo a
password da BD já registada"; migrations: "já estava atualizado"; seeders: "salto (43 já existem)").
Serviço confirmado ativo e estável a partir de `/opt/inov-lar` (`curl` 200 OK, sem crashes).

### `npm install` também caía no Node errado (mesma família do bug do `find_node`)

Avisos `EBADENGINE` durante o `npm install` mostravam `current: { node: 'v18.20.5' }`, apesar de o
`find_node()` ter escolhido corretamente o v22 para as migrations. Causa: o `npm-cli.js` tem shebang
`#!/usr/bin/env node` — invocado diretamente (mesmo com `NPM_BIN` absoluto), o SO resolve esse `node`
por `$PATH`, não pelo `NODE_BIN` escolhido. Sob `sudo`, o `$PATH` é mínimo e não inclui o nvm, caindo
de volta no `/usr/local/bin/node` (v18). Não partiu nada desta vez (`mariadb` é pacote 100% JS, sem
compilação nativa), mas era um risco real para uma dependência futura. **Corrigido:** as subshells que
correm `npm install`/`npm run build` agora exportam `PATH="$(dirname "$NODE_BIN"):$PATH"` antes de
chamar `$NPM_BIN`, garantindo que o `env node` do shebang resolve para o mesmo binário validado.

### Estado (Fase 3)
- [x] `mariadb-server` da distro instalado e a correr na Pi (10.11.3).
- [x] BD/utilizador criados via `install.sh`, idempotente.
- [x] Migrations aplicadas com sucesso na Pi (Node v22 via nvm, encontrado por `find_node()`).
- [x] Serviço systemd `inov-lar` ativo; `curl` devolve 200 OK com a SPA.
- [x] Seeders dos botões (`install.sh`), idempotentes por contagem prévia — confirmado na Pi (43 linhas).
- [x] App movida para `/opt/inov-lar` (local definitivo); instalação antiga preservada em
      `/opt/inov-lar.old` até se confirmar tudo, depois apagável.
- [x] `npm install`/`npm run build` também usam o Node validado (correção do `$PATH` do shebord do npm).

### Bug real na Pi (2026-07-03) — tabela `Pedidos` vs `pedidos`, mascarado pelo Windows

Depois da mudança para `/opt/inov-lar`, o `journalctl` mostrou erros reais em produção ao abrir a
página de um utente: `Table 'inovlar.pedidos' doesn't exist` (`ER_NO_SUCH_TABLE`), disparado pelo
`getUtenteById` (join com `pedidos`).

**Causa:** a migration original `20250506190829-create-pedidos.js` criava a tabela como `'Pedidos'`
(maiúscula), mas o model (`Server/models/Pedido.js`) usa `tableName: 'pedidos'` (minúscula) — um
mismatch que já existia **antes** desta migração para MariaDB, mas ficava invisível: no SQLite os
nomes de tabela são comparados sem distinguir maiúsculas/minúsculas, e no MariaDB do **Windows**
(`lower_case_table_names=1`, confirmado com `SHOW VARIABLES`) os nomes são sempre dobrados para
minúsculas independentemente do que se pede — por isso todos os testes locais desta migração
passaram sem nunca revelar o problema. No MariaDB de **Linux** (omissão `lower_case_table_names=0`,
como na Pi), os nomes são case-sensitive: a tabela física ficou `Pedidos`, mas o Sequelize procurava
`pedidos` → erro.

**Correção (duas frentes):**
1. `Server/migrations/20250506190829-create-pedidos.js` — `createTable`/`addIndex`/`dropTable`
   passam a usar `'pedidos'` (minúscula), para instalações de raiz futuras já saírem corretas.
2. `Server/migrations/20260703150000-rename-pedidos-table.js` (nova) — para bases **já migradas**
   (Pi, dev local): faz `RENAME TABLE Pedidos TO pedidos`, mas só depois de confirmar com
   `information_schema.tables` + `BINARY` (comparação exata de maiúsculas/minúsculas) que existe
   mesmo uma tabela física `Pedidos` distinta — evita rebentar em sistemas onde já é `pedidos`
   (confirmado: correr às cegas no Windows dava `ERROR 1050: Table 'pedidos' already exists`).

Testado localmente: a verificação `BINARY` distingue corretamente `'Pedidos'` (0 linhas) de
`'pedidos'` (1 linha) mesmo no Windows onde a tabela física é só uma; a migration correu como no-op
aqui (correto); CRUD completo (incluindo `Pedido` com join) confirmado a funcionar depois.

**Lição:** testar só no Windows não basta quando o alvo de produção é Linux — `lower_case_table_names`
é uma das diferenças silenciosas entre os dois. Migrations que criam nomes de tabela devem ser
escritas e revistas assumindo case-sensitivity.

### Estado (Fase 3)
- [ ] **Correr a nova migration na Pi** (`db:migrate`) para renomear `Pedidos` → `pedidos` na base
      já existente — só depois disso a página de utente deixa de dar erro 500.
- [ ] **Confirmar o template "Predefinida":** o serviço já arrancou antes dos seeders existirem, por
      isso `seedDefaults()` pode ter criado um `TabelaPadrao` vazio (só corre uma vez). Verificar
      `JSON_LENGTH` das `configs` e, se vazio, apagar e reiniciar para regenerar com os 43 botões.
- [ ] Validação funcional na app (browser): criar botão sem imagem; abrir/gravar o tabuleiro de um
      utente (round-trip JSON); confirmar que os 3 bugs corrigidos (imagem allowNull, updatedAt do
      through-table, JSON como objeto) se comportam bem em produção real, não só via script de teste.
- [ ] Apagar `/opt/inov-lar.old` depois de tudo confirmado.
- [ ] Fase 4 — kiosk mode (Chromium a abrir sozinho no boot).

---

## 2026-07-03 — Fix: tabuleiro do utente não atualizava a lista de pedidos sem F5

### Contexto
Depois da migração para MariaDB funcionar em produção, reparou-se que `TabuleiroComunicacao.jsx`
não atualizava automaticamente a "Lista de Pedidos" (nem o badge/"Estou Bem") ao entrar na página —
só um F5 mostrava dados frescos.

### Causa
```jsx
useEffect(() => {
    if (!utente || utente.id !== id) setUtenteId(id);
}, [id]);
```
O `ContextProvider` **sobrevive a toda a navegação da SPA** (envolve o `<Router>`). Se o `utente` em
contexto já era o mesmo (`utente.id === id`) — por ex. reentrar no tabuleiro do mesmo utente depois de
sair pelo PIN — a condição não disparava `setUtenteId`, e portanto não havia novo `fetchUtente`/
`fetchPedidosUtilizador`. O socket (`bd_alterado`) resolve "estou na página e algo muda", mas não
"acabei de entrar com dados já desatualizados no contexto".

### Correção — `Client/src/Pages/TabuleiroComunicacao.jsx`
```jsx
useEffect(() => {
    setUtenteId(id);
    fetchUtente(id);
    fetchPedidosUtilizador(id);
}, [id]);
```
Busca sempre dados frescos ao entrar, independentemente de já ser o mesmo utente. `fetchUtente` e
`fetchPedidosUtilizador` já estavam expostos pelo `Context` — só foi preciso desestruturá-los.

### Teste (browser real, não só build)
`npm run build` (Client) OK. Testado ao vivo com Server+Client em dev contra o MariaDB local:
1. Criado um utente de teste e navegado para o seu tabuleiro (sem layout configurado — ok para este teste).
2. Navegado para fora (`/`) e criado um pedido via `POST /pedidos` diretamente (simula alteração
   externa enquanto o utente não estava na página).
3. Navegado de volta ao mesmo tabuleiro (`/2850454783`, SPA, sem reload).
4. Confirmado por rede (`preview_network`) que `GET pedidos/utente/4` dispara a cada montagem.
5. Confirmado visualmente (accessibility snapshot): botão "Estou Bem" apareceu e a gaveta mostrou o
   pedido "Emergência" criado no passo 2 — sem F5.

Dados de teste limpos da BD de dev depois.

---

## 2026-07-10 — Rate limiting no login de staff (brute-force do PIN)

### Contexto
Revisão de segurança do projeto (`SECURITY_CHECKLIST.md`) identificou que o PIN de staff
(mínimo 4 dígitos, ~10 000 combinações) não tinha qualquer limite de tentativas em
`/auth/staff/login`, tornando-o forçável por brute-force por qualquer pessoa na rede local.
Primeiro item do checklist a ser corrigido.

### Correção — `Server/middleware/rateLimiter.js` (novo)
```javascript
const rateLimit = require('express-rate-limit');

const staffAuthLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { mensagem: 'Demasiadas tentativas. Tenta novamente mais tarde.' },
});

module.exports = { staffAuthLimiter };
```

Aplicado em `Server/routes/route.js` a `/auth/staff/login`, `/auth/staff/setup` e
`/auth/staff/change`. Decisões:
- **Limite por IP** (omissão do `express-rate-limit`) — adequado porque o PIN é partilhado por
  dispositivo, não por conta; cada tablet/staff tem tipicamente um IP local estável. Não há proxy
  reverso na stack atual (`install.sh`/`main.js`), por isso `req.ip` reflete o IP real sem precisar
  de `app.set('trust proxy', ...)`.
- **`skipSuccessfulRequests: true`** — só tentativas falhadas (401) contam para o limite; um login
  correto nunca gasta "quota", por isso staff genuína nunca é bloqueada por uso normal ao longo do
  dia.
- **Store em memória** (omissão da biblioteca) — suficiente porque o servidor corre como instância
  única no Pi (sem cluster nem Redis). Se um dia escalar para múltiplas instâncias, precisa de um
  store partilhado.
- **5 tentativas / 10 min** — torna o brute-force de um PIN de 4 dígitos impraticável (dias, não
  minutos) sem incomodar alguém que erra o PIN uma ou duas vezes.

### Teste
Servidor reiniciado localmente (`node main.js`) e testado com `curl` diretamente (mudança é só de
API, sem superfície de UI a verificar no browser):
```bash
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "Tentativa $i -> HTTP %{http_code}\n" \
    -X POST http://localhost:3000/auth/staff/login \
    -H "Content-Type: application/json" -d '{"password":"0000"}'
done
```
Resultado: tentativas 1–5 devolveram `401 Palavra-passe incorreta`; a 6ª devolveu
`429 Demasiadas tentativas. Tenta novamente mais tarde.`, com headers `RateLimit-Limit: 5`,
`RateLimit-Remaining: 0`, `RateLimit-Reset: 591` (~10 min), `Retry-After: 591`. Confirmado também
que uma rota não relacionada (`GET /utentes`) continuou a devolver `200` normalmente — o limite
está isolado às rotas de auth.

### Próximo
Seguinte item do `SECURITY_CHECKLIST.md`: tornar `COOKIE_SECRET` obrigatório (falhar arranque se
ausente) e `secure: true` no cookie de sessão em produção.

---

## 2026-07-10 — `COOKIE_SECRET` obrigatório em produção + `secure` do cookie opt-in

### Contexto
Segundo item do `SECURITY_CHECKLIST.md`. `Server/config/auth.js` tinha um fallback hardcoded
(`"troca-isto-por-um-segredo-bem-grande"`) visível no repositório público — se `COOKIE_SECRET` não
fosse definido em produção, qualquer pessoa que lesse o código conseguia forjar cookies de sessão
válidos e entrar na consola de staff sem saber o PIN. O cookie também tinha `secure: false` fixo,
mesmo pensando em produção.

### Bug relacionado encontrado durante a investigação
`main.js` faz `require('./config/auth')` (linha 7) **antes** de `require('./models')` (linha 8) —
e é só a cadeia `models/index.js → config/database.js → config/config.js` que chama
`require('dotenv').config()`. Ou seja: mesmo com `COOKIE_SECRET` no `Server/.env`, `config/auth.js`
lia `process.env.COOKIE_SECRET` **antes** do dotenv ter carregado o ficheiro — nunca seria apanhado.
Estava mascarado pelo fallback. Corrigido adicionando `require('dotenv').config()` ao próprio
`config/auth.js`.

### Decisão importante: `secure` não fica ligado a `NODE_ENV`
A proposta óbvia seria `secure: process.env.NODE_ENV === 'production'`. Não foi essa a escolha:
a Pi em produção corre com `NODE_ENV=production` (systemd, `install.sh`) mas serve por **HTTP
simples** — não há TLS configurado em lado nenhum do `install.sh`. Ligar `secure` a `NODE_ENV`
cegamente faria o browser deixar de enviar o cookie assim que a mudança fosse para produção,
**partindo o login imediatamente**. Em vez disso, `secure` passa a ler uma flag opt-in separada
(`COOKIE_SECURE`), documentada no `.env.example`, a ativar manualmente só quando houver um reverse
proxy com HTTPS à frente do servidor.

### Correção — `Server/config/auth.js`
```javascript
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
let COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!COOKIE_SECRET) {
    if (isProd) {
        console.error('COOKIE_SECRET não definido. Define-o no Server/.env antes de arrancar em produção.');
        process.exit(1);
    }
    console.warn('AVISO: COOKIE_SECRET não definido — a usar um valor fixo só para desenvolvimento local. NÃO uses isto em produção.');
    COOKIE_SECRET = 'dev-only-cookie-secret-inseguro-nao-usar-em-producao';
}

module.exports = { COOKIE_SECRET };
```

### Correção — `Server/controller/authController.js`
```javascript
secure: process.env.COOKIE_SECURE === "true", // true só quando houver HTTPS à frente (ver .env.example)
```

### Correção — `Server/.env.example`, `install.sh`, `install.ps1`
`.env.example` passa a documentar `COOKIE_SECRET` (obrigatório) e `COOKIE_SECURE` (opt-in, default
`false`). `install.sh` e `install.ps1` passam a gerar `COOKIE_SECRET` automaticamente, com o mesmo
padrão idempotente já usado para `DB_PASS` (reutiliza se já existir no `.env`, gera um novo caso
contrário) — para que instalações novas (e a Pi, se o script for corrido lá) nunca caiam no caminho
de erro.

### Aviso operacional (ação fora do repositório)
A Pi em produção nunca teve `COOKIE_SECRET` definido em lado nenhum. Com esta mudança, o serviço
`inov-lar` entra em crash-loop no próximo restart **a menos que** `COOKIE_SECRET` seja adicionado ao
`/opt/inov-lar/Server/.env` antes disso — correndo o `install.sh` atualizado (gera-o sozinho) ou
adicionando a linha manualmente.

### Teste
Sem superfície de UI a verificar (mudança de configuração/arranque do servidor); testado
diretamente com `node -e` e `curl` contra o servidor local reiniciado:

1. **`NODE_ENV=production` sem `COOKIE_SECRET`** → `process.exit(1)` com a mensagem de erro
   esperada (exit code 1 confirmado).
2. **Dev sem `COOKIE_SECRET`** → aviso na consola, servidor continua com o valor fixo de dev.
3. **`NODE_ENV=production` com `COOKIE_SECRET` no `.env`** → arranca normalmente, usa o valor do
   `.env` (confirmado que já não é o fallback).
4. **`COOKIE_SECURE`** — confirmado por avaliação direta (`process.env.COOKIE_SECURE === "true"`)
   que fica `false` quando ausente/`"false"` e `true` só quando explicitamente `"true"`.
5. Servidor de dev reiniciado com o código novo: `GET /auth/staff/status` continuou a responder
   normalmente (`configurado: true`), confirmando que o fluxo de auth existente não partiu.
6. `bash -n install.sh` e `[System.Management.Automation.Language.Parser]::ParseFile` em
   `install.ps1` — sintaxe de ambos os scripts validada sem erros.

`.env` local restaurado ao estado original depois dos testes (sem o `COOKIE_SECRET` de teste).

### Próximo
Terceiro item do `SECURITY_CHECKLIST.md`: substituir o cookie de sessão de valor estático `"ok"`
por um identificador de sessão real (revogável, com expiração server-side).

---

## 2026-07-10 — Sessões reais de staff (substituir o cookie estático `"ok"`)

### Contexto
Terceiro item do `SECURITY_CHECKLIST.md`. O cookie de sessão assinado guardava literalmente a
string `"ok"` para toda a gente (`res.cookie(COOKIE_NAME, "ok", ...)`), e o `requireStaff` só
verificava `=== "ok"`. Consequências: impossível revogar uma sessão individual, logout não
invalidava nada do lado do servidor (só limpava o cookie no browser), e se o `COOKIE_SECRET` vazasse
qualquer pessoa forjava um cookie válido para sempre.

### Modelo escolhido
Token aleatório de 32 bytes (`crypto.randomBytes`) guardado no cookie; na BD guarda-se só o
**SHA-256** desse token (nunca em claro) + `expiraEm`. Uma linha por sessão ativa.

- **SHA-256, não bcrypt** — o token é aleatório de alta entropia (256 bits), não uma password de
  baixa entropia. Um hash rápido é o correto (padrão dos GitHub PATs, Rails, etc.); bcrypt seria
  desnecessário e lento a cada request. Guardar o hash (e não o token cru) protege contra um
  vazamento de leitura da BD ser usado para sequestrar sessões ativas.
- **`sync()`, sem migration** — segue o padrão já documentado no `CLAUDE.md` para `StaffAuth`,
  `TabelaLayout` e `TabelaPadrao`: o modelo é criado por `Model.sync()` no `main.js`, não há ficheiro
  de migration. Mantém a consistência com os outros modelos não-migrados.
- **Limpeza preguiçosa** (decisão do utilizador) — linhas expiradas são apagadas quando validadas
  (`validarSessao`), sem varrimento periódico nem no arranque. Suficiente para o punhado de
  dispositivos deste caso de uso.
- **`change` (mudar PIN) não revoga sessões** (decisão do utilizador) — é um PIN partilhado de
  dispositivo; revogar deslogava todos os tablets ao mudar o PIN, o que não se quer.

### Ficheiros
- `Server/models/StaffSession.js` (novo) — `tokenHash` (unique) + `expiraEm`.
- `Server/Util/sessions.js` (novo) — `criarSessao` (devolve o token em claro para o cookie),
  `validarSessao` (devolve a sessão ou `null`; apaga se expirada), `revogarSessao`.
- `Server/middleware/auth.js` — `requireStaff` passa a `async`, valida o token contra a BD, com
  `try/catch` a devolver 401 (fail closed) em caso de erro.
- `Server/controller/authController.js` — `setup`/`login` fazem `criarSessao()` e metem o token no
  cookie; `status` valida o token (em vez de `=== "ok"`); `logout` chama `revogarSessao` antes de
  limpar o cookie (revogação real do lado do servidor). `change` sem alterações.
- `Server/models/index.js` + `Server/main.js` — registo do modelo + `StaffSession.sync()`.
- **Cliente: zero alterações.** O cookie é `httpOnly`, o cliente nunca lê o valor; só depende da sua
  presença (`credentials: "include"`) e do campo `autenticado` do `/auth/staff/status` — ambos
  opacos à mudança de `"ok"` → token.

### Impacto operacional (ação no deploy)
Dispositivos com o cookie antigo `"ok"` deixam de autenticar após o deploy (`validarSessao("ok")`
não encontra sessão) → cada tablet é deslogado **uma vez** e reintroduz o PIN. Não é crash, só
re-login; sem impacto até o código chegar à Pi.

### Teste
Sem superfície de UI relevante (mudança de auth do lado do servidor). Testado por dois scripts
(node, contra o MariaDB de dev real), depois apagados; `.env` e tabela deixados limpos.

1. **Helper direto** (`Util/sessions.js`): token com 64 hex chars; `validarSessao` do token válido
   devolve a sessão; `"ok"`/lixo/`null` devolvem `null`; a BD guarda o **hash** e não o token cru;
   um token criado já expirado (`criarSessao(-1)`) devolve `null` e a respetiva linha é apagada
   (limpeza preguiçosa confirmada); após `revogarSessao`, o token deixa de validar. Todos PASS.
2. **HTTP end-to-end** — cookie assinado à mão com o `cookie-signature` (o mesmo que o
   `cookie-parser` usa), para testar sem precisar do PIN de dev nem apagar o `StaffAuth`:
   - `/auth/staff/status` sem cookie → `autenticado:false`; `DELETE /utentes/:id` sem cookie → 401.
   - Cookie antigo `"ok"` (validamente assinado) → `autenticado:false` (já não vale).
   - Sessão real forjada → `/status` `autenticado:true`; rota protegida passa o `requireStaff`
     (404, não 401).
   - Após `revogarSessao` do mesmo token → `/status` `autenticado:false` e rota protegida → 401.
   Todos PASS. Confirmado no fim que `StaffSessions` ficou com 0 linhas (sem órfãs de teste).

### Próximo
Itens de "Alto" do `SECURITY_CHECKLIST.md`: restringir os endpoints de leitura de dados de pacientes
(`/utentes`, `/pedidos`) que estão acessíveis sem autenticação (maior risco RGPD).

---

## 2026-07-14 — Fotos de perfil dos utentes (reutilização do seletor de imagens)

### Contexto
O editor de botões já tinha seletor de imagem (grid + upload + delete). Pedido: reutilizar o
conceito para dar **foto de perfil** aos utentes, com confidencialidade — as fotos pessoais de
um utente não podem aparecer na galeria partilhada de outros.

### Decisão
- **Pasta e endpoints próprios** (`public/imagesUtentes/`), separados de `imagesBotoes` — evita
  misturar caras de pessoas com ícones de botões (privacidade/RGPD).
- **Modelo híbrido** de escolha: (a) grid de **avatares predefinidos** partilhados
  (`public/imagesUtentes/predefinidos/`, os únicos listados pela API), (b) escolha de **cor** do
  avatar (mostra as iniciais), (c) **upload pessoal** — guardado com nome único não sequencial
  (`utente-{ts}-{rand}.ext`) e **nunca listado** pela API (só acessível por URL direto, como já
  acontece com `imagesBotoes`).
- **Substituição automática**: ao fazer novo upload pessoal, o servidor apaga a foto anterior do
  utente **exceto se for um avatar predefinido** (helper `ehUploadPessoalUtente`). O cliente passa
  a foto atual em `previousPath`.
- **Fallback de render**: `imagem` → `corAvatar` + iniciais → default (iniciais em
  `secondary-container`).

### Alterações
- **Migration** `20260714120000-add-imagem-cor-to-utentes.js` — colunas `imagem`, `corAvatar`
  (nullable) em `Utentes`; + campos no modelo `Utente.js`.
- **`utenteController.js`** — `createUtente`/`updateUtente` com **whitelist** dos campos
  (`nome, quarto, imagem, corAvatar`), fechando de passagem o gap de mass assignment do update
  (o `updateUtente` passava `req.body` direto — ver `SECURITY_CHECKLIST.md`). O update só grava as
  chaves realmente enviadas (undefined = não mexe).
- **`routes/route.js`** — config multer própria + `GET /imagesUtentes/predefinidos` (lista só a
  subpasta), `POST /imagesUtentes/upload` (substitui a anterior via `previousPath`),
  `DELETE /imagesUtentes` (recusa predefinidos, anula `imagem` nos utentes que a usam). Importado
  `Utente` no topo (só `Botao` estava).
- **Client** — `api/utentes.js` (`fetchAvataresPredefinidos`, `uploadImagemUtente`,
  `deleteImagemUtente`); `UtenteForm.jsx` (secção foto: grid predefinidos + cores + upload, preview
  do avatar); `EditUtente.jsx`/`NewUtente.jsx` (estado + handlers); `StaffHome.jsx` (avatar do
  cartão e thumbnail do menu mostram foto/cor).

### Gotcha
`GET /imagesUtentes/predefinidos` colide com a pasta física homónima: o `express.static('public')`
(antes do router) faz **redirect 301** para a barra final antes de chegar à rota. O `fetch` do
browser segue o redirect automaticamente e funciona (mesmo padrão do `GET /imagesBotoes` já
existente), mas um `curl` sem `-L` só vê o 301. Não é bug — é o comportamento herdado.

### Verificação (browser + disco)
- Migration aplicada; modelo devolve os campos novos.
- Grid de predefinidos carrega (4 SVGs), seleção → criar utente → persiste
  (`imagem: /imagesUtentes/predefinidos/avatar-verde.svg`) → aparece no cartão do StaffHome.
- Upload pessoal + **substituição**: confirmado **no disco** que o ficheiro anterior é apagado e o
  novo fica. (A verificação por HTTP dava falso 200 porque o catch-all SPA do `main.js` devolve
  `index.html` para estáticos inexistentes em vez de 404 — usar o disco/content-type para validar.)
- Salvaguardas: predefinido passado como `previousPath` **não** é apagado; `DELETE` de predefinido → 400.
- Update com cor: `corAvatar` gravado e `imagem` limpo.

### Nota operacional
Foi preciso reiniciar o `node main.js` para as rotas/modelo novos ficarem ativos (sem nodemon).

### Refinamento (mesmo dia) — UX do seletor de avatar
Feedback: as cores pareciam ser uma *alternativa* ao avatar (confusão "muda a cor do perfil?").
Reestruturado o `UtenteForm` em **duas secções independentes** (inspirado no seletor do Brave):
- **Avatar** — o *quê* mostrar: tile "Iniciais", "Foto atual" (upload pessoal, com remover),
  avatares predefinidos, e tile "Carregar" (add_a_photo).
- **Cor de fundo** — separada; aparece atrás das iniciais. Escolher cor **já não limpa** a
  `imagem` (antes fazia `imagem:''`), são ortogonais. Escolher "Iniciais" é que define `imagem:''`.

### Refinamento 2 (mesmo dia) — um ícone recolorível em vez de avatares fixos
Feedback: os 4 avatares predefinidos tinham cores fixas e não dava para mudar a cor do ícone.
Substituídos por **um único ícone de pessoa** (Material Symbol `person`) cuja cor de fundo é
dada pela secção "Cor de fundo" — a mesma cor recolore iniciais **e** ícone.
- Novo componente `Components/utentes/UtenteAvatar.jsx` (+ `ICONE_PESSOA = 'icone'`, `iniciaisDe`)
  centraliza o render do avatar nos 3 modos: foto (caminho) / ícone (`'icone'`) / iniciais (`''`).
  Usado no `UtenteForm` (tiles + preview) e no `StaffHome` (cartão + thumbnail do menu).
- Campo `imagem` passa a aceitar o sentinela `'icone'` (não é um caminho de ficheiro). O
  `UtenteAvatar` trata-o; qualquer sítio que renderize avatares tem de usar o componente (senão
  faria `<img src=".../icone">`).
- Removidos: avatares SVG predefinidos + pasta `public/imagesUtentes/predefinidos/`, rota
  `GET /imagesUtentes/predefinidos` e `fetchAvataresPredefinidos`. Upload/DELETE de fotos pessoais
  mantêm-se. `ehUploadPessoalUtente('icone')` é `false` (sentinela não é caminho) → não tenta apagar.

Verificado no browser: secção Avatar = [Iniciais][Ícone][(Foto atual)][Carregar]; escolher cor
recolore o ícone (fundo `#ffe0c2`); criar utente persiste `imagem:'icone'`+`corAvatar`; StaffHome
mostra o ícone com a cor (0 imgs partidas); sem erros de consola.

---

## 2026-07-14 — Fechar endpoints agregados de dados de pacientes (RGPD)

### Contexto
Item de "Alto" do `SECURITY_CHECKLIST.md`, o de maior impacto RGPD. Vários GETs estavam abertos
(sem `requireStaff`), incluindo os **agregados** que expõem dados de todos os utentes: `GET /utentes`
(roster completo com nome + quarto), `GET /pedidos` e `/pedidos/ativos/*` (pedidos de todos). Pior:
o `ContextProvider` envolve toda a app (incluindo o tabuleiro do utente em `/:token`) e no arranque
fazia `fetchUtentes()` + `fetchPedidosPendentesByEmergencia()` — ou seja, **o próprio tablet do
paciente descarregava a lista completa de pacientes e todos os pedidos pendentes** para memória.

### Âmbito (o que fechar vs. manter aberto)
Confirmado por leitura do cliente o que o tabuleiro realmente consome: `utente` (o próprio, via
`GET /utentes/:id`), `botoes` (catálogo genérico de botões) e a sua `tabela`. Nunca usa a lista
`utentes` nem os agregados de pedidos.

- **Fechado com `requireStaff`** (agregados): `GET /utentes`, `/pedidos`, `/pedidos/ativos/hora`,
  `/pedidos/ativos/emergencia`, `/pedidos/:id` (não usado pelo cliente), `/tabelas`, `/tabelas-padrao`.
- **Mantido aberto** (o tabuleiro precisa): `/utentes/:id`, `/pedidos/utente/:utenteId`,
  `/utentes/:id/tabela/:dispositivo`, `/botoes` + `/botoes/utente/:utenteId` (catálogo genérico
  "SOS"/"água"…, não são dados pessoais).

### Limite conhecido (fica para o item seguinte)
`GET /utentes/:id` continua enumerável revertendo o token do utente (a chave da cifra de Feistel
está no bundle do cliente). Fechar os agregados elimina o "descarregar o roster inteiro num pedido"
— o maior problema — mas não a enumeração por-id, que exige o mecanismo de autorização por-utente do
próximo item de "Alto" ("o token é ofuscação, não autenticação").

### Correção — servidor (`Server/routes/route.js`)
`requireStaff` acrescentado às 7 rotas GET agregadas listadas acima.

### Correção — cliente
- `src/api/client.js` — `get()` passa a aceitar `{ auth: true }` (envia `credentials: "include"`),
  espelhando o que o `mutate()` já fazia.
- `src/api/utentes.js` (`fetchUtentes`), `src/api/tabela.js` (`fetchTabelas`),
  `src/api/tabelasPadrao.js` (`fetchTabelasPadrao`) → `{ auth: true }`.
  `src/api/pedidos.js` (`fetchPedidosPendentesEmergencia`) → `credentials: "include"`.
- `src/ContextProvider.jsx` — `fetchBotoes()` continua sempre (o board precisa); as leituras
  só-staff (`fetchUtentes` + `fetchPedidosPendentesByEmergencia`) passam a correr **só quando
  `staffUnlocked`** (efeito dependente de `staffUnlocked`). No handler do socket, guardadas com um
  `staffUnlockedRef` novo (evita stale-closure, seguindo o padrão do `utenteIdRef` existente). Assim
  o tabuleiro do utente (sem sessão) já não pede o roster nem os agregados.

### Impacto operacional
Nenhum risco de crash. Dispositivos-paciente deixam de carregar o roster (é o objetivo); o board
continua a funcionar com os seus próprios endpoints. Dispositivos-staff: sem mudança visível — já
têm sessão e passam a enviar o cookie nestes GETs.

### Teste
1. **Matriz de endpoints** (script node contra o servidor de dev, cookie de sessão real forjado com
   `cookie-signature`; depois apagado):
   - Sem sessão, os 7 agregados → **401**; os do tabuleiro (`/botoes`, `/utentes/:id`,
     `/pedidos/utente/:id`, `/utentes/:id/tabela/:disp`) → **não-401**; com sessão de staff, os
     agregados → **não-401**. Todos PASS.
2. **Build do cliente** (`npm run build`) — passa limpo (o aviso de chunk size é pré-existente).
3. **Browser** — carregado o tabuleiro real do utente 5 (`/4246505107`), sem sessão, contra o build
   servido pelo Express (:3000):
   - `read_page` confirma o board renderizado por completo (botões SOS/"Com falta de ar"/… + gaveta
     "Lista de Pedidos" com os pedidos do próprio utente + "Acesso staff").
   - `read_network_requests` confirma que o board busca **só** os seus endpoints — `/utentes/5`,
     `/pedidos/utente/5`, `/utentes/5/tabela/*`, `/botoes` (todos 200) — e **não** faz `GET /utentes`
     (roster) nem `/pedidos/ativos/emergencia` nem `/tabelas`. Ou seja, o tablet do paciente já não
     descarrega dados de outros utentes. Consola sem erros 401.

### Próximo
Item de "Alto" seguinte: `PUT /pedidos/:id` não verifica o dono do pedido + mass assignment
(`Pedido.create(req.body)` / `Utente.update(req.body)`), e a questão do token do utente como
ofuscação e não autenticação real.

---

## 2026-07-15 — Editor de Tabelas: espaço do preview, redimensionar e drag-and-drop

### Contexto
Feedback de uso do `TabelaEditor` (`Client/src/Components/tabela/TabelaEditor.jsx`): o cabeçalho do
"Quadro Atual" desperdiçava espaço vertical (a preview do dispositivo, sobretudo tablet, não cabia
bem no ecrã); o redimensionamento de botões só permitia crescer para baixo/direita (o único puxador
ficava fixo no canto superior-esquerdo); e o "ghost" do drag-and-drop mostrava sempre um botão 1×1,
mesmo a arrastar um botão maior — fazendo a colocação cair na célula sob o cursor em vez de na
posição real do botão.

### Alterações — espaço do canvas
- Cabeçalho do "Quadro Atual" compactado: `p-5 sm:p-6` → `p-3 sm:p-4`, título `text-xl` → `text-base`,
  parágrafo descritivo removido (passou a `title` do `<h2>`), `mb-4` → `mb-2`.
- `constants.js` — `DISPOSITIVOS.tablet.maxW` de `760` para `620`. Medido no DOM: a moldura do
  tablet ocupava 87% da altura do canvas (`hRatio`) contra 74% do PC, por a proporção 4/3 ser mais
  "quadrada" que a 16/10 do PC à mesma largura — daí parecer maior mesmo cabendo. Com `620` passa a
  76%, visualmente equivalente ao PC.

### Alterações — drag-and-drop (posição real do botão, não do cursor)
- `onDragEnd`/novo `onDragMove` — a colocação/movimento já não usa a célula "over" do dnd-kit
  (baseada no cursor), mas sim `active.rect.current.translated` (o retângulo real, em pixels, do nó
  a ser arrastado, já com o "grab point" original) convertido para célula-âncora via
  `ancoraDoArrasto()`. Sem isto, arrastar um botão maior que 1×1 colocava-o onde o cursor estava, não
  onde o botão aparecia visualmente.
- Novo estado `dragPreview` (+ `dragFootprint`, um `Set` das posições do footprint completo) —
  o destaque nas células vazias (`GridCell`, prop `destacado`) passa a acender o footprint inteiro
  do botão a arrastar, não só 1 célula sob o cursor.
- `DragOverlay` deixou de ser uma caixa fixa de 96px com `size="P"`; agora dimensiona-se pelo `w×h`
  real do botão arrastado (`activeSpan`, via `getSpan`) multiplicado pelo tamanho real de uma célula
  (`cellPx`, lido do `gridRef`).

### Alterações — redimensionar (duas iterações)
**1ª versão:** puxador único (canto inferior-direito) com lógica de sinal do delta por eixo — se o
arrasto ia "para fora" (direita/baixo) crescia com a âncora fixa; se ia "para dentro"/lado contrário
crescia a partir do canto oposto, deslocando a âncora. Resolvia o crescer-para-cima, mas criava
confusão: inverter o sentido do arrasto a meio de um gesto (crescer para cima e depois tentar
encolher de volta) era interpretado como "crescer ainda mais", porque o pivô mudava com o sinal
instantâneo do delta em vez de ficar fixo ao handle.

**2ª versão (final) — caixa de redimensionar com 8 puxadores**, como um editor gráfico convencional
(Figma/PowerPoint): 4 cantos (`nw`/`ne`/`sw`/`se`) + 4 arestas (`n`/`s`/`e`/`w`), cada um com um
**pivô fixo** (o lado/canto oposto nunca se move durante esse gesto). `iniciarResize(e, pos, handle)`
mapeia o `handle` para que lado de cada eixo desloca (`ladoCol`/`ladoRow`); o cálculo já não ramifica
por sinal do delta — elimina a ambiguidade da 1ª versão. `resizePreview`/`spansEfetivos`/
`cellsEfetivas` mantêm-se (a âncora pode deslocar-se ao crescer por cima/esquerda; a pré-visualização
"segue" o botão até ao pointerup).

### Verificação (browser, eventos de ponteiro/rato sintéticos via `javascript_tool`)
- Espaço do canvas: medido via `getBoundingClientRect` — tablet passou de `hRatio` 0.87 → 0.76.
- Drag-and-drop: arrastar um botão 1×2 mostra 2 células destacadas (footprint completo, antes só 1);
  ao largar, `grid-area` confirma que ficou na âncora correspondente à posição real do "ghost", não
  na célula do cursor.
- Redimensionar: puxador `n` (topo) — crescer para cima (`grid-area: 1 / 6 / span 2 / span 1`) e, no
  mesmo gesto, inverter para baixo volta exatamente ao tamanho/posição original
  (`grid-area: 2 / 6 / span 1 / span 1`), sem o bug de "pensar que queremos crescer ainda mais".
  Puxador `e` (direita) isolado — cresce só em largura, empurrando corretamente o botão colidente.
- Aviso de consola pré-existente (`Cannot update a component (GerirTabela) while rendering a
  different component (TabelaEditor)`) — confirmado que ocorre só no mount inicial (mesma contagem
  antes e depois de qualquer interação de resize/drag), não é introduzido por estas alterações; fica
  por investigar à parte se necessário.

---

## 2026-07-15 — Refactor SOLID/Clean Code: Fase 0 (fundações)

### Contexto
Auditoria completa ao Client e Server identificou "god files" (TabelaEditor.jsx com 1138 linhas e 6
componentes), duplicação entre páginas, mistura PT/EN/ES no código e inconsistências de contrato.
Plano de refactor em 6 fases; esta é a Fase 0 (fundações + quick wins).

### Decisões de convenção (aplicam-se a todas as fases seguintes)
- **Código interno em inglês** (variáveis, funções, hooks, comentários, ficheiros novos).
- **Nomes de domínio ficam em PT nas fronteiras**: endpoints REST (`/utentes`, `/botoes`, `/pedidos`)
  e modelos/tabelas/colunas Sequelize não mudam — protege os dados existentes e os Pi já instalados.
- **Texto da UI em pt-PT via módulo i18n** (`Client/src/i18n/pt.js`); o JSX referencia chaves em
  inglês (`t.common.save`). Prepara outras línguas para o open-source release.

### Alterações
- **Bug corrigido** — `pedidoController.criarPedido`: no caso de pedido duplicado fazia
  `return res.status(201)` sem enviar resposta → o request ficava pendurado até timeout do browser
  (fácil de disparar com duplo-toque no tabuleiro). Agora devolve `200` + o pedido existente.
- **ESLint v9 configurado** — `Client/eslint.config.js` (flat config; plugins já estavam nas
  devDependencies). `no-unused-vars` ignora Maiúsculas (componentes JSX, sem eslint-plugin-react)
  e prefixo `_`. Corrigidos 2 erros reais no TabelaEditor (`size` e `h` não usados). Ficam 6
  warnings legítimos (exhaustive-deps, fast-refresh) que as Fases 3–4 resolvem.
- **Código morto removido** — Pages órfãs (`Home`, `UtenteHome`, `AbrirUtente`, `BindUtente`,
  `EscreverMensagem`), `Server/views/` + `viewController` + rota `/` (o `express.static(DIST)` já
  sombreava a rota em produção), config multer órfã em `main.js` (escrevia para `uploads/` sem rota),
  `Server/database/apcm.sqlite` (pré-MariaDB), classes CSS `.edit-container`/`.new-container`/
  `.sos-button`/`.aac-section` (sem referências em JSX).
- **Esqueleto i18n criado** — `Client/src/i18n/{pt.js,index.js}`; as strings migram gradualmente
  à medida que cada fase toca nos componentes.

---

## 2026-07-16 — Refactor SOLID/Clean Code: Fase 1 (Server)

### Alterações
- **Tratamento central de erros** — `middleware/errorHandler.js` registado como último middleware
  no `main.js`. O Express 5 encaminha promises rejeitadas dos handlers async para lá, por isso os
  controllers perderam todo o boilerplate try/catch. Respostas de erro uniformizadas em
  `{ mensagem }` (o campo que o Client já mostrava nos ecrãs de auth) e sem `erro.message` a vazar
  detalhes internos (fecha um item 🟡 da auditoria). ValidationError→400, FK→400, Multer→400,
  `err.status` respeitado, resto→500 genérico.
- **Whitelists (mass assignment fechado, item 🟠 da auditoria)** — `createPedido` só aceita
  `{ emergencia, utenteId, botaoId }`; `updatePedido` só `{ estado }` (validado contra o ENUM);
  `create/updateBotao` só `{ nome, mensagem, imagem, categoria }`. Updates passaram ao padrão
  `findByPk` + `instance.update()` — evita a ambiguidade do `affectedRows` do MariaDB (update
  sem alteração de valores contava 0 e dava falso 404).
- **Uploads extraídos** — `middleware/uploads.js` (2 configs multer + `imageFileFilter` partilhado
  + `isPersonalUtentePhoto`) e `controller/imageController.js` (handlers que estavam inline no
  route.js + o GET /imagesBotoes que vivia em `routes/images.js`, agora eliminado). O `route.js`
  ficou só com routing e deixou de importar modelos.
- **Endpoints removidos** — `GET /localIP` (sem uso no Client; expunha topologia da rede — item 🟡)
  e `GET /botoes/utente/:utenteId` (sem uso E partido: o modelo Botao não tem coluna `utenteId`,
  a associação é belongsToMany via UtenteBotoes; a query rebentava com "unknown column").
- **DRY** — `Util/applyTemplate.js` (aplicar template a utente, usado na criação de utente e no
  `/tabelas-padrao/:id/aplicar`); `config/constants.js` (`PEDIDO_STATES`, `DEVICES` — o array de
  dispositivos estava duplicado em 2 controllers); `MIN_PASSWORD_DIGITS` movido para `config/auth.js`;
  `PEDIDO_INCLUDES` no pedidoController.
- **Internals em inglês** — handlers renomeados (verbos EN + substantivos de domínio PT:
  `getAllUtentes`, `createPedido`, `associateBotao`, `tabelaPadraoController.list/create/update/
  remove/apply`); comentários traduzidos. Rotas e campos da API/BD inalterados.

### Nota
`CLAUDE.md` tem a lista de endpoints desatualizada (os 2 removidos + `GET /localIP`); fica para
atualizar no fim (tem alterações locais do autor por commitar).

---

## 2026-07-16 — Refactor SOLID/Clean Code: Fase 2 (infra partilhada do Client)

### Alterações
- **`api/client.js`** — a base da API passa a poder vir de `VITE_API_URL` (fallback: host atual
  na porta 3000, como antes); `get` passou a lançar em resposta não-2xx, ficando com o mesmo
  contrato do `mutate` (antes devolvia silenciosamente o JSON de uma página de erro). Todos os
  chamadores já tratavam erros (try/catch ou `.catch`), por isso não há mudança de comportamento
  nos fluxos felizes. Corrigido também o `//imagesBotoes` (barra dupla) no `fetchImagensBotoes`.
- **Hooks partilhados** — `hooks/useFeedback.js` (toast com auto-dismiss de 3s; estava copiado em
  3 páginas) e `hooks/useButtonById.js` (mapa id→botão memoizado; copiado em 3 ficheiros).
- **Componentes partilhados** — `FeedbackToast` (o JSX do toast, copiado em 3 páginas), `Modal`
  (backdrop + stopPropagation, copiado em 2), `SearchInput` (input com ícone, copiado em 2).
- **`tabela/constants.js`** — novos `isSOS(botao)` (a regra `categoria==="SOS" || nome==="SOS"`
  estava em 4 sítios), `defaultConfig(dispositivo)` (copiado em GerirTabela/GerirTemplate),
  `hasCells(config)` e `devicesWithLayout(configs)` (copiados em TabuleiroComunicacao/TabelasView).
- **`tabela/useGridGeometry.js`** — geometria da grelha (rows/slots/ocupação/matriz de categorias)
  num único hook; já adotado no `TabelaPreview`, o editor e o tabuleiro adotam nas Fases 3–4.
- **`src/constants.js`** — `PEDIDO_STATES` (os literais "pendente"/"concluido"/"cancelado"
  estavam espalhados); aplicado em RequestListDrawer e PedidosPendentes.
- **Consistência visual** — TabelasView passou a usar `UtenteAvatar` (foto/cor real do utente)
  em vez de um círculo de iniciais próprio, ficando igual ao StaffHome.
- **i18n** — strings das páginas tocadas (GerirTabela, GerirTemplate, TabelasView, StaffHome,
  TabelaPreview) extraídas para `i18n/pt.js` em secções `common`/`tabelaEditor`/`tabelasView`/
  `staffHome`; mensagens com interpolação são funções (ex.: `deleteConfirm(nome)`).

---

## 2026-07-16 — Refactor SOLID/Clean Code: Fase 3 (partir o TabelaEditor)

### Contexto
`TabelaEditor.jsx` tinha 1138 linhas com 6 componentes definidos inline + toda a lógica de 3
gestos distintos (pinch-zoom, resize por arrasto, drag-and-drop de colocação). Era o pior "god
file" do projeto e a origem apontada pelo utilizador no início do refactor.

### Alterações — `Client/src/Components/tabela/`
- **Componentes extraídos** (um por ficheiro): `MarchingAnts`, `LibraryTile`, `Segment`, `LibDrop`,
  `TrashZone`, `GridCell`, e três maiores — `EditorTopBar` (barra + seletor de dispositivo),
  `PainelCoresCategoria` (painel colapsável de cores), `BibliotecaBotoes` (pesquisa + grupos).
- **Hooks de gesto** (`hooks/`): `usePinchZoom` (zoom 1–3x por pinça), `useGridResize` (resize
  WYSIWYG de 8 puxadores com pivô fixo + os `spansEfetivos`/`cellsEfetivas` da pré-visualização),
  `useDragPlacement` (colocar/mover/remover via dnd-kit + `dragFootprint`). Cada hook expõe
  `onPlace(cells, spans)`; o editor liga-os a um único `commitPlacement` que faz o `trim` e chama
  `onPatch` — antes o `trim` estava repetido em cada callback de gesto.
- **8 puxadores de resize → data-driven** — eram 8 blocos JSX quase idênticos em `GridCell`; agora
  um `.map` sobre `RESIZE_HANDLES` (`{ handle, pos, cursor }`), com o aria-label a vir do i18n.
- **Geometria unificada** — o editor passou a usar o `useGridGeometry` da Fase 2 (rows/slots/
  ocupação/matriz de categorias), em vez do cálculo inline; mesma lógica agora partilhada com o
  TabelaPreview (e o tabuleiro, na Fase 4).
- **Interface `config`/`onPatch`** — o editor recebia ~20 props (5 pares valor/setter + flags).
  Passou a receber um objeto `config` (cols/size/cells/spans/coresCategoria) e um `onPatch(parcial)`.
  `useTabelaConfigs` (novo) centraliza o estado dos 3 layouts, o `patch` parcial e o conjunto de
  dispositivos "sujos" — GerirTabela e GerirTemplate deixaram de duplicar esse wiring (~20 linhas
  cada) e o `defaultConfig`/`configsVazias` local desapareceu.

### Resultado
`TabelaEditor.jsx`: 1138 → ~340 linhas. `npm run lint` 0 erros; `vite build` OK.

### ⚠️ Verificação pendente (importante)
Os gestos são pixel-geometry puro e **não há testes automatizados** — o build compila mas não os
exercita. A lógica foi extraída preservando-a linha a linha, mas uma regressão subtil (botão >1×1 a
cair uma célula ao lado, resize a inverter a meio, fusão de cores dessincronizada) só aparece a
interagir. Testar no browser: colocar/mover/remover botões (1×1 e >1×1), redimensionar pelos 8
puxadores, pinch-zoom em touch, cores por categoria, trocar de dispositivo, guardar/descartar.

---

## 2026-07-16 — Refactor SOLID/Clean Code: Fase 4a (TabuleiroComunicacao)

### Alterações — `Client/src/`
- **`Components/tabela/GrelhaTabuleiro.jsx`** (novo) — a função `renderTabela` (~100 linhas) do
  tabuleiro era um componente disfarçado; extraída, passou a usar o `useGridGeometry` partilhado
  (mesma geometria do editor e do preview) e o `isSOS`. Markup dos botões (Bootstrap) inalterado.
- **`Components/tabela/useTipoDispositivo.js`** (novo) — deteção de dispositivo por largura de ecrã
  (breakpoints próprios que mapeiam para as chaves de DISPOSITIVOS; distintos do `useViewportMode`
  dos Pedidos Pendentes).
- **`hooks/useAlarmeEmergencia.js`** (novo) — o alarme sonoro era um `useEffect` **sem array de
  dependências** (corria em todos os renders, fazendo pause+play a cada mudança de estado). Agora
  reage só à transição de `ativo` (`[ativo]`), mantendo o som contínuo entre re-renders.
- **`Pages/TabuleiroComunicacao.jsx`** — 407 → ~215 linhas. Adota os 3 hooks acima + o
  `GrelhaTabuleiro`; literais de estado trocados por `PEDIDO_STATES`; SOS por `isSOS`; strings para
  `i18n/pt.js` (secção `tabuleiro`). Os overlays (SuccessModal/Drawer/PinPrompt) deixaram de estar
  agrupados numa variável e ficam inline no fim do JSX.

### Nota
A propagação de erro do `postPedido` (hoje o modal de sucesso aparece mesmo se o POST falhar, porque
o ContextProvider engole o erro) fica para a Fase 4b, onde as funções do contexto passam a propagar.
Os 2 warnings de exhaustive-deps no ficheiro (efeitos "correr ao mudar de id / à montagem") também se
resolvem melhor em 4b, ao estabilizar as funções do contexto.

---

## 2026-07-16 — Refactor SOLID/Clean Code: Fase 4b (dividir o ContextProvider)

### Decisão de âmbito
Contextos separados por domínio (ISP puro) obrigariam a tocar nos 14 consumidores de `useContext`,
em código sem testes, e o único ganho — evitar re-renders — é teórico aqui (o tabuleiro do utente e
o monitor do staff nunca estão no mesmo ecrã). Optou-se por **dividir a lógica interna em hooks por
domínio, mantendo um único `Context`** — ganha-se SRP e testabilidade, zero alterações nos
consumidores. Separação total de contextos fica para se algum dia houver problema de performance real.

### Alterações — `Client/src/`
- **`state/useBotoesState.js`, `useUtentesState.js`, `usePedidosState.js`, `useStaffAuthState.js`**
  (novos) — cada um detém o estado e as operações do seu domínio. O `ContextProvider.jsx` passou de
  256 linhas (monólito) a ~90, compondo os 4 hooks (`{...botoesState, ...utentesState, ...}`) e
  mantendo só a orquestração transversal: gating das leituras só-staff, refetch ao mudar de utente,
  e a integração socket.io.
- **Mutações propagam o erro (throw)** — as funções deixaram de fazer `catch → console.error` e
  devolver `undefined`. Quem chama trata o erro. Concretamente fecha o bug do tabuleiro: o
  `SuccessModal` aparecia **mesmo se o POST falhasse**; agora `enviarPedido` faz `await` e só mostra
  o modal quando o envio resolve (`TabuleiroComunicacao`).
- **Callbacks estáveis (`useCallback`)** — as operações dos hooks são estáveis, o que (a) permitiu
  listar as funções nas dependências dos efeitos do provider sem causar re-execuções/reconexão do
  socket, e (b) **limpou os 2 warnings de exhaustive-deps** do `TabuleiroComunicacao` (as funções
  entram agora nas deps dos efeitos `[id]`/montagem sem os fazer re-correr).
- **Estratégia de atualização uniformizada** — todas as mutações confiam no broadcast `bd_alterado`
  do socket para re-sincronizar; as atualizações otimistas locais mantêm-se só onde já existiam e são
  baratas (listas de botões/utentes), por consistência com o código anterior.

### Estado
`npm run lint`: 0 erros, 4 warnings (todos pré-existentes e alheios: PedidosTV/`fila`,
PedidosPendentes/`handleVoltar`, e os 2 fast-refresh de UtenteAvatar/ContextProvider — este último
exigiria mover o `Context` para ficheiro próprio e tocar nos 14 imports). `vite build` OK.

### ⚠️ Verificação pendente (4b)
Testar no browser os fluxos que passam pelo contexto: login/kiosk (entrar/sair da gaiola com PIN,
reload mantém sessão), criar/editar/eliminar utente e botão, tabuleiro (enviar pedido, SOS on/off,
"Estou Bem"), monitor de pedidos, e a sincronização em tempo real entre dois dispositivos (socket).

---

## 2026-07-16 — Refactor SOLID/Clean Code: Fase 5 (varredura final)

### Alterações
- **i18n completo** — extraídas as strings de todos os ficheiros que as fases 1–4 não tinham tocado:
  `BotaoForm`, `BotoesList`, `CategoriaDropdown`, `ConflitoImagemModal`, `EditBotoes`, `UtenteForm`,
  `EditUtente`, `NewUtente`, `StaffLogin`, `ChangePassword`, `Welcome`, `StaffSidebar`, `navItems`,
  `RequestListDrawer`, `PedidosPhone`, `PedidosTV`, `StaffHome`. O `i18n/pt.js` passou a ter 191
  linhas em secções por funcionalidade (`common`, `welcome`, `auth`, `nav`, `tabelaEditor`,
  `tabelasView`, `staffHome`, `botoes`, `categoria`, `conflitoImagem`, `utentes`, `pedidos`,
  `tabuleiro`). **Zero strings PT hardcoded em JSX** (verificado por grep).
- **Bug encontrado e corrigido** — o `StaffHome` mostrava a string literal **"Quarto Geral"** em
  todos os cartões (no cartão e no subtítulo do menu ⋮), em vez do `utente.quarto` real — que já era
  mostrado corretamente no `TabelasView` e na pré-visualização do formulário. Era texto de
  placeholder que ficou por substituir.
- **Reutilização** — `BotoesList` passou a usar o `SearchInput` partilhado (era o 3.º sítio com o
  mesmo input+ícone); `EditBotoes` extraiu `CATEGORIAS_BASE`/`FORM_VAZIO` para constantes;
  `RequestListDrawer` deixou de ter dois `useContext(Context)` separados.
- **`CLAUDE.md` atualizado** — estrutura de ficheiros do Client (i18n/, state/, hooks/, constants.js,
  primitivos partilhados) e do Server (errorHandler, uploads, imageController, applyTemplate;
  `routes/images.js` e `views/` removidos); nova secção "Table editor structure"; nova secção
  "Error handling (Server)"; nova secção **"Code Conventions"** (inglês no código, PT nas fronteiras
  API/BD, texto via i18n, preferir partilhados); endpoints removidos documentados; limitações
  conhecidas reescritas (ESLint agora configurado; mass assignment, leak de `erro.message` e
  `/localIP` marcados como corrigidos).

### Estado final do refactor (Fases 0–5)
| Ficheiro | Antes | Depois |
|---|---|---|
| `TabelaEditor.jsx` | 1138 | 342 |
| `TabuleiroComunicacao.jsx` | 407 | 223 |
| `ContextProvider.jsx` | 256 | 87 |
| `route.js` | 203 | ~70 (só routing) |

`npm run lint`: 0 erros, 4 warnings conhecidos. `vite build` OK. Módulos do Server carregam OK.

### ⚠️ Nota final
Continua sem testes automatizados — toda a verificação deste refactor foi estática (lint, build,
carregamento de módulos) + revisão. Os fluxos de UI (sobretudo gestos do editor, kiosk/PIN e
sincronização por socket) precisam de ser exercitados no browser antes de ir para o Pi.

---

## 2026-07-21 — Autorização por-utente (token real do tabuleiro) — Fase 1: fundação servidor

### Contexto
Item de "Alto" do `SECURITY_CHECKLIST.md`: o `PUT /pedidos/:id` não verifica o dono (qualquer
cliente muda o estado de qualquer pedido por id) e o "token" do utente na URL é obfuscação reversível
(cifra de Feistel com a chave no bundle), não uma credencial. Os dois itens têm a mesma raiz — o
tabuleiro não tem identidade verificável — por isso decidiu-se resolvê-los juntos com a **variante
completa**: dar a cada utente um `accessToken` real (segredo imprevisível na URL) que é trocado por
uma **sessão de tabuleiro** (cookie httpOnly), espelhando o padrão do `StaffSession`. A partir daí o
board deriva o `utenteId` da sessão (verificada no servidor), nunca da URL, tornando
`pedido.utenteId === utenteDaSessão` uma verificação inforjável.

Plano em fases (esta entrada = Fase 1): **1** fundação servidor; **2** rotas `/board/*` de dados +
fechar as rotas antigas por-id + autorização do `updatePedido`; **3** cliente (bootstrap, `api/board`,
remover Feistel, rota `/board/:accessToken`); **4** docs; **5** UI staff de copiar-URL/rotacionar
token (commit isolado, rollback fácil). Rota do board decidida: prefixo **`/board`**.

### Feito nesta fase (nada do comportamento antigo mudou ainda)
- **`migrations/20260721120000-add-access-token-to-utentes.js`** — coluna `accessToken` (NOT NULL,
  índice único) + **backfill** dos utentes existentes com tokens aleatórios. Idempotente (guardas em
  cada passo). **Gotcha MariaDB:** as queries raw precisam de `type: QueryTypes.SELECT/UPDATE`
  explícito — sem isso o conector `mariadb` rebenta com `Cannot delete property 'meta'`.
- **`models/Utente.js`** — campo `accessToken`; hook `beforeValidate` que o gera (invariante "todo o
  utente tem token" fica no modelo, não no controller); `defaultScope` que **exclui** o `accessToken`
  de todas as leituras (é segredo; algumas rotas de leitura são abertas). Para o incluir usa-se
  `Utente.unscoped()` (Fase 3, roster do staff).
- **`models/UtenteSession.js`** (novo, via `sync()` como o `StaffSession`) — `tokenHash` (SHA-256) +
  `utenteId` + `expiraEm`. Registado em `models/index.js` e `main.js`.
- **`Util/utenteSessions.js`** — `criarSessaoUtente` (devolve o token em claro para o cookie),
  `validarSessaoUtente` (devolve a sessão ou null, limpeza preguiçosa), `revogarSessaoUtente`,
  `revogarSessoesDoUtente`.
- **`middleware/auth.js`** — `identifyStaff` e `identifyUtente` (não-bloqueantes, põem `req.isStaff` /
  `req.utenteId`) + `requireUtente` (bloqueante).
- **`controller/boardController.js` + rotas** — `POST /board/session` (troca o `accessToken` por uma
  sessão, cookie httpOnly assinado, 30 dias) e `POST /board/logout` (revoga).

### Teste
Migration corrida no MariaDB de dev: coluna `NOT NULL`+`UNIQUE`, os 2 utentes existentes com tokens
únicos de 64 chars. Servidor reiniciado (a tabela `UtenteSessions` cria via `sync()` sem erros).
Script node (contra a BD/servidor reais, depois apagado, sessões de teste limpas) — 12 asserções,
todas PASS:
- bootstrap com token válido → 200 + cookie `httpOnly`; devolve o `id` certo;
- a sessão valida no servidor e aponta para o `utenteId` correto; a BD guarda o **hash**, não o token;
- `accessToken` inválido → 404; em falta → 400;
- `GET /utentes/:id` (rota aberta) **não** expõe o `accessToken` (defaultScope);
- `POST /board/logout` revoga — o mesmo cookie deixa de validar.

### Próximo (Fase 2)
Rotas `/board/*` de dados (utente, pedidos, tabela — o utente vem da sessão), fechar as rotas antigas
por-id com `requireStaff`, e autorização no `updatePedido` (`req.isStaff` OU
`req.utenteId === pedido.utenteId`).

---

## 2026-07-21 — Autorização por-utente — Fase 2: rotas `/board/*` de dados (aditivo)

### Refinamento ao plano
Para cada commit ficar sempre funcional (melhor para rollback por fase), a Fase 2 é **puramente
aditiva**: adiciona as rotas `/board/*` de dados sem tocar nas antigas. O **fechar** das rotas antigas
por-id passou para a Fase 4 — depois de o cliente (Fase 3) já não as usar. Assim nenhum commit
intermédio parte a app.

### Feito
Handlers novos em `controller/boardController.js` + rotas em `routes/route.js`, todos atrás de
`identifyUtente` + `requireUtente` (o `utenteId` vem **da sessão**, nunca da URL):

| Rota | O quê |
|---|---|
| `GET /board/utente` | O utente da sessão + os seus pedidos pendentes (com botão) |
| `GET /board/pedidos` | Os pedidos pendentes do utente da sessão |
| `GET /board/tabela/:dispositivo` | O layout do utente da sessão (valida o dispositivo contra `DEVICES`) |
| `POST /board/pedidos` | Cria pedido com `utenteId` **forçado pela sessão** (corpo whitelisted a `botaoId`/`emergencia`) |
| `PUT /board/pedidos/:id` | Muda o estado **só se `pedido.utenteId === req.utenteId`** (senão 403); estado validado |

### Mapa de consumidores no cliente (para as fases 3/4)
- `GET /utentes/:id` → só board → `/board/utente`
- `GET /pedidos/utente/:id` → só board → `/board/pedidos`
- `GET /utentes/:id/tabela/:disp` → board **e** staff (GerirTabela) → board migra p/ `/board/tabela`;
  o staff mantém a antiga (passará a enviar credenciais quando for fechada com `requireStaff`)
- `POST /pedidos` → só board → `/board/pedidos`
- `PUT /pedidos/:id` → board (drawer + tabuleiro) **e** staff (PedidosPendentes) → board migra p/
  `/board/pedidos/:id`; o monitor mantém `/pedidos/:id` (com credenciais)

### Teste
Servidor reiniciado; script node (contra a BD/servidor reais, com 2 utentes A/B, depois apagado e
sessões limpas) — 18 asserções, todas PASS:
- sem sessão, todas as `/board/*` → **401**;
- com a sessão do A → `/board/utente`/`/board/pedidos`/`/board/tabela` devolvem só dados do A; o
  `accessToken` **não** vaza;
- `POST /board/pedidos` cria com o `utenteId` da sessão mesmo tentando **injetar** outro no corpo;
- **posse:** A atualiza o pedido do A (200); A tenta o pedido do B → **403** e o pedido do B fica
  intacto; estado/dispositivo inválidos → 400;
- rotas antigas (`GET /botoes`, `GET /utentes/:id`) continuam a responder — a fase é aditiva.

### Próximo (Fase 3)
Cliente: bootstrap da sessão ao abrir o tabuleiro, `api/board` a usar `/board/*`, `StaffHome` a
navegar para `/board/<accessToken>`, remover a cifra de Feistel (`utils/utenteToken.js`) e ajustar a
rota do `App.jsx`. (O staff — GerirTabela, PedidosPendentes — passa a enviar credenciais nas leituras
que serão fechadas na Fase 4.)

---

## 2026-07-21 — Autorização por-utente — Fase 3: cliente migra para a sessão de tabuleiro

### Feito
O tabuleiro do utente deixa de derivar o id de um token na URL — passa a fazer *bootstrap* de uma
sessão (cookie) e a ler/escrever pelas rotas `/board/*`. A cifra de Feistel desapareceu.

- **`api/board.js` (novo)** — `bootstrapBoard(accessToken)` (troca o segredo da URL por uma sessão),
  `fetchBoardUtente`/`fetchBoardPedidos`/`fetchBoardTabela`, `createBoardPedido`, `updateBoardPedido`.
  Todas com credenciais.
- **`Pages/TabuleiroComunicacao.jsx`** — lê `:accessToken` da URL, faz `bootstrapBoard` ao entrar e só
  depois carrega os dados (via `/board/*`); largou `idDoToken` e o `utenteId: utente.id` na criação de
  pedidos (o servidor força-o). `updatePedido` → `updatePedidoBoard`.
- **`state/usePedidosState.js`** — `fetchPedidosUtilizador`/`postPedido` passam a `/board/*`; separa
  `updatePedidoBoard` (tabuleiro) de `updatePedido` (monitor de staff, agora com credenciais).
  **`state/useUtentesState.js`** — `fetchUtente()` passa a `/board/utente` (sem id).
- **`ContextProvider.jsx`** — as buscas do tabuleiro deixam de passar id.
- **`Components/RequestListDrawer.jsx`** — usa `updatePedidoBoard`.
- **`api/pedidos.js`** — removidas `fetchPedidosUtente`/`createPedido` (agora no board); `updatePedido`
  passa a enviar credenciais (staff). **`api/tabela.js`** — `fetchTabela` (editor de staff) passa a
  enviar credenciais. **`api/utentes.js`** — removida `fetchUtente`.
- **`Pages/StaffHome.jsx`** — `handleOpen` navega para `/board/<utente.accessToken>` (sem Feistel).
  **Servidor `utenteController.getAllUtentes`** — `Utente.unscoped()` para o roster (staff) incluir o
  `accessToken` que o `StaffHome` precisa para construir a URL.
- **`App.jsx`** — rota `/:token` → `/board/:accessToken`. **`state/useStaffAuthState.js`** — o check
  de "estou na gaiola" passa de `/main` para `/board` (agora bate certo).
- **Removido** `utils/utenteToken.js` (a cifra de Feistel).

### Teste
`vite build` OK. No browser (build servido pelo Express :3000), tabuleiro real via
`/board/<accessToken>`:
- rede confirma o novo fluxo — `POST /board/session` → `GET /board/utente`+`/board/pedidos`+
  `/board/tabela/{smartphone,tablet,pc}` (todos 200) e **nenhuma** rota antiga (`/utentes/:id`,
  `/pedidos/utente/:id`, `/utentes/:id/tabela/:disp`);
- clicar num botão → `POST /board/pedidos` → **201**; "Estou Bem" → `PUT /board/pedidos/:id` deixa o
  utente com **0 pedidos pendentes** (confirmado na BD);
- roster de staff (`GET /utentes`, sessão forjada) inclui o `accessToken` e continua **401** sem
  sessão. (A posse do `PUT /board/pedidos/:id` — 403 entre utentes — foi provada no script da Fase 2.)

### Próximo (Fase 4)
Fechar as rotas antigas por-id com `requireStaff` (`GET /utentes/:id`, `/pedidos/utente/:id`,
`/utentes/:id/tabela/:disp`, `PUT /pedidos/:id`) e remover `POST /pedidos` — o cliente já não as usa.
Depois, docs (CLAUDE.md, SECURITY_CHECKLIST) e nota operacional da Pi (migration + URLs dos tablets
mudam).

---

## 2026-07-21 — Autorização por-utente — Fase 4: fechar rotas antigas + docs

### Feito (servidor)
Com o cliente já a usar `/board/*` (Fase 3), fecharam-se as rotas antigas por-id em `routes/route.js`:
- `GET /utentes/:id`, `GET /pedidos/utente/:utenteId`, `GET /utentes/:id/tabela/:dispositivo` →
  `requireStaff` (o tabuleiro usa `/board/utente`, `/board/pedidos`, `/board/tabela`; o editor de
  staff mantém as antigas, com credenciais).
- `PUT /pedidos/:id` → `requireStaff` (fica só para o monitor de staff resolver qualquer pedido).
- `POST /pedidos` **removido** (o tabuleiro cria em `/board/pedidos`); o handler morto
  `pedidoController.createPedido` foi apagado.
- **Higiene:** o *SPA fallback* (`main.js`) passa a servir o `index.html` só em `GET` — pedidos
  não-GET a caminhos desconhecidos (ex.: o `POST /pedidos` agora inexistente) dão **404** em vez de
  devolver HTML com 200.

Com isto, **não sobra nenhum endpoint aberto por-id** — a enumeração por reversão do token deixa de
existir, e o `PUT` cross-utente é bloqueado (403). Os dois itens 🟠 High (posse do `PUT /pedidos/:id`
e token-como-obfuscação) ficam fechados.

### Feito (docs)
- **CLAUDE.md** — "Two Authentication Paths" reescrito (agora descreve a sessão de tabuleiro real);
  nova secção de endpoints **Board**; tags de auth atualizadas (`/utentes/:id`, `/pedidos/utente/:id`,
  `/utentes/:id/tabela/:d`, `PUT /pedidos/:id` → `requireStaff`; `POST /pedidos` removido); estrutura
  de ficheiros (add `UtenteSession.js`, `boardController`, `Util/utenteSessions.js`, `api/board.js`;
  removido `utils/utenteToken.js`); "Known security gaps" — os dois High marcados como fixos + nota
  operacional.
- **README.md / README.pt.md** — o tabuleiro passa a descrever-se como `/board/:accessToken` (token de
  acesso real trocado por sessão), não `/main/:token` ofuscado (diagrama + texto).

### Teste
Servidor reiniciado; script node (com sessões de staff e de tabuleiro forjadas, depois limpas):
- sem sessão → `GET /utentes/:id`, `/pedidos/utente/:id`, `/utentes/:id/tabela/:d` e `PUT /pedidos/:id`
  dão **401**; `POST /pedidos` dá **404**;
- com sessão de **staff** → essas rotas respondem (o `PUT` resolve um pedido → 200);
- com sessão de **tabuleiro** → `GET /board/utente` → 200; `GET /botoes` (aberto) → 200.
Confirmado ainda por `curl` que a navegação SPA `GET /board/<token>` continua a servir o index (200) e
no browser que o tabuleiro real carrega sem 401 (usa só `/board/*` + `/botoes`).

### Operacional (Pi) — obrigatório no deploy
1. Correr a migration (`npx sequelize-cli db:migrate`) — adiciona `accessToken` + backfill.
2. **As URLs dos tablets mudam** (token Feistel → `/board/<accessToken>`): reabrir/rebookmarkar cada
   tablet a partir do console de staff depois do deploy.

### Próximo (Fase 5, commit isolado p/ rollback fácil)
UI de staff: copiar a URL do tabuleiro + rotacionar o `accessToken` (endpoint `POST
/utentes/:id/rotate-token` + ação no `StaffHome`).

---

## 2026-07-21 — Autorização por-utente — evitar acumulação de sessões de tabuleiro

### Problema
O tabuleiro faz *bootstrap* (`POST /board/session`) a **cada carregamento** da página (é assim que
fica autenticado indefinidamente a partir do `accessToken` no URL). Como o bootstrap criava sempre
uma linha nova em `UtenteSession`, as antigas ficavam órfãs — o seu cookie era substituído, por isso
`validarSessaoUtente` nunca era chamado sobre elas e a limpeza preguiçosa nunca disparava. Num tablet
reaberto muitas vezes, as linhas acumulavam sem limite.

### Correção (mantém o fluxo — utente autenticado indefinidamente)
- **Reutilização + renovação deslizante** (`boardController.createSession`): se o pedido já traz um
  cookie `utente_session` válido e do **mesmo** utente, reutiliza essa sessão e estende o `expiraEm`
  (`renovarSessaoUtente`, +30 dias) em vez de criar linha nova. Só cria nova no 1º acesso ou se o
  cookie estiver ausente/expirado/inválido. Efeito: 1 linha por tablet, e enquanto o tablet for usado
  dentro de qualquer janela de 30 dias **nunca expira**. Multi-tablet no mesmo utente continua a
  funcionar (a reutilização é por-cookie).
- **Varrimento no arranque** (`main.js`): `purgarExpiradas()` (novo em `Util/sessions.js` e
  `Util/utenteSessions.js`) apaga as sessões já expiradas — limpa a acumulação histórica e o caso raro
  de cookie limpo. Aplicado a `StaffSession` e `UtenteSession` por simetria.

### Teste
Script node (BD/servidor reais) — 10 asserções, todas PASS: 1º bootstrap cria 1 sessão; 2º bootstrap
com o cookie **reutiliza** (continua 1, mesmo `tokenHash`, `expiraEm` renovado); sem cookie ou com
cookie inválido cria nova; `purgarExpiradas` remove a expirada e mantém as válidas. Confirmado no
browser: 2 carregamentos do tabuleiro → **1** linha em `UtenteSession` (antes seriam 2).

---

## 2026-07-21 — Autorização por-utente — Fase 5: UI de copiar URL + rotacionar accessToken

### Contexto
Última fase (commit isolado, para rollback fácil). Com o `accessToken` a ser uma credencial real,
o staff precisa de duas ações de ciclo de vida: **copiar a URL do tablet** (para configurar/rebookmarkar
dispositivos — a URL é uma string aleatória que não se decora) e **rotacionar** o token (revogação:
tablet perdido/URL vazada).

### Feito (servidor)
- `POST /utentes/:id/rotate-token` (`requireStaff`) → `utenteController.rotateToken`: gera um
  `accessToken` novo, chama `revogarSessoesDoUtente(id)` (corta os tablets com o URL antigo) e
  `notificarAlteracaoBD` (o roster de staff refresca com o token novo). Devolve `{ accessToken }`.

### Feito (cliente)
- `api/utentes.js` — `rotateUtenteToken(id)`.
- `i18n/pt.js` — `staffHome.{copyUrlDone,copyUrlError,rotateConfirm,rotateDone,rotateError}` +
  secção `itemMenu.{copyUrl,rotateToken}`.
- `Components/layout/ItemMenu.jsx` — duas ações novas opcionais (`onCopyUrl` ícone `link`,
  `onRotateToken` ícone `autorenew`), rendidas no popover (desktop) e no bottom-sheet (mobile).
- `Pages/StaffHome.jsx` — `handleCopyUrl` (copia `${origin}/board/${accessToken}` para o clipboard +
  toast) e `handleRotate` (confirma → rota → copia logo o URL novo → toast); usa `useFeedback` +
  `FeedbackToast`. Liga as duas ações ao `ItemMenu` de cada cartão.

### Teste
`vite build` OK. Endpoint verificado por script node (BD/servidor reais) — 9 asserções, todas PASS:
sem sessão de staff → **401**; com staff → **200** e devolve um `accessToken` novo (64 hex, diferente),
gravado na BD; o URL **antigo** deixa de abrir o board (`POST /board/session` → **404**) e o **novo**
abre (**200**); as sessões de tabuleiro antigas ficam **revogadas**; id inexistente → **404**.
**Nota:** o UI do `StaffHome` está atrás do gate `RequireStaff` (PIN de staff), por isso as ações
(botões no menu, copiar/rotacionar, toasts) foram verificadas por build + endpoint, não *click-testadas*
no browser. O clipboard pode falhar por permissões no ambiente — o código trata disso com toast de erro
(copiar) ou ignorando a falha de cópia mas mantendo o link ativo (rotacionar).

### Estado do plano
Fases 1–5 concluídas. Os dois itens 🟠 High (posse do `PUT` + token-como-obfuscação) estão fechados;
a autorização por-utente está completa (fundação, rotas, cliente, fecho das antigas, anti-acumulação,
e agora o ciclo de vida do token no UI de staff).

---

## 2026-07-22 — CORS restrito (REST + socket.io), sem camada de CSRF separada

### Contexto
Primeiro item 🟡 Médio: `Server/main.js` tinha `origin: (origin, cb) => cb(null, true)` — reflete
qualquer origem — combinado com `credentials: true`, e o socket.io com `cors: { origin: '*' }`.

### Análise (antes de corrigir)
- **CSRF já estava bastante mitigado** pelo `sameSite: "lax"` dos cookies (bloqueia o browser de
  anexar o cookie em `fetch`/`XHR` cross-site, exceto navegação de topo por `GET`) — por isso decidiu-se
  **não** adicionar uma camada de tokens CSRF separada; o fix do CORS é tratado como o fix do CSRF aqui.
- **Produção é sempre same-origin** (o Express serve o Client e a API na mesma origem, `:3000`) — só o
  Vite em dev (`:5173`→`:3000`) é genuinamente cross-origin.
- **Socket.io**: por não transportar dados sensíveis (só `bd_alterado`, sem payload, sem canais
  privados, sem eventos que o cliente possa emitir para o servidor), o risco de o deixar aberto é baixo
  — a classe clássica de vulnerabilidade (Cross-Site WebSocket Hijacking, roubar a sessão via socket
  para ler/escrever dados privilegiados) não se aplica, porque nada de privilegiado passa pelo socket.
  O risco real identificado foi **amplificação de DoS** (browsers de visitantes de um site malicioso a
  abrir ligações persistentes à Pi sem o visitante saber) — decidiu-se fechar por consistência e porque
  o custo é baixo.

### Correção — `Server/main.js`
Substituída a função "aceita tudo" por uma allowlist **dinâmica**, comparando o `Origin` do pedido
contra o `Host` real do pedido (não hardcoded por `NODE_ENV`) — funciona em qualquer IP/hostname sem
editar código, cobre produção (same-origin sempre) e qualquer cenário de teste local (browser a apontar
direto a `:3000`), com uma única exceção explícita fora de produção (`http://localhost:5173`, o Vite):
```javascript
function isOrigemPermitida(origin, host) {
    if (!origin) return true; // curl, scripts, same-origin em GET — CORS só existe p/ o browser
    let sameOrigin = false;
    try { sameOrigin = new URL(origin).host === host; } catch { sameOrigin = false; }
    const devOrigin = process.env.NODE_ENV !== 'production' && origin === 'http://localhost:5173';
    return sameOrigin || devOrigin;
}
```
Reutilizada como única fonte de verdade em dois sítios:
- **API REST** — via `cors(corsOptionsDelegate)` (o "options delegate" do pacote `cors`, que dá acesso
  ao `req` — ao contrário da forma simples `origin: (origin, cb) => ...`, que não tem `req.headers.host`).
- **Socket.io** — `io.use((socket, next) => ...)`, comparando `socket.handshake.headers.{origin,host}`.

### Teste
Servidor reiniciado; testado por `curl` (REST) e um script node com `socket.io-client` (socket.io),
todos contra o servidor real:
- **REST:** sem `Origin` → 200 (curl/scripts continuam a funcionar); `Origin: http://localhost:3000`
  (same-origin) → 200 com `Access-Control-Allow-Origin` presente; `Origin: http://localhost:5173`
  (dev) → 200 com o header presente; `Origin` de um site malicioso → 200 (o servidor processa; é o
  browser que bloqueia) mas **sem** `Access-Control-Allow-Origin` — confirmado também num preflight
  `OPTIONS` a uma rota de escrita.
- **Socket.io** (`socket.io-client`, transporte polling para os headers irem no handshake): sem
  `Origin` → liga; `Origin` same-origin → liga; `Origin` do Vite dev → liga; `Origin` malicioso →
  **rejeitado** (erro "Origem não permitida").
- **Fluxo do board ponta-a-ponta** (o cenário mais próximo de um browser real): bootstrap com
  `Origin: http://localhost:3000` → 200, cookie `httpOnly`+`SameSite=Lax` bem definido;
  `GET /board/pedidos` com esse cookie, same-origin → 200; o mesmo cookie com `Origin` malicioso →
  sem o header CORS (e, num browser real, o cookie nem seria enviado, dado o `SameSite=Lax`).

### Próximo
Restantes itens 🟡 Médio: validação de upload de imagens (magic bytes + `limits`, 10 MB acordado) e a
camada de validação de schema (zod, aplicada a `/board/*` primeiro).

---

## 2026-07-22 — Upload de imagens: magic bytes + limite de 10 MB

### Contexto
Segundo item 🟡 Médio: `Server/middleware/uploads.js` validava só por `mimetype` e extensão do nome
do ficheiro — ambos fornecidos pelo cliente e falsificáveis (um atacante podia enviar qualquer
ficheiro com nome/mimetype de `.png`). Sem `limits` no multer, um upload podia ser arbitrariamente
grande (DoS por esgotamento de disco).

### Correção — `Server/middleware/uploads.js`
- **`limits: { fileSize: 10 * 1024 * 1024, files: 1 }`** em ambos os `multer()` (ícones de botão e
  fotos de utente) — 10 MB acordado. O multer já limpa o ficheiro parcial sozinho quando o limite é
  excedido; o `MulterError` resultante já era apanhado pelo `errorHandler` central (400 genérico) —
  não foi preciso tocar nele.
- **`verifyImageSignature`** (novo middleware, sem dependências): corre **depois** do multer gravar o
  ficheiro (o `diskStorage` grava antes do `fileFilter` poder ver o conteúdo real). Lê os primeiros 8
  bytes do ficheiro gravado e compara com as assinaturas reais de PNG/JPEG/GIF; se não bater, apaga o
  ficheiro do disco e responde 400. Fecha o buraco de mimetype/extensão serem dados pelo cliente.
- **`routes/route.js`** — `verifyImageSignature` inserido na cadeia entre o multer e o controller, nas
  duas rotas de upload (`/imagesBotoes/upload`, `/imagesUtentes/upload`). Mantém a separação de
  responsabilidades: validação de upload fica no middleware, o controller só trata path/BD.

### Teste
Servidor reiniciado; testado por script node com `FormData`/`Blob` (simula exatamente o bypass do
`fileFilter`: mimetype e extensão corretos, conteúdo não é imagem), contra ambos os endpoints:
- **`/imagesBotoes/upload`** (5 asserções): PNG real de 1×1 → 2xx, devolve `path`, fica gravado em
  disco; ficheiro de texto renomeado para `.png` com `mimetype: image/png` → **400**, mensagem
  "não é uma imagem válida", e o ficheiro **não** fica em disco (apagado); ficheiro de 11 MB → **400**
  (limite do multer), também não fica em disco.
- **`/imagesUtentes/upload`** (3 asserções, storage com nome de ficheiro aleatório): mesmo padrão —
  foto real aceite e gravada, foto falsa rejeitada com 400.
Todas as 8 asserções PASS.

### Próximo
Último item 🟡 Médio: camada de validação de schema (zod, aplicada a `/board/*` primeiro).

## 2026-07-22 — Camada de validação de schema (zod) em `/board/*`

### Contexto
O whitelisting de campos (`pickUtenteFields`, `pickBotaoFields`, `{ estado }` desestruturado nos
controllers) já impedia mass assignment, mas não validava tipo/formato/tamanho do conteúdo — isso
ficava a cargo do Sequelize (só valida o schema da coluna) ou não era validado. Nas rotas `/board/*`
isto importava mais do que nas outras: são as únicas completamente abertas (sem `requireStaff`), com
input a vir diretamente do tablet. Casos concretos identificados: `POST /board/session` só verificava
`if (!accessToken)` — uma string arbitrariamente grande chegava ao `Utente.findOne({ where: {
accessToken } })` sem limite de tamanho; `POST /board/pedidos` não validava `botaoId` como inteiro nem
`emergencia` como boolean antes do `Pedido.create`, deixando erros de FK do driver percolarem até ao
`errorHandler` genérico em vez de um 400 previsível.

### Correção
- **`npm i zod`** (`Server/package.json`).
- **`Server/validation/schemas.js`** (novo) — schemas por endpoint: `boardSessionSchema` (`accessToken`
  = exatamente 64 hex chars, invariante de `crypto.randomBytes(32).toString("hex")` em
  `models/Utente.js`), `createPedidoSchema` (`botaoId` inteiro positivo, `emergencia` boolean
  opcional), `updatePedidoSchema` (`estado` = enum de `PEDIDO_STATES`).
- **`Server/middleware/validate.js`** (novo) — `validate(schema)`: corre `schema.safeParse(req.body)`
  antes do controller; falha → 400 `{ mensagem: "Dados inválidos" }` (nunca o erro interno do zod);
  sucesso → substitui `req.body` pelo resultado parseado, o que descarta automaticamente campos não
  declarados no schema (reforça o whitelisting existente, não o duplica — ex.: um `utenteId` forjado no
  corpo de `POST /board/pedidos` nunca chega ao controller, que de qualquer forma já o ignorava a favor
  de `req.utenteId`).
- **`routes/route.js`** — `validate(...)` inserido entre `identifyUtente`/`requireUtente` e o
  controller em `POST /board/session`, `POST /board/pedidos`, `PUT /board/pedidos/:id`.

### Teste
Servidor reiniciado; script node com `fetch` contra o servidor real (9 asserções, todas PASS):
`accessToken` curto/em falta → 400 "Dados inválidos" sem tocar na BD; `accessToken` com formato válido
mas inexistente → passa a validação, falha no lookup → 404 (confirma que o zod só valida forma, a
lógica de negócio continua no controller); `accessToken` real → 200 + cookie de sessão; `botaoId`
como string ou negativo → 400; pedido com `utenteId` forjado no corpo → 201 mas com o `utenteId` real
da sessão (campo extra descartado); `estado` inválido em `PUT /board/pedidos/:id` → 400; `estado`
válido → 200.

### Próximo
Não há mais itens agendados do checklist original. Itens 🟢 Low continuam por fazer e sem data: janela
de corrida no reset de `/auth/staff/setup`, PIN mínimo de 4 dígitos, custo de bcrypt (10), sem
`helmet`. Estender a validação zod às restantes rotas mutáveis (`/utentes`, `/botoes`, `/pedidos/:id`,
`/tabelas*`) fica em aberto para uma fase seguinte, a pedido do utilizador.

## 2026-07-22 — Correção de regressão: CORS do socket.io (polling sem `Access-Control-Allow-Origin`)

### Contexto
Reportado pelo utilizador via consola do browser em `localhost:5173` (Client em dev): todos os pedidos
de polling do socket.io a `localhost:3000/socket.io/...` falhavam com `No 'Access-Control-Allow-Origin'
header is present`, entrando em loop de reconexão. Causa: regressão do commit `a9df9a7` (fecho de CORS
REST + socket.io). Antes desse commit, `new Server(server, { cors: { origin: '*' } })` dava ao
socket.io o seu próprio tratamento de CORS para o transporte de polling (XHR normal, sujeito à mesma
política de origem do browser que qualquer `fetch`). O commit removeu essa opção `cors` por completo,
substituindo-a só por `io.use(...)` — mas `io.use()` valida a origem ao nível do handshake do
socket.io/engine.io, **não adiciona o header HTTP `Access-Control-Allow-Origin`** às respostas do
polling. São mecanismos diferentes; tratar o `io.use()` como suficiente foi o erro. O transporte de
polling do socket.io é servido pelo engine.io diretamente sobre o `http.Server`, sem passar pelo `app`
do Express — por isso o `cors()` montado em `app.use()` nunca chega a correr para `/socket.io/*`.

### Correção — `Server/main.js`
- `corsOptionsDelegate` passou a ler `req.headers.origin` em vez de `req.header('Origin')` (método do
  Express) — assim a mesma função serve tanto o `cors()` do Express como o middleware de CORS interno
  do engine.io, que corre sobre o `req` cru do Node (sem `req.header()`).
- `new Server(server, { cors: corsOptionsDelegate })` — o engine.io chama internamente
  `require('cors')(this.opts.cors)`, e o pacote `cors` aceita uma função como argumento único (o mesmo
  padrão "options delegate" já usado no `app.use(cors(corsOptionsDelegate))`), por isso a mesma
  `isOrigemPermitida()` fica a ser a única fonte de verdade, reutilizada nos três sítios (REST, cors do
  engine.io, `io.use()`).
- `io.use(...)` mantido tal como estava — cobre o handshake do socket e o upgrade para WebSocket, que
  não passam pela opção `cors` acima.

### Teste
Servidor reiniciado; `curl -i` com `Origin` diferentes contra `/socket.io/?EIO=4&transport=polling`:
origem do Vite (`localhost:5173`) → `200` + `Access-Control-Allow-Origin: http://localhost:5173`;
same-origin (`localhost:3000`) → `200` + header equivalente; origem não permitida
(`evil.example.com`) → `200` mas **sem** `Access-Control-Allow-Origin` (o browser bloqueia a leitura da
resposta). Repetido em `/auth/staff/status` (REST) para confirmar que não houve regressão aí. Sem
erros no log do servidor.

### Próximo
Nenhum item novo agendado — este era um bug de regressão na correção de CORS já fechada, não um item
do checklist original.

## 2026-07-23 — Camada de validação de schema (zod) nas rotas `requireStaff`

### Contexto
Primeiro item 🟡 Médio a seguir ao fecho do checklist original: `/board/*` já validava com zod
(2026-07-22), mas `/utentes`, `/botoes`, `/pedidos/:id` e `/tabelas*` continuavam só com o
whitelisting de campos existente — sem validar tipo, formato ou tamanho. Estas rotas exigem
`requireStaff`, por isso a superfície não é "qualquer pessoa na internet", mas uma sessão de staff
comprometida (cookie roubado, bug no cliente) ainda passava sem qualquer travão. Riscos concretos
identificados: colunas `STRING` (`VARCHAR(255)` no MariaDB) sem limite de tamanho no lado do servidor
— um valor maior do que a coluna aguenta gera um `SequelizeDatabaseError` (500 genérico do
`errorHandler`) em vez de um 400 previsível; e, mais grave, `tabelaController.saveTabela` e
`tabelaPadraoController.create/update` gravavam `config`/`configs` sem validar a forma interna (`cols`,
`cells`, `spans` — ver "Variable-Size Buttons" no `CLAUDE.md`) — o `useGridGeometry.js` do lado do
cliente (editor, preview *e* tabuleiro do utente) assume essa forma sem validação defensiva, por isso
um payload malformado só rebentava mais tarde, a renderizar o tabuleiro de um paciente específico
(negar a um utente o próprio dispositivo de comunicação). `POST /tabelas-padrao/:id/aplicar` agravava
isto: um `configs` malformado propaga-se a todos os utentes a quem o template for aplicado.

### Correção
- **`Server/validation/schemas.js`** — novos schemas: `createUtenteSchema`/`updateUtenteSchema`
  (`nome`/`quarto` não-vazios, `max(255)`; `corAvatar` hex `#rrggbb` **ou string vazia** — ver nota de
  teste abaixo; `templateId` inteiro positivo opcional), `createBotaoSchema`/`updateBotaoSchema`
  (`nome`/`mensagem`/`categoria` não-vazios, `max(255)`), `tabelaConfigSchema` (`cols` inteiro
  positivo, `size` enum `P|M|G` opcional, `cells` array, `spans`/`coresCategoria` objetos opcionais,
  com `.passthrough()` para não travar em chaves futuras — o formato é deliberadamente
  retrocompatível), `saveTabelaSchema` (`{ config }`), `createTabelaPadraoSchema`/
  `updateTabelaPadraoSchema` (`{ nome, configs }`, `configs` = o mesmo schema de config por cada um
  dos 3 dispositivos), `aplicarTemplateSchema` (`utenteId` inteiro positivo). `updatePedidoSchema`
  (já existente, criado para `/board/pedidos/:id`) reaproveitado tal e qual em `PUT /pedidos/:id`
  (staff) — mesmo enum de `PEDIDO_STATES`.
- **`routes/route.js`** — `validate(schema)` inserido antes do controller em `POST /utentes/create`,
  `PUT /utentes/:id`, `POST /botoes`, `PUT /botoes/:id`, `PUT /utentes/:id/tabela/:dispositivo`,
  `POST /tabelas-padrao`, `PUT /tabelas-padrao/:id`, `POST /tabelas-padrao/:id/aplicar`,
  `PUT /pedidos/:id`.

### Nota (bug apanhado antes de testar)
Ao inspecionar `EditUtente.jsx` antes de escrever os testes, reparei que ele manda sempre
`corAvatar: ''` (nunca `null`/omitido) quando o utente ainda não tem cor escolhida — um schema com só
`z.string().regex(hex)` teria rejeitado isto com 400 e partido a edição de qualquer utente sem cor
definida. Corrigido para `z.union([z.literal(""), regexHex])` antes de sequer correr os testes.

### Teste
Servidor reiniciado; script node com sessão de staff forjada (`criarSessao()` + `cookie-signature`,
mesmo padrão de testes usado nas fases anteriores) contra o servidor real (17 asserções, todas PASS):
`createUtente` válido com `corAvatar: ''` → 201; `nome` de 300 chars → 400; `nome` vazio → 400;
`corAvatar` inválido (`"not-a-color"`) → 400; `PUT /utentes/:id` no formato exato do
`EditUtente.jsx` (`imagem`/`corAvatar` vazios + campos extra como `id`/`createdAt`/`pedidos`/`botoes`
espalhados no corpo, que o schema descarta silenciosamente) → 200; `createBotao` válido → 201; sem
`categoria` → 400; `PUT /pedidos/:id` com `estado` inválido → 400 antes mesmo do 404 de "não
encontrado"; `saveTabela` com config válido → 200, com `cols` string → 400, com `cells` não-array →
400; `createTabelaPadrao` válido → 201; `aplicar` sem `utenteId` → 400, com `utenteId` válido → 200.
Sem erros no log do servidor.

### Próximo
Restam dois itens 🟡 Médio: upload sobrescreve ficheiros com o mesmo nome fora do fluxo
`?onConflict=rename`; nenhum agendado ainda pelo utilizador.

## 2026-07-23 — Upload de ícones de botão: conflito de nome decidido pelo servidor

### Contexto
Último item 🟡 Médio: `POST /imagesBotoes/upload` (biblioteca partilhada de ícones, estrutura plana)
sobrescrevia silenciosamente um ficheiro existente sempre que o nome coincidia e `onConflict` não era
`"rename"`. A deteção de colisão vivia inteiramente no cliente (`EditBotoes.jsx`), contra uma lista em
memória (`imagensDisponiveis`) obtida uma vez ao abrir o editor — o servidor nunca verificava o disco
antes de escrever. Duas consequências: (1) corrida legítima — duas sessões de staff a carregar imagens
ao mesmo tempo, ou uma sessão com o editor aberto há um bocado enquanto outra pessoa carrega um
ficheiro com o mesmo nome, e a substituição acontece sem o modal de decisão alguma vez aparecer; (2)
qualquer sessão de staff podia ignorar a UI e chamar o endpoint diretamente com um nome já existente —
o servidor aceitava e substituía sempre, trocando o ícone de qualquer botão já em uso (potencialmente
visível a todos os utentes) sem exigir mais privilégio do que gerir botões já exige.

### Correção
- **`Server/middleware/uploads.js`** (`botaoImageStorage.filename`) — passa a verificar
  `fs.existsSync` no disco real, no momento da escrita: se o nome já existe e `onConflict` não for
  `"replace"` nem `"rename"`, recusa com `err.status = 409` (multer só abre o stream de escrita depois
  deste callback devolver — confirmado em `node_modules/multer/storage/disk.js`, por isso nada fica
  gravado). `onConflict=replace` e `onConflict=rename` continuam a funcionar tal como antes, mas agora
  só disparam quando pedidos explicitamente pelo request atual, nunca por omissão.
- **`Client/src/api/botoes.js`** (`uploadImagemBotao`) — deixou de ter `onConflict` por omissão
  (`'replace'`); um 409 é convertido num erro com `err.conflito = true` para o chamador distinguir de
  uma falha genérica.
- **`Client/src/Components/botoes/EditBotoes.jsx`** — `handleUploadImagem` deixou de pré-verificar
  `imagensDisponiveis`; tenta sempre o upload sem `onConflict` e só mostra o `ConflitoImagemModal`
  quando o servidor responde 409 (`enviarImagem` apanha `err.conflito`). O fluxo passa a ser reativo ao
  estado real do servidor, não preditivo a partir de uma lista que podia estar desatualizada.

### Teste
Servidor reiniciado; script node com upload multipart real (`FormData`/`Blob`) contra
`/imagesBotoes/upload` com sessão de staff forjada (4 asserções, todas PASS): 1º upload de um nome novo
sem `onConflict` → 200, fica em disco; 2º upload do mesmo nome sem `onConflict` → **409**, `mtime` do
ficheiro original inalterado (confirma que nada foi escrito); `onConflict=rename` → 200, cria
`nome(1).png`, original continua intacto; `onConflict=replace` → 200, `mtime` muda (substituição agora
explícita). Log do servidor mostra o 409 a passar pelo `errorHandler` central como esperado, sem
comportamento inesperado.

### Próximo
Não há mais itens 🟡 Médio agendados. Ficam os 🟢 Low por fazer, sem data: janela de corrida no reset de
`/auth/staff/setup`, PIN mínimo de 4 dígitos, custo de bcrypt (10), sem `helmet`.

## 2026-07-23 — `/auth/staff/setup`: fecha a corrida de dois pedidos simultâneos

### Contexto
Primeiro item 🟢 Low: `POST /auth/staff/setup` (sem autenticação — é o próprio arranque, não há PIN
ainda para validar contra) fazia `if (await StaffAuth.findOne()) return 409; ... StaffAuth.create(...)`
sem nada a impedir que dois pedidos verdadeiramente simultâneos passassem ambos o `findOne()` antes de
qualquer um criar a linha, resultando em duas linhas em `StaffAuth` (que devia ter sempre uma só, mas
não tinha nenhuma constraint da BD a impor isso). Esta é só a metade do problema que dá para fechar por
código: a janela mais realista (staff apaga a linha para reset do PIN, e outro dispositivo na mesma
rede chega primeiro a configurar um novo PIN) é uma questão de "quem chega lá fisicamente primeiro" e
fica como está, documentada como limitação operacional aceite — o fix aqui é só para a corrida de
milissegundos entre dois pedidos concorrentes.

### Correção — `Server/controller/authController.js`
- `setup` passa a fazer o `findOne`+`create` dentro de uma transação com isolamento **SERIALIZABLE**
  (`sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, ...)`).
- Confirmado em teste direto contra a BD real: quando duas transações SERIALIZABLE colidem desta forma
  (ambas leem "vazio", ambas tentam inserir), o MariaDB não as serializa silenciosamente — mata uma
  delas com `ER_LOCK_DEADLOCK` (errno 1213). Por isso `setup` apanha esse erro especificamente
  (`_isRaceError`, também cobre `ER_LOCK_WAIT_TIMEOUT`) e **repete a transação inteira** (não só uma
  leitura a seguir ao catch — nessa altura a vencedora podia ainda não ter feito commit, dando um falso
  "não foi corrida nenhuma") até 3 vezes, com um pequeno backoff. Na repetição, uma nova transação já vê
  a linha da vencedora e devolve 409 corretamente. Pedidos sem corrida (o caso normal) não passam por
  nenhum retry — a transação segue o caminho de sempre.

### Teste
Servidor reiniciado; antes de testar, guardei a linha real de `StaffAuth` (id, hash, timestamps) para o
caso de precisar de a apagar. Script node contra o servidor real: password fraca → 400, nada criado;
setup normal (sem corrida) → 200, 1 linha; setup outra vez (já configurado) → 409, continua 1 linha;
**5 pedidos verdadeiramente simultâneos** (`Promise.all`) → exatamente 1× `200`, 4× `409`, e **1 única
linha** na BD no final (confirmado por query direta). A 1ª tentativa deste teste, sem isolar do rate
limiter (`staffAuthLimiter`, já existente — 5 falhas/10min/IP), misturou `429` a meio por causa de
chamadas anteriores do próprio script, não da lógica nova; reiniciar o servidor (limpa o rate limiter,
que é em memória) e isolar só o teste da corrida confirmou o resultado limpo. Repus a linha original de
`StaffAuth` no fim (mesmo id e hash — só `updatedAt` mudou, cosmético); `GET /auth/staff/status`
confirma `configurado: true` como antes.

### Próximo
Ficam 3 itens 🟢 Low: PIN mínimo de 4 dígitos, custo de bcrypt (10), sem `helmet`.
