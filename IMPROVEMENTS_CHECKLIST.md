# InovLAR — Checklist de Melhorias

Levantamento feito em 2026-07-23 (análise de segurança, organização, SOLID/clean code,
arquitetura, linguagem, cores, ícones e acessibilidade). Ordenado por área; os itens
marcados como **[TOP 3]** são as prioridades recomendadas.

---

## 🔒 Segurança

- [x] **1. [TOP 3] Tailwind via CDN → build real.** ✅ 2026-07-23. Migrado para Tailwind v3 +
  PostCSS (`tailwind.config.js` + `postcss.config.js` + `src/tailwind.css`); removidos os dois
  `<script>` do `index.html`; CSP do helmet sem `'unsafe-inline'`/CDN no `script-src`. Verificado
  no build e no browser. **Descoberta:** `bg-primary` mostra o azul do Bootstrap (`!important`),
  não o roxo M3 — pré-existente, não regressão; limpeza fica no item 11.
- [~] **2. TLS em falta.** ✅ código 2026-07-24, ⏳ **por validar numa Pi real**. `install.sh
  ENABLE_TLS=true` instala Caddy (`tls internal`, self-signed, sem domínio), define
  `COOKIE_SECURE=true` + `HOST=127.0.0.1` (Express só alcançável via Caddy). `main.js` ganhou
  `trust proxy: 'loopback'` (senão o rate limiter do PIN colapsava por IP atrás do proxy).
  Opt-in e sticky — não muda o comportamento de instalações existentes. Ver Caddyfile +
  DEVELOPMENT_LOG. **Falta:** correr `ENABLE_TLS=true` numa Pi real e confirmar o fluxo do
  aviso de certificado nos tablets.
- [x] **3. `multer` 1.x com CVEs de DoS.** ✅ 2026-07-27. Atualizado `1.4.5-lts.2` → `2.2.0`.
  `npm audit` não assinalava isto (a versão fixa estava mesmo assim dentro do intervalo de
  várias CVEs HIGH/CVSS 8.7 confirmadas via GHSA/NVD — crash do processo por pedido malformado,
  sem workaround). Sem mudanças de código (única breaking change do 1.x→2.x é o Node mínimo,
  já coberto). Verificado com pedidos HTTP reais (9/9) + 4 testes novos permanentes
  (`Server/tests/uploads.test.mjs`). Ver DEVELOPMENT_LOG.
- [x] **4. Sem trilho de auditoria.** ✅ 2026-07-27. Tabela `audit_logs` (migration, não
  sync()) + `Util/auditoria.js: registarAuditoria()` (nunca bloqueia a resposta), chamado
  explicitamente em `utente.create/update/delete/rotateToken`, `pedido.update/delete`,
  `auth.changePassword`. `GET /auditoria?limit=` para consultar. **De propósito fora de
  âmbito:** contas de staff nomeadas (PIN continua partilhado — regista sessão/IP, não
  pessoa) e CRUD de botões/tabelas/imagens (não são dados pessoais). Sem UI no client ainda.
  Ver DEVELOPMENT_LOG.

## 📁 Organização e arquitetura

- [x] **5. Gestão de schema dividida.** ✅ 2026-07-27. As 5 tabelas que só existiam via
  `sync()` (`StaffAuth`, `StaffSession`, `UtenteSession`, `TabelaLayout`, `TabelaPadrao`)
  ganharam migrations idempotentes (`20260727100000`–`100004`, só criam se a tabela ainda
  não existir — nunca tocam em instalações já a correr). `main.js` já não chama `.sync()`
  para nada; removido também o `initDb()` morto de `models/index.js`. **Bug real apanhado
  a escrever isto:** o helper de "já existe" copiado da migration de referência usava
  `BINARY` (comparação exata de maiúsculas) — no Windows/macOS (`lower_case_table_names=1`)
  isso NUNCA encontra a tabela (o MariaDB guarda o nome em minúsculas), pelo que a migration
  ia tentar recriar um índice já existente. Corrigido para comparação insensível a
  maiúsculas antes de avançar; sem perda de dados (confirmado por contagem de linhas
  antes/depois). Ver DEVELOPMENT_LOG.
