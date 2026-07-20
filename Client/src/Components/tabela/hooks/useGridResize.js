import { useMemo, useState } from "react";
import { getSpan, colocarComEmpurrao } from "../gridSpans";

// Redimensionar por arrasto (pega WYSIWYG). Eventos de ponteiro nativos, à
// parte do DndContext (que trata de mover peças) — evita conflito entre os
// dois mecanismos de arrasto, tal como o pinch-zoom faz à parte do resto.
//
// 8 puxadores (4 cantos + 4 arestas — ver RESIZE_HANDLES em GridCell.jsx), cada
// um com um pivô FIXO (o lado/canto oposto), tal como numa caixa de redimensionar
// clássica (Figma/PowerPoint/etc). Ao contrário de uma versão anterior que decidia
// o pivô pelo sinal do delta em cada onMove, isso causava confusão ao inverter o
// sentido do arrasto a meio (ex.: crescer para cima e depois tentar encolher de
// volta era interpretado como "crescer ainda mais"). Aqui o pivô de cada puxador
// nunca muda durante o gesto — sem ambiguidade.
//
// `onPlace(cells, spans)` é chamado no pointerup com o resultado de
// `colocarComEmpurrao` (ainda não trimado — quem chama decide isso).
export function useGridResize({ cells, spans, cols, gridRef, onPlace }) {
    const [resizePreview, setResizePreview] = useState(null); // { pos, anchorPos, w, h }

    // `rows` é passado pelo chamador no momento do gesto (não guardado no hook):
    // no início de um resize não há nenhum outro gesto ativo, por isso o `rows`
    // "efetivo" (pós-preview) e o `rows` bruto (de cells/spans) coincidem sempre
    // nesse instante — ver useGridGeometry no TabelaEditor.
    const startResize = (e, pos, handle, rows) => {
        e.stopPropagation();
        e.preventDefault();
        const el = gridRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const { w: startW, h: startH } = getSpan(spans, pos);
        const startX = e.clientX,
            startY = e.clientY;
        const cellPxW = rect.width / cols,
            cellPxH = rect.height / rows;
        const startR = Math.floor(pos / cols),
            startC = pos % cols;
        const brR = startR + startH - 1,
            brC = startC + startW - 1;
        // que lado cada puxador desloca (o outro lado desse eixo é o pivô, fica fixo)
        const ladoCol = handle.includes("e")
            ? "right"
            : handle.includes("w")
              ? "left"
              : null;
        const ladoRow = handle.includes("n")
            ? "top"
            : handle.includes("s")
              ? "bottom"
              : null;

        setResizePreview({ pos, anchorPos: pos, w: startW, h: startH });

        const onMove = (ev) => {
            const deltaCols = Math.round((ev.clientX - startX) / cellPxW);
            const deltaRows = Math.round((ev.clientY - startY) / cellPxH);

            let novoLeft = startC,
                novoRight = brC;
            if (ladoCol === "right") {
                novoRight = Math.max(startC, Math.min(cols - 1, brC + deltaCols));
            } else if (ladoCol === "left") {
                novoLeft = Math.min(brC, Math.max(0, startC + deltaCols));
            }
            let novoTop = startR,
                novoBottom = brR;
            if (ladoRow === "bottom") {
                novoBottom = Math.max(startR, brR + deltaRows);
            } else if (ladoRow === "top") {
                novoTop = Math.min(brR, Math.max(0, startR + deltaRows));
            }

            const novoW = novoRight - novoLeft + 1;
            const novoH = novoBottom - novoTop + 1;
            const novaAncora = novoTop * cols + novoLeft;
            setResizePreview({ pos: novaAncora, anchorPos: pos, w: novoW, h: novoH });
        };
        const finalizar = (commit) => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onCancel);
            setResizePreview((prev) => {
                if (commit && prev) {
                    const resultado = colocarComEmpurrao(
                        cells,
                        spans,
                        cols,
                        prev.pos,
                        cells[prev.anchorPos],
                        { w: prev.w, h: prev.h },
                        prev.anchorPos,
                    );
                    if (resultado) onPlace(resultado.cells, resultado.spans);
                }
                return null;
            });
        };
        const onUp = () => finalizar(true);
        const onCancel = () => finalizar(false);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
    };

    // spans/cells "efetivos" para efeitos de desenho: durante um arrasto de
    // redimensionar, sobrepõe o tamanho em pré-visualização ao da âncora que
    // está a ser redimensionada — sem isto, as células vizinhas que a
    // pré-visualização passa a cobrir continuavam a ser calculadas a partir do
    // `spans` committado (ainda no tamanho antigo) e renderizavam-se como
    // células livres à parte, sobrepostas ao botão a crescer.
    const spansEfetivos = useMemo(() => {
        if (!resizePreview) return spans;
        const { [resizePreview.anchorPos]: _omit, ...resto } = spans;
        return { ...resto, [resizePreview.pos]: { w: resizePreview.w, h: resizePreview.h } };
    }, [spans, resizePreview]);
    // quando o resize cresce para cima/esquerda a âncora desloca-se — `cells`
    // (o botaoId) tem de "seguir" essa deslocação só para efeitos de desenho,
    // sem tocar no estado real ainda (só committado no pointerup, em `finalizar`).
    const cellsEfetivas = useMemo(() => {
        if (!resizePreview || resizePreview.pos === resizePreview.anchorPos) return cells;
        const arr = cells.slice();
        const botaoId = arr[resizePreview.anchorPos];
        arr[resizePreview.anchorPos] = null;
        while (arr.length <= resizePreview.pos) arr.push(null);
        arr[resizePreview.pos] = botaoId;
        return arr;
    }, [cells, resizePreview]);

    return { resizePreview, spansEfetivos, cellsEfetivas, startResize };
}
