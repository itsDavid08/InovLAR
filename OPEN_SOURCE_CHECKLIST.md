# Checklist — Preparação para Open Source + Artigo Científico

Lista de trabalho baseada na revisão do repositório feita antes de tornar o InovLAR público. Nota: este ficheiro é para uso interno da equipa — não precisa de ficar no repositório depois de tornado público (ou pode ficar, sem problema, mas não é parte da documentação para terceiros).

---

## 1. Higiene do repositório (crítico — dados de saúde)

- [ ] **Escanear o histórico completo do git** com [gitleaks](https://github.com/gitleaks/gitleaks) ou [trufflehog](https://github.com/trufflesecurity/trufflehog) — procurar credenciais, IPs internos, passwords em commits antigos (mesmo já removidos do estado atual, continuam no histórico).
- [ ] **Rever `DEVELOPMENT_LOG.md`** (~170KB) à procura de nomes reais de utentes, da instituição, IPs ou credenciais mencionadas em texto.
- [ ] **Rever `public/imagesBotoes/`** — confirmar que não há fotos reais (utentes, pessoal, espaço físico) em vez de ícones genéricos.
- [ ] **Decidir a estratégia se algo sensível aparecer no histórico**: reescrever histórico (`git filter-repo`) vs. publicar um repositório novo "limpo" a partir do estado atual (sem histórico antigo). Decidir *antes* de tornar o repo público.
- [ ] **Confirmar com a APCM / orientador** se há alguma cláusula de propriedade intelectual ou uso do nome da instituição que precise de autorização explícita antes da publicação.
- [x] ~~Remover menções à APCM do README e do CLAUDE.md~~ — feito (README.md, README.pt.md, CLAUDE.md já não nomeiam a instituição).
- [x] ~~Confirmar que `.env` está no `.gitignore` e nunca foi commitado~~ — confirmado.

## 2. Preparar o projeto para ser "fork-me-friendly"

- [ ] **Escolher licença** (MIT ou Apache 2.0 são as opções mais comuns para software académico open source; GPL/AGPL só se quiserem forçar que forks também sejam open source) — ver [choosealicense.com](https://choosealicense.com). Atualmente não existe ficheiro `LICENSE`.
- [ ] **Criar `CONTRIBUTING.md`** — como propor mudanças, convenções de commit, como correr localmente.
- [ ] **Criar `CODE_OF_CONDUCT.md`** (opcional, mas comum em projetos open source com contribuições externas).
- [ ] **Generalizar conteúdo específico do contexto de lar** — nomes de categorias de botões, seeders, textos fixos que assumem o contexto de lar de idosos. Mostrar no README (já preparado) como adaptar para outros contextos (triagem hospitalar, retalho, etc.).
- [ ] **Adicionar screenshots/GIF** do sistema em ação ao README (atualmente não existem imagens no repositório para isso).
- [ ] **CI básico** (lint + build, mesmo que simples) — dá confiança a quem for fazer fork. Nota: o lint do Client está atualmente partido (falta `eslint.config.js` — ver "Known Limitations" no `CLAUDE.md`), corrigir isso é pré-requisito para o CI fazer sentido.
- [x] ~~README em condição de "primeira impressão"~~ — feito: README.md (inglês) + README.pt.md (português), com diagrama de arquitetura, features, instalação e utilização.

## 3. Para o artigo científico

- [ ] **Escolher a venue**: [JOSS](https://joss.theoj.org/) (revisão rápida, foco em qualidade de software + documentação), [SoftwareX](https://www.sciencedirect.com/journal/softwarex) (mais formal), ou conferências de Health Informatics/Assistive Technology (ex: MIE, ICOST, PervasiveHealth) se o foco for o caso de uso em saúde.
- [ ] **Confirmar os requisitos exatos da venue escolhida** antes de submeter (política de uso de IA, formato de submissão, etc. — isto muda de revista para revista).
- [ ] **Adicionar testes automatizados** — atualmente não existem para `Server` nem `Client`; a maioria das venues de software pede alguma cobertura de testes.
- [ ] **Criar `CITATION.cff`** para permitir citação formal do repositório.
- [ ] **Pesquisar trabalho relacionado** para posicionar o artigo — sistemas de comunicação aumentativa (AAC) para idosos/pessoas com limitações motoras, e sistemas de triagem/pedidos digitais em contexto hospitalar.
- [ ] **Escrever o artigo** — estrutura tipo JOSS: motivação, funcionalidade, ligação a trabalho relacionado, exemplos de uso.

---

## Já feito (fora desta lista original)

- [x] README bilingue (EN principal + PT), sem dependência do `CLAUDE.md`.
- [x] Diagrama de arquitetura (Mermaid) no README.
- [x] Secção de "Como Começar" com instalação automática (`install.ps1`/`install.sh`) e manual.
- [x] Menção transparente (mas discreta) ao uso de IA no desenvolvimento, dentro do README.
