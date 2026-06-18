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
