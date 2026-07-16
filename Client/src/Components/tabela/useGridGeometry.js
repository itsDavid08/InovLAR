import { useMemo } from "react";
import { DISPOSITIVOS, matrizCategorias } from "./constants";
import { buildOcupacao, extentRows } from "./gridSpans";

// Geometria partilhada da grelha de uma tabela. Era calculada (com pequenas
// variações) no TabelaEditor, no TabuleiroComunicacao e no TabelaPreview —
// uma correção tinha de ser feita em 3 sítios.
//
// Devolve:
//  - rows: nº de linhas que enche a moldura do dispositivo mantendo as células
//    ~quadradas, nunca menor que a extensão real dos botões (âncora + span)
//  - slots: rows * cols
//  - ocupacao: Map posição → âncora (para saltar células cobertas por spans)
//  - gridCategorias: matriz de categorias para a fusão visual (raioFusao);
//    dispensável nos previews — basta não passar botaoPorId
export function useGridGeometry({ cells, spans, cols, dispositivo, botaoPorId = {} }) {
    const [aspW, aspH] = (DISPOSITIVOS[dispositivo]?.aspect || "16 / 10")
        .split("/")
        .map((n) => parseFloat(n));
    const rows = Math.max(
        Math.round((cols * aspH) / aspW),
        extentRows(cells, spans, cols),
        1,
    );
    const slots = rows * cols;
    const ocupacao = useMemo(
        () => buildOcupacao(cells, spans, cols),
        [cells, spans, cols],
    );
    const gridCategorias = useMemo(
        () => matrizCategorias(cells, spans, cols, rows, botaoPorId),
        [cells, spans, cols, rows, botaoPorId],
    );
    return { rows, slots, ocupacao, gridCategorias };
}
