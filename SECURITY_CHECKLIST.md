# Checklist de Segurança — InovLAR

Levantamento de pontos de segurança a corrigir, feito por revisão manual do código (auth, rotas, middleware, uploads, CORS, sockets). Organizado por severidade. Cada item explica o problema, onde está e porque importa, para servir de referência ao corrigir.

---

## 🔴 Crítico

- [x] **Sem rate limiting no login de staff → PIN de 4 dígitos forçável por brute-force**
  `Server/controller/authController.js` (`login`). O PIN mínimo é de 4 dígitos (`MIN_DIGITOS = 4`, ~10 000 combinações) e o endpoint `/auth/staff/login` aceita tentativas ilimitadas, sem atraso nem bloqueio. Um atacante na mesma rede consegue quebrar qualquer PIN em minutos com um script simples.
  **Correção:** adicionar rate limiting (ex. `express-rate-limit`) e/ou lockout temporário após N tentativas falhadas, no `/auth/staff/login` e idealmente também no `/auth/staff/setup`.
  **Feito:** `Server/middleware/rateLimiter.js` (`staffAuthLimiter`) — 5 tentativas falhadas por 10 min por IP, aplicado a `/auth/staff/login`, `/auth/staff/setup` e `/auth/staff/change` em `Server/routes/route.js`.

- [ ] **Cookie de sessão é um valor estático `"ok"` — não é uma sessão real**
  `Server/controller/authController.js:49` e `Server/middleware/auth.js:8`. O cookie assinado guarda literalmente a string `"ok"` para todos os utilizadores staff. Isto significa:
  - Impossível revogar uma sessão individual ou fazer "logout global" (não há forma de invalidar cookies já emitidos).
  - Se o `COOKIE_SECRET` vazar, qualquer pessoa forja um cookie válido para sempre.
  - Não há expiração real do lado do servidor — só o `maxAge` do browser.
  **Correção:** substituir por um identificador de sessão único (ex. UUID aleatório guardado numa tabela `Sessions` com expiração), ou um token assinado com expiração server-side verificável.

- [ ] **`COOKIE_SECRET` com fallback hardcoded no repositório público**
  `Server/config/auth.js:8` — `process.env.COOKIE_SECRET || "troca-isto-por-um-segredo-bem-grande"`. Este valor por omissão está visível no GitHub. Se a variável de ambiente não for definida em produção (fácil de esquecer numa instalação nova), **qualquer pessoa que leia o repositório consegue forjar cookies válidos** e entrar na consola de staff sem saber o PIN.
  **Correção:** remover o fallback; fazer o servidor recusar arrancar (`process.exit(1)`) se `COOKIE_SECRET` não estiver definida fora de desenvolvimento. Adicionar `COOKIE_SECRET` ao `Server/.env.example` como campo obrigatório.

- [ ] **Cookie de sessão nunca usa a flag `Secure`**
  `Server/controller/authController.js:14` — `secure: false` está fixo no código, mesmo pensando em produção. Em HTTP simples (ou HTTPS mal configurado à frente), o cookie viaja em claro e é intercetável por qualquer pessoa na mesma rede.
  **Correção:** `secure: process.env.NODE_ENV === 'production'` (já está anotado como TODO no `CLAUDE.md`, mas ainda não feito).

---

## 🟠 Alto

- [ ] **Endpoints com dados de pacientes acessíveis sem autenticação**
  `Server/routes/route.js` — estes GETs são públicos (sem `requireStaff`):
  - `GET /utentes` e `GET /utentes/:id` → lista todos os pacientes com nome, quarto e pedidos ativos.
  - `GET /pedidos`, `/pedidos/ativos/hora`, `/pedidos/ativos/emergencia`, `/pedidos/:id`, `/pedidos/utente/:utenteId` → histórico de pedidos de todos os utentes.
  - `GET /botoes`, `GET /tabelas`, `GET /tabelas-padrao`.
  Num contexto de lar de idosos, nome + quarto + pedidos são **dados de saúde/pessoais sob RGPD**, expostos a qualquer pessoa com acesso à rede local (ou à internet, se o servidor estiver exposto).
  **Correção:** este é o ponto de maior impacto RGPD do projeto. Rever quais destes GETs o board do utente realmente precisa (provavelmente só o registo de um utente específico, via token) e restringir os restantes a `requireStaff`, ou introduzir um mecanismo de autorização por-utente (ver ponto seguinte).

