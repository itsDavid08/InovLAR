import { useDraggable, useDroppable } from "@dnd-kit/core";
import ButtonTile from "./ButtonTile";
import MarchingAnts from "./MarchingAnts";
import { t } from "../../i18n";

// 8 puxadores de redimensionar (4 cantos + 4 arestas), cada um com um pivô FIXO
// (o lado/canto oposto) — ver a nota sobre pivôs fixos em useGridResize.js.
// Data-driven: eram 8 blocos JSX quase idênticos, agora um único .map.
const RESIZE_HANDLES = [
    { handle: "nw", pos: "-top-1 -left-1 w-3.5 h-3.5", cursor: "cursor-nwse-resize" },
    { handle: "ne", pos: "-top-1 -right-1 w-3.5 h-3.5", cursor: "cursor-nesw-resize" },
    { handle: "sw", pos: "-bottom-1 -left-1 w-3.5 h-3.5", cursor: "cursor-nesw-resize" },
    { handle: "se", pos: "-bottom-1 -right-1 w-3.5 h-3.5", cursor: "cursor-nwse-resize" },
    { handle: "n", pos: "-top-1 left-1/2 -translate-x-1/2 w-5 h-2.5", cursor: "cursor-ns-resize" },
    { handle: "s", pos: "-bottom-1 left-1/2 -translate-x-1/2 w-5 h-2.5", cursor: "cursor-ns-resize" },
    { handle: "w", pos: "-left-1 top-1/2 -translate-y-1/2 w-2.5 h-5", cursor: "cursor-ew-resize" },
    { handle: "e", pos: "-right-1 top-1/2 -translate-y-1/2 w-2.5 h-5", cursor: "cursor-ew-resize" },
];

// Célula da grelha (droppable; arrastável quando preenchida).
// `col`/`row` (linhas 1-indexadas) + `w`/`h` posicionam explicitamente o retângulo que este
// botão ocupa — não se confia no auto-flow do CSS Grid, que não sabe que células vizinhas
// foram propositadamente omitidas (cobertas por este ou por outro span).
const GridCell = ({
    pos,
    botao,
    apiUrl,
    size,
    corFundo,
    col,
    row,
    w = 1,
    h = 1,
    raio = { borderRadius: "1rem" },
    onRemove,
    onResizeStart,
    selecionado,
    onCellClick,
    destacado,
}) => {
    const { setNodeRef: dropRef, isOver } = useDroppable({
        id: `cell:${pos}`,
        data: { tipo: "cell", pos },
    });
    const drag = useDraggable({
        id: `slot:${pos}`,
        data: { tipo: "slot", pos },
        disabled: !botao,
    });
    return (
        <div
            ref={dropRef}
            className="relative h-full min-h-0 transition-all"
            style={{
                gridColumn: `${col} / span ${w}`,
                gridRow: `${row} / span ${h}`,
                background: corFundo || "transparent",
                ...raio,
            }}
            onClick={(e) => {
                e.stopPropagation();
                onCellClick(pos);
            }}
        >
            {/* wrapper próprio (não o grid item em si) para o container query — misturar
            `container-type: size` com o posicionamento por gridColumn/gridRow do item causava
            uma reflow estranha em toda a grelha (linhas 1x1 a ficarem achatadas). O container
            e o consumidor das unidades cq* têm de ser elementos diferentes: cqh dentro do
            próprio container resolveria contra um antecessor (ou contra a viewport, se não
            houver nenhum), não contra a célula. */}
            <div className="h-full min-h-0" style={{ containerType: "size" }}>
                <div
                    className="h-full min-h-0"
                    style={{
                        // padding em % resolve SEMPRE contra a largura do containing block (até
                        // para top/bottom — regra do spec CSS), por isso paddingBlock usa cqh
                        // (altura da célula, via o container acima) em vez de %. paddingInline
                        // fica em % de largura dividido por w, para dar "4% de 1 coluna"
                        // independentemente de quantas colunas o botão ocupa.
                        paddingInline: `${4 / w}%`,
                        paddingBlock: "4cqh",
                    }}
                >
                {botao ? (
                    <div
                        ref={drag.setNodeRef}
                        {...drag.listeners}
                        {...drag.attributes}
                        className={`group relative h-full cursor-pointer active:cursor-grabbing ${drag.isDragging ? "opacity-40" : ""}`}
                    >
                        <ButtonTile
                            botao={botao}
                            apiUrl={apiUrl}
                            size={size}
                            fill
                            w={w}
                        />
                        {selecionado && <MarchingAnts />}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove(pos);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            aria-label={t.tabelaEditor.remove}
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                close
                            </span>
                        </button>
                        {selecionado && RESIZE_HANDLES.map(({ handle, pos: posClasses, cursor }) => (
                            <div
                                key={handle}
                                onPointerDown={(e) => onResizeStart(e, pos, handle)}
                                style={{ touchAction: "none" }}
                                className={`absolute ${posClasses} rounded-full bg-primary shadow ${cursor} z-10`}
                                aria-label={t.tabelaEditor.resizeHandle[handle]}
                            />
                        ))}
                    </div>
                ) : (
                    <div
                        className={`h-full rounded-2xl border-2 border-dashed transition-colors ${isOver || destacado ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-low"}`}
                    />
                )}
                </div>
            </div>
        </div>
    );
};

export default GridCell;
