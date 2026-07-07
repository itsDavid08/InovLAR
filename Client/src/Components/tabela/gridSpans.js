// Botões com tamanho variável (1x2, 2x2, 3x3…): um botão ocupa uma "pegada" retangular de
// células a partir de uma célula-âncora (canto superior-esquerdo), guardada em `config.spans`
// como `{ [posAncora]: { w, h } }`. `cells[pos]` só tem o botaoId na âncora; as restantes células
// da pegada ficam a `null` (reservadas). Ausência de entrada em `spans` = 1x1 (retrocompatível
// com tabelas guardadas antes desta funcionalidade existir).

// tamanho de um botão ancorado em `pos` (default 1x1)
export const getSpan = (spans, pos) => spans?.[pos] || { w: 1, h: 1 };

// posições cobertas por um botão w×h ancorado em `pos`; null se não couber na largura da grelha
export const footprint = (pos, w, h, cols) => {
    const r = Math.floor(pos / cols), c = pos % cols;
    if (c + w > cols) return null;
    const out = [];
    for (let dr = 0; dr < h; dr++)
        for (let dc = 0; dc < w; dc++)
            out.push((r + dr) * cols + (c + dc));
    return out;
};

// mapa posição → âncora, para todas as células ocupadas (a própria âncora ou cobertas pelo seu span)
export const buildOcupacao = (cells, spans, cols) => {
    const ocup = new Map();
    cells.forEach((botaoId, pos) => {
        if (botaoId == null) return;
        const { w, h } = getSpan(spans, pos);
        for (const p of footprint(pos, w, h, cols) || [pos]) ocup.set(p, pos);
    });
    return ocup;
};

// nº de linhas necessárias para caber todos os botões (âncora + altura do span, não só a âncora)
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

// Coloca (da biblioteca), move (arrasta um slot existente) ou redimensiona (mesma posição como
// alvo e como `selfAnchor`) um botão w×h em `targetPos`. Quaisquer botões já colocados cuja
// pegada colida com a nova são automaticamente empurrados para a próxima célula livre (varrimento
// linha-a-linha; a grelha cresce sozinha se for preciso). Devolve `null` se o alvo não couber na
// largura da grelha (não há como empurrar para fora dela horizontalmente).
export const colocarComEmpurrao = (cells, spans, cols, targetPos, botaoId, { w, h }, selfAnchor = null) => {
    const fpAlvo = footprint(targetPos, w, h, cols);
    if (!fpAlvo) return null;

    const novasCells = cells.slice();
    const novosSpans = { ...spans };
    const ocup = buildOcupacao(novasCells, novosSpans, cols);

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

    // "levanta" o próprio item (mover/redimensionar) primeiro, para não colidir consigo mesmo
    if (selfAnchor != null) levantar(selfAnchor);

    // âncoras alheias cuja pegada colide com o alvo — empurradas por ordem de posição (determinístico)
    const colisoes = [...new Set(fpAlvo.map((p) => ocup.get(p)).filter((a) => a != null))].sort((a, b) => a - b);
    for (const anchor of colisoes) {
        const item = levantar(anchor);
        let novaPos = 0, fp;
        while (!(fp = footprint(novaPos, item.w, item.h, cols)) || !fp.every((p) => !ocup.has(p))) novaPos++;
        pousar(novaPos, item);
    }

    pousar(targetPos, { botaoId, w, h });
    return { cells: novasCells, spans: novosSpans };
};