- [x] **6. Seeders não idempotentes.** ✅ 2026-07-27. `ignoreDuplicates: true` no `bulkInsert`
  dos botões predefinidos — testado a sério (3 corridas seguidas + apagar um botão e confirmar
  que só ele é reposto). Removido também o guard manual `BOTAO_COUNT` do `install.sh`/
  `install.ps1` (existia só por causa deste bug). Ver DEVELOPMENT_LOG.
- [x] **7. [TOP 3] Higiene dos `package.json`:** ✅ 2026-07-23
  - [x] Remover `cors` das dependências do **Client** (é pacote de servidor).
  - [x] Mover `nodemon` e `sequelize-cli` para `devDependencies` no Server.
  - [x] Adicionar scripts ao Server: `start`, `dev`, `migrate`, `seed`.
  - [x] Uniformizar nome/versão: `inovlar-client` / `inovlar-server` com versão real.
  - [x] Porta do Server a partir de `process.env.PORT` com fallback (hardcoded em `main.js`).
- [x] **8. Páginas roteadas a viver em `Components/`.** ✅ 2026-07-27. `EditUtente`,
  `NewUtente`, `EditBotoes` movidos para `Pages/` (`git mv`, histórico preservado);
  `/editBotoes` → `/edit-botoes` (kebab, uniforme com o resto). Imports internos e o link
  de nav (`navItems.js`) atualizados. Verificado no browser (as 3 rotas resolvem e
  redirecionam corretamente sem sessão) + build limpo (153 módulos, igual a antes).
- [~] **9. Contexto único = re-renders globais.** ✅ *quick win* 2026-07-27, ⏳ *split* por
  fazer. Os 4 hooks de estado (`useBotoesState`/`useUtentesState`/`usePedidosState`/
  `useStaffAuthState`) e o `value` do `ContextProvider` ganharam `useMemo` — o `value` só
  ganha referência nova quando algo realmente mudou, não em todo e qualquer re-render do
  provider (ex.: causado por navegação, sem nenhum dado ter mudado). **Isto não resolve**
  "qualquer pedido re-renderiza todos os consumidores" — continua a ser um Context só, uma
  mudança em qualquer domínio ainda propaga a todos; isso só fecha com o split em 2–3
  contexts, que continua por fazer (a prazo). Ver DEVELOPMENT_LOG para a verificação.
- [x] **10. [TOP 3] Primeiros testes.** ✅ 2026-07-23. Vitest nos dois pacotes (`npm test`).
  Client (31): `gridSpans` + `constants` (geometria/cor, puro). Server (23): schemas zod,
  `validate`/`requireStaff`/`requireUtente`, e a posse do board (403). **Descoberta:** bug real em
  `colocarComEmpurrao` (perde/sobrepõe botões no resize por cima de vizinho) — capturado em 2 xfail,
  **por corrigir** (ver DEVELOPMENT_LOG). Falta (futuro): gestos drag/resize e integração HTTP com BD.

## ✨ Clean code / SOLID

- [~] **11. [TOP 3] Três frameworks de UI ao mesmo tempo** — Bootstrap (por todo o lado),
  Tailwind (CDN), e **Ant Design usado num único ficheiro** (`SuccessModal.jsx`).
  - [x] Substituir o antd pelo `Modal.jsx` partilhado e **remover o antd** ✅ 2026-07-23
    (removeu 70 pacotes; bundle JS caiu para ~130 kB gzip).
  - [ ] A prazo, escolher Tailwind (com build) e aposentar o Bootstrap gradualmente.
- [ ] **12. Convenção de linguagem inconsistente.** ⏸️ Decisão tomada 2026-07-27: deixar como
  está por agora. CLAUDE.md diz "código em inglês", mas o servidor tem identificadores PT
  (`isOrigemPermitida`, `purgarExpiradas`, `criarSessao`) e comentários PT — traduzir tudo
  seria uma mudança grande (dezenas de ficheiros); atualizar só a regra escrita, uma opção
  pequena. Perguntado ao utilizador; escolheu não mexer por agora. Revisitar se algum dia
  importar (ex.: abrir a contribuidores externos).
- [x] **13. Sem tipos no contrato mais frágil.** ✅ 2026-07-27. `@typedef {TabelaConfig}` em
  `Components/tabela/constants.js`, referenciado via JSDoc em `gridSpans.js`,
  `useGridGeometry.js`, `useTabelaConfigs.js` e nos componentes do editor/renderer.
  `jsconfig.json` novo + `typescript` como devDependency (só para `tsc --noEmit`, sem
  sintaxe TS em lado nenhum); `checkJs: false` global de propósito (evitava inundar o
  projeto todo com avisos não relacionados) — os 4 ficheiros de lógica pura ganham
  `// @ts-check` individual. Confirmado a sério que o `tsc` apanha erros reais (injetei
  um erro deliberado, confirmou, removi). Ver DEVELOPMENT_LOG.

