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
- [ ] **2. TLS em falta.** Sessões (staff + board) viajam em HTTP puro na rede local →
  qualquer dispositivo no Wi-Fi captura o cookie. Pôr um Caddy à frente do Express no Pi
  (cert interno) + `COOKIE_SECURE=true`.
- [ ] **3. `multer` 1.x com CVEs de DoS.** Atualizar para 2.x. Correr `npm audit` nos dois
  projetos.
- [ ] **4. Sem trilho de auditoria.** PIN partilhado → não se sabe *quem* resolveu um pedido
  ou alterou um perfil. Registar mutações (timestamp + ação + IP) num log simples (RGPD/paper).

## 📁 Organização e arquitetura

- [ ] **5. Gestão de schema dividida** (migrations vs. `sync()` no arranque). `StaffAuth`,
  `StaffSession`, `UtenteSession`, `TabelaLayout`, `TabelaPadrao` sem histórico reproduzível
  (já mordeu com o casing no Pi). Unificar tudo em migrations.
- [ ] **6. Seeders não idempotentes** — 2º `db:seed:all` rebenta com IDs duplicados. Usar
  `ignoreDuplicates: true` ou check prévio.
- [x] **7. [TOP 3] Higiene dos `package.json`:** ✅ 2026-07-23
  - [x] Remover `cors` das dependências do **Client** (é pacote de servidor).
  - [x] Mover `nodemon` e `sequelize-cli` para `devDependencies` no Server.
  - [x] Adicionar scripts ao Server: `start`, `dev`, `migrate`, `seed`.
  - [x] Uniformizar nome/versão: `inovlar-client` / `inovlar-server` com versão real.
  - [x] Porta do Server a partir de `process.env.PORT` com fallback (hardcoded em `main.js`).
- [ ] **8. Páginas roteadas a viver em `Components/`** — `EditUtente`, `NewUtente`,
  `EditBotoes` são rotas mas estão em `Components/`. Rotas misturam convenções
  (`/edit-utente` kebab vs. `/editBotoes` camel). Mover para `Pages/` e uniformizar paths.
- [ ] **9. Contexto único = re-renders globais.** Um só Context com os 4 hooks; qualquer
  pedido re-renderiza todos os consumidores. Memoizar o `value` (quick win) e, a prazo,
  dividir em 2–3 contexts.
- [ ] **10. Zero testes (maior risco).** Melhor custo/benefício: unit tests puros para
  `gridSpans.js`, `useGridGeometry`, `raioFusao`/`matrizCategorias` (Vitest, sem DOM) +
  supertest para o contrato de auth (staff 401s, ownership do board, validação zod).

## ✨ Clean code / SOLID

- [~] **11. [TOP 3] Três frameworks de UI ao mesmo tempo** — Bootstrap (por todo o lado),
  Tailwind (CDN), e **Ant Design usado num único ficheiro** (`SuccessModal.jsx`).
  - [x] Substituir o antd pelo `Modal.jsx` partilhado e **remover o antd** ✅ 2026-07-23
    (removeu 70 pacotes; bundle JS caiu para ~130 kB gzip).
  - [ ] A prazo, escolher Tailwind (com build) e aposentar o Bootstrap gradualmente.
- [ ] **12. Convenção de linguagem inconsistente.** CLAUDE.md diz "código em inglês", mas o
  servidor tem identificadores PT (`isOrigemPermitida`, `purgarExpiradas`, `criarSessao`) e
  comentários PT. Decidir: traduzir comentários para inglês (abre a contribuidores) **ou**
  atualizar a convenção escrita. Estado atual (regra ≠ prática) é o pior.
- [ ] **13. Sem tipos no contrato mais frágil.** O JSON de layout (`cells`/`spans`/
  `coresCategoria`) só existe como comentário. Um `@typedef` JSDoc importado pelos editores e
  renderers dá verificação no editor a custo quase zero (sem migrar já para TS).

## 🎨 Cores, ícones, acessibilidade

- [ ] **14. Cores em três sítios sem fonte única** — paleta Material-3 no `index.html`, hexes
  hardcoded em `tabela/constants.js` (`status-yellow #F9A825` == `"Sinto-me" #F9A825`,
  duplicado), e 883 linhas de `index.css`. Ao migrar o Tailwind, extrair para tokens/CSS vars
  num sítio só.
- [ ] **15. Categoria comunicada só por cor.** Fusão visual e identidade dependem 100% da cor
  → mau para daltónicos/baixa visão (a população-alvo). Adicionar redundância (rótulo/ícone de
  categoria). `darkMode: "class"` está configurado mas nunca ativado → um **modo alto
  contraste** teria valor real. (Atkinson Hyperlegible é boa escolha, manter.)
- [~] **16. Polimento do `index.html`:** `lang="en"`→`pt` ✅ e título `APCM`→`InovLAR` ✅
  (feitos com o item 1). Falta: favicon ainda é o `vite.svg` default.

---

### Prioridades recomendadas (TOP 3)

1. **Tailwind CDN → build real** (item 1) — fecha o `unsafe-inline`, o risco offline, e
   destrava a consolidação de cores.
2. **Primeiros testes** (item 10) — `gridSpans`/`useGridGeometry` + contrato de auth.
3. **Remover antd + limpar os `package.json`** (itens 7 e 11) — meia hora, ganho imediato.
