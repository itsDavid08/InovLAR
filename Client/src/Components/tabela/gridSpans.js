// @ts-check
// Botões com tamanho variável (1x2, 2x2, 3x3…): um botão ocupa uma "pegada" retangular de
// células a partir de uma célula-âncora (canto superior-esquerdo), guardada em `config.spans`
// como `{ [posAncora]: { w, h } }`. `cells[pos]` só tem o botaoId na âncora; as restantes células
// da pegada ficam a `null` (reservadas). Ausência de entrada em `spans` = 1x1 (retrocompatível
// com tabelas guardadas antes desta funcionalidade existir).
//
// Forma partilhada com `constants.js: TabelaConfig` (item 13 do IMPROVEMENTS_CHECKLIST.md) —
// ver o `@typedef` lá para a definição canónica de `cells`/`spans`.

/** @typedef {import('./constants').TabelaConfig} TabelaConfig */

/**
 * remove nulls finais de um array de cells (mantém-no compacto)
 * @param {TabelaConfig["cells"]} arr
 * @returns {TabelaConfig["cells"]}
 */
export const trim = (arr) => {
    let e = arr.length;
    while (e > 0 && arr[e - 1] == null) e--;
    return arr.slice(0, e);
};

/**
 * tamanho de um botão ancorado em `pos` (default 1x1)
 * @param {TabelaConfig["spans"]} spans
 * @param {number} pos
 * @returns {{w: number, h: number}}
 */
export const getSpan = (spans, pos) => spans?.[pos] || { w: 1, h: 1 };

/**
 * posições cobertas por um botão w×h ancorado em `pos`; null se não couber na largura da grelha
 * @param {number} pos
 * @param {number} w
 * @param {number} h
 * @param {number} cols
 * @returns {number[] | null}
 */
export const footprint = (pos, w, h, cols) => {
    const r = Math.floor(pos / cols), c = pos % cols;
    if (c + w > cols) return null;
    const out = [];
    for (let dr = 0; dr < h; dr++)
        for (let dc = 0; dc < w; dc++)
            out.push((r + dr) * cols + (c + dc));
    return out;
};

/**
 * mapa posição → âncora, para todas as células ocupadas (a própria âncora ou cobertas pelo seu span)
 * @param {TabelaConfig["cells"]} cells
 * @param {TabelaConfig["spans"]} spans
 * @param {number} cols
 * @returns {Map<number, number>}
 */
export const buildOcupacao = (cells, spans, cols) => {
    const ocup = new Map();
    cells.forEach((botaoId, pos) => {
        if (botaoId == null) return;
        const { w, h } = getSpan(spans, pos);
        for (const p of footprint(pos, w, h, cols) || [pos]) ocup.set(p, pos);
    });
    return ocup;
};

/**
 * nº de linhas necessárias para caber todos os botões (âncora + altura do span, não só a âncora)
 * @param {TabelaConfig["cells"]} cells
 * @param {TabelaConfig["spans"]} spans
 * @param {number} cols
 * @returns {number}
 */
export const extentRows = (cells, spans, cols) => {
    let maxRow = -1;
    cells.forEach((botaoId, pos) => {
        if (botaoId == null) return;
        const { h } = getSpan(spans, pos);
        maxRow = Math.max(maxRow, Math.floor(pos / cols) + h - 1);
    });
    return maxRow + 1;
};

const need = (arr, i) => { while (arr.length <= i) arr.push(null); };

