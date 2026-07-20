import { useMemo, useState } from "react";
import { getSpan, footprint, colocarComEmpurrao } from "../gridSpans";

// Colocação/movimentação por drag-and-drop (dnd-kit). `onPlace(cells, spans)`
// e `onRemove(pos)` espelham as duas operações possíveis num drop: pousar
// numa célula, ou largar no lixo/biblioteca para remover.
export function useDragPlacement({ cells, spans, cols, gridRef, onPlace, onRemove }) {
    const [activeId, setActiveId] = useState(null);
    const [dragPreview, setDragPreview] = useState(null); // { pos, w, h } — onde o botão vai realmente cair

    // Converte a posição real (em pixels) do elemento a ser arrastado — não do
    // cursor — na célula-âncora onde o botão vai efetivamente cair. `rect` é
    // `active.rect.current.translated` do dnd-kit: o retângulo do próprio nó a
    // ser arrastado, já seguindo o "grab point" original, exatamente o que se
    // vê no ecrã (ghost). Sem isto, a colocação usava a célula sob o cursor,
    // que não corresponde ao canto do botão quando este é maior que 1x1.
    const ancoraDoArrasto = (rect, w, rows) => {
        const el = gridRef.current;
        if (!el || !rect) return null;
        const gridRect = el.getBoundingClientRect();
        const cellPxW = gridRect.width / cols,
            cellPxH = gridRect.height / rows;
        let col = Math.round((rect.left - gridRect.left) / cellPxW);
        let row = Math.round((rect.top - gridRect.top) / cellPxH);
        col = Math.max(0, Math.min(col, cols - w));
        row = Math.max(0, row);
        return row * cols + col;
    };

    const onDragStart = ({ active }) => setActiveId(active.id);

    // `rows` é passado pelo chamador (ver nota em useGridResize.startResize —
    // mesma razão: coincide sempre com o rows "efetivo" quando não há resize ativo).
    const onDragMove = ({ active }, rows) => {
        const a = active.data.current;
        if (!a) return;
        const { w, h } = a.tipo === "slot" ? getSpan(spans, a.pos) : { w: 1, h: 1 };
        const anchor = ancoraDoArrasto(active.rect.current.translated, w, rows);
        if (anchor != null) setDragPreview({ pos: anchor, w, h });
    };

    const onDragEnd = ({ active, over }) => {
        setActiveId(null);
        const preview = dragPreview;
        setDragPreview(null);
        if (!over) return;
        const a = active.data.current,
            o = over.data.current;
        if (o.tipo === "trash" || o.tipo === "lib") {
            // largar no lixo ou na biblioteca = remover
            if (a.tipo === "slot") onRemove(a.pos);
            return;
        }
        if (o.tipo === "cell") {
            if (a.tipo === "lib") {
                // colocar — na posição real do botão, não na célula sob o cursor
                const anchor = preview?.pos ?? o.pos;
                const resultado = colocarComEmpurrao(cells, spans, cols, anchor, a.botaoId, { w: 1, h: 1 }, null);
                if (resultado) onPlace(resultado.cells, resultado.spans);
            } else if (a.tipo === "slot") {
                // mover
                const { w, h } = getSpan(spans, a.pos);
                const anchor = preview?.pos ?? o.pos;
                const resultado = colocarComEmpurrao(cells, spans, cols, anchor, cells[a.pos], { w, h }, a.pos);
                if (resultado) onPlace(resultado.cells, resultado.spans);
            }
        }
    };

    const onDragCancel = () => {
        setActiveId(null);
        setDragPreview(null);
    };

    // footprint completo a destacar na grelha enquanto se arrasta (não só a célula sob o cursor)
    const dragFootprint = useMemo(
        () =>
            dragPreview
                ? new Set(footprint(dragPreview.pos, dragPreview.w, dragPreview.h, cols) || [])
                : null,
        [dragPreview, cols],
    );

    return { activeId, dragPreview, dragFootprint, onDragStart, onDragMove, onDragEnd, onDragCancel };
}