- [ ] **`PUT /pedidos/:id` permite alterar qualquer pedido de qualquer utente, sem verificar dono**
  `Server/routes/route.js:132` + `Server/controller/pedidoController.js` (`atualizarPedido`). Este endpoint tem de ficar público (é como o board do utente marca/atualiza o seu próprio pedido), mas não verifica que o pedido pertence ao utente que está a fazer o request — nenhuma validação de "dono" do lado do servidor. Um atacante pode alterar o `estado`, `emergencia`, ou até o `utenteId` de qualquer pedido de qualquer paciente.
  **Correção:** validar que o pedido pertence ao utente identificado (ex. via o token do board), e restringir os campos alteráveis por este caminho público (não deixar mudar `utenteId`, `botaoId`, etc. livremente).

- [ ] **Mass assignment em `Pedido.create`/`Pedido.update` e `Utente.update`**
  `Server/controller/pedidoController.js:106,123` e `Server/controller/utenteController.js:68` — passam `req.body` diretamente ao Sequelize (`Pedido.create(req.body)`, `Pedido.update(req.body, ...)`, `Utente.update(req.body, ...)`) sem whitelist de campos. Um atacante pode injetar campos inesperados que o modelo aceite (ex. `id`, timestamps, ou outros atributos não pretendidos para aquele endpoint).
  **Correção:** extrair explicitamente só os campos esperados de `req.body` antes de passar ao ORM (`{ nome, quarto } = req.body`, etc. — como já é feito em `createUtente`).

- [ ] **O "token" do utente na URL é apenas ofuscação, não autenticação — e a chave está no bundle do cliente**
  `Client/src/utils/utenteToken.js` — cifra de Feistel reversível cujo código e chave (`KEY`) estão no JavaScript do frontend, público. Qualquer pessoa consegue reverter o token e enumerar sistematicamente todos os IDs de utentes (`1, 2, 3, …`). Combinado com o ponto anterior (`GET /utentes/:id` sem autenticação), isto torna trivial aceder ao board e histórico de qualquer paciente sem saber o token real. O próprio comentário no código já admite "NÃO é segurança" — mas atualmente é a única barreira real de acesso ao board de um paciente.
  **Correção:** não depender do token como controlo de acesso. Se o objetivo é impedir acesso cruzado entre pacientes, isso tem de ser reforçado no backend (ex. autenticação real por sessão de dispositivo, não apenas um ID ofuscado na URL).

---

## 🟡 Médio

- [ ] **CORS reflete qualquer origem, com credenciais ativas**
  `Server/main.js:40-43` — `origin: (origin, cb) => cb(null, true)` junto com `credentials: true` permite que **qualquer site** faça pedidos autenticados usando os cookies do utilizador (facilita CSRF). O socket.io tem o mesmo problema (`cors: { origin: '*' }`, `Server/main.js:57`).
  **Correção:** definir uma allowlist explícita de origens conhecidas (o domínio/IP de produção + `localhost:5173` em dev) em vez de refletir qualquer origem.

- [ ] **Sem proteção CSRF nos endpoints mutáveis**
  Como a autenticação é por cookie e o CORS é permissivo (ponto anterior), os endpoints `POST/PUT/DELETE` protegidos por `requireStaff` ficam expostos a CSRF — um site malicioso pode fazer o browser da staff (já autenticado) disparar pedidos sem o conhecimento dela. `sameSite: "lax"` ajuda um pouco, mas não é suficiente sozinho com CORS aberto.
  **Correção:** `sameSite: "strict"` onde possível e/ou implementar token anti-CSRF nos endpoints de escrita.

- [ ] **Upload de imagens: validação fraca e sem limites**
  `Server/routes/route.js:39-46` (`uploadImagemBotao`):
  - O `fileFilter` valida por `mimetype` e extensão, ambos fornecidos pelo cliente e falsificáveis — não valida o conteúdo real do ficheiro (magic bytes). É possível enviar um ficheiro malicioso disfarçado de `.png`.
  - **Não há `limits`** (tamanho máximo de ficheiro, número de ficheiros) → um utilizador autenticado como staff pode fazer upload de ficheiros enormes repetidamente e esgotar o disco (DoS).
  - No modo padrão (sem `onConflict=rename`), o upload **sobrescreve silenciosamente** qualquer imagem existente com o mesmo nome.
  **Correção:** validar magic bytes do ficheiro (ex. `file-type`), adicionar `limits: { fileSize, files }` ao multer, e confirmar explicitamente antes de sobrescrever.

- [ ] **Configuração de multer "órfã" em `main.js`, sem `fileFilter` nem `limits`**
  `Server/main.js:27-35` — existe uma configuração de `multer` que escreve em `uploads/`, mas não parece estar ligada a nenhuma rota ativa. Código morto e potencialmente perigoso se algum dia for ligado sem restrições.
  **Correção:** remover se não estiver em uso, ou aplicar as mesmas proteções do ponto anterior se for necessário.