/**
 * Coloca (da biblioteca), move (arrasta um slot existente) ou redimensiona (mesma posição como
 * alvo e como `selfAnchor`) um botão w×h em `targetPos`. Quaisquer botões já colocados cuja
 * pegada colida com a nova são automaticamente empurrados para a próxima célula livre (varrimento
 * linha-a-linha; a grelha cresce sozinha se for preciso) — exceto quando `trocarComOrigem` está
 * ativo e há exatamente UM colidido: nesse caso troca de lugar com a âncora de origem em vez de
 * ir para a 1ª célula livre da grelha (ver parâmetro abaixo). A pegada do próprio alvo fica
 * reservada durante o empurrão, para nenhum colidido poder ser "empurrado" para dentro dela e
 * depois sobrescrito pela colocação final (bug corrigido 2026-07-28 — ver DEVELOPMENT_LOG.md).
 * Devolve `null` se o alvo não couber na largura da grelha (não há como empurrar para fora dela
 * horizontalmente).
 * @param {TabelaConfig["cells"]} cells
 * @param {TabelaConfig["spans"]} spans
 * @param {number} cols
 * @param {number} targetPos
 * @param {number} botaoId
 * @param {{w: number, h: number}} span
 * @param {number | null} [selfAnchor]
 * @param {{trocarComOrigem?: boolean}} [opts] `trocarComOrigem`: ao mover um botão já colocado
 *   (não da biblioteca) para cima de exatamente outro, troca os dois de lugar — o colidido vai
 *   para a posição de onde o botão movido veio (`selfAnchor`), não para a 1ª célula livre da
 *   grelha. Só faz sentido quando `selfAnchor != null` (colocação vinda da biblioteca não tem
 *   "posição de origem" para trocar). Cai de volta ao empurrão normal se houver mais que um
 *   colidido, ou se o colidido não couber na posição de origem (tamanhos diferentes).
 * @returns {{cells: TabelaConfig["cells"], spans: TabelaConfig["spans"]} | null}
 */
export const colocarComEmpurrao = (
    cells,
    spans,
    cols,
    targetPos,
    botaoId,
    { w, h },
    selfAnchor = null,
    { trocarComOrigem = false } = {},
) => {
    const fpAlvo = footprint(targetPos, w, h, cols);
    if (!fpAlvo) return null;

    const novasCells = cells.slice();
    const novosSpans = { ...spans };
    const ocup = buildOcupacao(novasCells, novosSpans, cols);
    // reserva a pegada do alvo para a duração do empurrão — impede que um colidido "pouse"
    // dentro dela a caminho da célula livre e seja depois sobrescrito pela colocação final
    const reservado = new Set(fpAlvo);
    const livre = (p) => !ocup.has(p) && !reservado.has(p);

    // remove um botão do tabuleiro (em memória) e devolve os seus dados, para o recolocar depois
    const levantar = (anchor) => {
        const { w: aw, h: ah } = getSpan(novosSpans, anchor);
        const bId = novasCells[anchor];
        for (const p of footprint(anchor, aw, ah, cols) || [anchor]) { ocup.delete(p); novasCells[p] = null; }
        delete novosSpans[anchor];
        return { botaoId: bId, w: aw, h: ah };
    };
    const pousar = (pos, item) => {
        const fp = footprint(pos, item.w, item.h, cols);
        need(novasCells, Math.max(...fp));
        novasCells[pos] = item.botaoId;
        if (item.w > 1 || item.h > 1) novosSpans[pos] = { w: item.w, h: item.h };
        else delete novosSpans[pos];
        for (const p of fp) ocup.set(p, pos);
    };
    const empurrarParaLivre = (item) => {
        let novaPos = 0, fp;
        while (!(fp = footprint(novaPos, item.w, item.h, cols)) || !fp.every(livre)) novaPos++;
        pousar(novaPos, item);
    };

    // "levanta" o próprio item (mover/redimensionar) primeiro, para não colidir consigo mesmo
    if (selfAnchor != null) levantar(selfAnchor);

    // âncoras alheias cuja pegada colide com o alvo — empurradas por ordem de posição (determinístico)
    const colisoes = [...new Set(fpAlvo.map((p) => ocup.get(p)).filter((a) => a != null))].sort((a, b) => a - b);

    if (trocarComOrigem && selfAnchor != null && colisoes.length === 1) {
        const item = levantar(colisoes[0]);
        const fpOrigem = footprint(selfAnchor, item.w, item.h, cols);
        if (fpOrigem && fpOrigem.every(livre)) pousar(selfAnchor, item);
        else empurrarParaLivre(item); // não cabe na origem (tamanhos diferentes) — cai para o empurrão normal
    } else {
        for (const anchor of colisoes) empurrarParaLivre(levantar(anchor));
    }

    pousar(targetPos, { botaoId, w, h });
    return { cells: novasCells, spans: novosSpans };
};
