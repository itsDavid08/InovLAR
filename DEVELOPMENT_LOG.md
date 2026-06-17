# Development Log — InovLAR

Registo cronológico das mudanças de arquitetura e decisões técnicas do projeto.
Entrada mais recente no topo.

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
- [ ] Verificação visual em runtime (carregar, selecionar, eliminar; confirmar que o botão afetado
  não desaparece e mostra o placeholder)

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