- [ ] **`GET /localIP` expõe topologia de rede interna sem autenticação**
  `Server/routes/route.js:48-62` — devolve o IP interno do servidor a qualquer pedido, sem `requireStaff`. Fuga de informação útil para reconhecimento de rede.
  **Correção:** proteger com `requireStaff`, ou remover se não for essencial ao funcionamento do sistema.

- [ ] **Falta de validação de entrada consistente**
  Não existe uma camada de validação (ex. `express-validator`, `zod`) nos controllers. IDs de rota (`req.params.id`) nem sempre são convertidos/validados antes de chegar ao ORM (o `utenteController` faz `parseInt`, mas o `pedidoController` não). O Sequelize protege contra SQL injection clássico (usa parâmetros), mas a ausência de validação de tipo/formato pode gerar erros 500 não tratados ou comportamento inesperado com entradas malformadas.
  **Correção:** introduzir validação de schema nos endpoints (pelo menos nos que recebem `req.body` ou params usados em queries).

---

## 🟢 Baixo / Higiene

- [ ] **Janela de "corrida" no `/auth/staff/setup`**
  `Server/controller/authController.js:34` — o endpoint é público e só verifica se já existe um `StaffAuth`. Se o registo for apagado (forma documentada de reset de password), há uma janela em que **qualquer pessoa na rede pode definir o PIN de staff primeiro**, tomando conta da consola antes do dono legítimo.
  **Correção:** não é trivial de eliminar totalmente dado o modelo de "PIN partilhado", mas pode mitigar-se restringindo o acesso de rede durante o reset, ou notificando/logando tentativas de setup.

- [ ] **PIN mínimo de 4 dígitos é fraco**
  `Server/controller/authController.js:6` (`MIN_DIGITOS = 4`). Mesmo com rate limiting implementado, 4 dígitos numéricos é um espaço de busca pequeno.
  **Correção:** considerar aumentar para 6+ dígitos, ou permitir/incentivar PIN alfanumérico.

- [ ] **Mensagens de erro expõem `erro.message` ao cliente**
  Vários controllers (`utenteController.js`, `authController.js`, etc.) devolvem `erro.message` diretamente na resposta JSON. Pode vazar detalhes internos do schema/ORM/stack a um atacante.
  **Correção:** logar o erro detalhado no servidor (`console.error`, já feito em vários sítios) e devolver uma mensagem genérica ao cliente.

- [ ] **Cost factor do bcrypt em 10**
  `Server/controller/authController.js:47` — `bcrypt.hash(String(password), 10)`. Aceitável, mas 12 é mais robusto para 2026. Nota: para um PIN de 4 dígitos, isto é secundário face ao ponto crítico do rate limiting (o gargalo real não é o custo do hash).
  **Correção:** subir para 12 quando for oportuno (não é urgente por si só).

- [ ] **`Server/.env.example` não lista `COOKIE_SECRET`**
  Aumenta a probabilidade de uma instalação nova esquecer de a definir e cair no fallback perigoso do ponto crítico #3.
  **Correção:** adicionar `COOKIE_SECRET=` ao `.env.example` com um comentário a indicar que é obrigatório gerar um valor aleatório em produção.

- [ ] **Sem headers de segurança HTTP (helmet)**
  Não há `helmet` nem equivalente configurado no Express — faltam headers como CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS.
  **Correção:** adicionar `helmet` ao `Server/main.js` com uma configuração mínima.

---

## Prioridade sugerida

| Ordem | Itens | Esforço estimado | Porquê primeiro |
|-------|-------|-------------------|------------------|
| 1 | Rate limiting no login, `COOKIE_SECRET` obrigatório, cookie `secure` em produção | Baixo | Impacto crítico, mudanças pequenas e isoladas |
| 2 | Restringir acesso aos dados de pacientes (`/utentes`, `/pedidos`) | Médio | Maior risco RGPD do projeto |
| 3 | Sessões reais em vez do cookie `"ok"` fixo | Médio | Permite revogação e elimina o risco de forjar cookies eternos |
| 4 | CORS restrito + proteção CSRF | Baixo–Médio | Reduz superfície de ataque entre origens |
| 5 | Whitelist de campos em creates/updates, limites de upload, validação de input | Médio | Reduz classes inteiras de bugs/abusos |
| 6 | Itens de higiene (headers, mensagens de erro, bcrypt cost, `.env.example`) | Baixo | Melhoria incremental, sem urgência |

Os itens 1, 3, 4 (Crítico) e 5, 8 (Alto) da secção acima são os que, combinados, permitem hoje a qualquer pessoa com acesso à rede aceder e manipular dados de pacientes e/ou tomar conta da consola de staff — são o ponto de partida recomendado.