## 🎨 Cores, ícones, acessibilidade

- [~] **14. Cores em três sítios sem fonte única.** 🔍 Investigado 2026-07-27, sem mudança de
  código (decisão do utilizador: só o alcance pontual, não a consolidação completa). Achados:
  (a) o `#F9A825` duplicado (`status-yellow` no Tailwind vs. `COR_CATEGORIA["Sinto-me"]`) é
  **coincidência, não uma violação real de DRY** — `status-yellow` e `status-red` não são usados
  em lado nenhum do código (só `status-green` está ligado a algo, o indicador "Estável" do
  utente); forçar os dois a partilhar uma constante criava um acoplamento artificial entre
  conceitos sem relação, e apagar os tokens não usados seria presumir que não são espaço
  reservado para uma funcionalidade futura (ex.: níveis de urgência). Nenhuma mudança feita.
  (b) O `index.css` (883 linhas) tem uma paleta legada separada de ~40 cores hex
  (`#1E90FF`, `#50D1D1`, `#4CAF50`, etc.), usada pelo Welcome/StaffLogin/outros — completamente
  desligada da paleta M3 do Tailwind. Consolidar isto é um trabalho grande, com risco real de
  regressão visual em várias páginas, e sobrepõe-se ao item 11 (aposentar o Bootstrap,
  já adiado) — fica por fazer, não é "custo quase zero". Ver DEVELOPMENT_LOG.
- [ ] **15. Categoria comunicada só por cor.** Fusão visual e identidade dependem 100% da cor
  → mau para daltónicos/baixa visão (a população-alvo). Adicionar redundância (rótulo/ícone de
  categoria). `darkMode: "class"` está configurado mas nunca ativado → um **modo alto
  contraste** teria valor real. (Atkinson Hyperlegible é boa escolha, manter.) *(O modo escuro
  chegou a ser implementado em 2026-07-27 e depois revertido a pedido — ver DEVELOPMENT_LOG.)*
- [x] **16. Polimento do `index.html`.** ✅ 2026-07-27 (completo). `lang="en"`→`pt` e título
  `APCM`→`InovLAR` (feitos com o item 1). Favicon novo (`public/favicon.svg`) — bolha de
  fala na cor primária M3 do tema, já que não havia nenhum logótipo/ícone de marca no
  projeto para reaproveitar (só os defaults do Vite/React, nunca usados — removidos
  também `public/vite.svg` e `src/assets/react.svg`). Verificado por amostragem de
  pixels (canvas) já que a captura de ecrã não estava disponível nesta sessão, e
  confirmado a servir corretamente (200, `image/svg+xml`) no dev server.

---

### Estado geral (2026-07-27)

Dos 16 itens levantados nesta ronda, **12 fechados por completo** (1, 3, 4, 5, 6, 7, 8, 10, 13,
16, e as partes tratadas de 9, 11). **4 com trabalho restante, deliberadamente adiado, não
esquecido:**
- **2** (TLS) — código pronto, falta validar `ENABLE_TLS=true` numa Pi real.
- **9**/**11** — os "a prazo" de cada um (split em vários contexts; aposentar o Bootstrap) ficam
  para uma sessão futura, alcance grande demais para "custo quase zero".
- **12** — decisão do utilizador: não mexer na convenção de linguagem por agora.
- **14** (parte da consolidação de cores) e **15** (dark mode + redundância para daltónicos) —
  o modo escuro chegou a ser implementado em 2026-07-27 e foi revertido a pedido do utilizador
  logo a seguir; item 15 fica todo por fazer outra vez. Âmbito grande/risco de regressão visual;
  utilizador escolheu não fazer agora.

### Prioridades recomendadas (TOP 3)

1. **Tailwind CDN → build real** (item 1) — fecha o `unsafe-inline`, o risco offline, e
   destrava a consolidação de cores.
2. **Primeiros testes** (item 10) — `gridSpans`/`useGridGeometry` + contrato de auth.
3. **Remover antd + limpar os `package.json`** (itens 7 e 11) — meia hora, ganho imediato.
