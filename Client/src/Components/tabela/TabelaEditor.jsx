import { useMemo, useRef, useState } from "react";
import {
    DndContext,
    DragOverlay,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import GridCell from "./GridCell";
import LibDrop from "./LibDrop";
import TrashZone from "./TrashZone";
import EditorTopBar from "./EditorTopBar";
import PainelCoresCategoria from "./PainelCoresCategoria";
import BibliotecaBotoes from "./BibliotecaBotoes";
import ButtonTile from "./ButtonTile";
import { DISPOSITIVOS, isSOS, resolverCorCategoria, raioFusao, escalaPorColunas } from "./constants";
import { getSpan, colocarComEmpurrao, trim } from "./gridSpans";
import { useGridGeometry } from "./useGridGeometry";
import { usePinchZoom } from "./hooks/usePinchZoom";
import { useGridResize } from "./hooks/useGridResize";
import { useDragPlacement } from "./hooks/useDragPlacement";
import { useButtonById } from "../../hooks/useButtonById";
import { t } from "../../i18n";

// Editor de tabelas (canvas + biblioteca de botões). Orquestra os hooks de
// gesto (pinch-zoom, resize por arrasto, colocação por drag-and-drop) e os
// componentes extraídos; a lógica de cada gesto vive no seu próprio hook em
// `hooks/`, e cada peça visual no seu próprio ficheiro — ver DEVELOPMENT_LOG.md
// (Fase 3 do refactor) para o porquê da divisão.
//
// Interface: `config` (cols/size/cells/spans/coresCategoria) + `onPatch(parcial)`,
// em vez de um par valor/setter por campo — o chamador (useTabelaConfigs) já
// trabalha com patches parciais internamente.
const TabelaEditor = ({
    titulo = t.tabelaEditor.manageTabelaTitle,
    utenteNome,
    botoes,
    apiUrl,
    dispositivo,
    setDispositivo,
    config,
    onPatch,
    dirty,
    saving,
    onSave,
    onVoltar,
}) => {
    const { cols, cells, spans = {}, coresCategoria = {} } = config;

    const [busca, setBusca] = useState("");
    const [selecionado, setSelecionado] = useState(null); // { tipo:"lib", botaoId } | { tipo:"slot", pos }
    const [coresAbertas, setCoresAbertas] = useState(false);
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const { zoom, aplicarZoom, frameWrapRef } = usePinchZoom();
    const gridRef = useRef(null);
    const botaoPorId = useButtonById(botoes);

    // Aplica o resultado de `colocarComEmpurrao` (colocar/mover/redimensionar):
    // ponto único que faz o `trim` antes de gravar — os hooks de gesto só
    // conhecem `onPlace(cells, spans)`, não os detalhes de compactação do array.
    const commitPlacement = (newCells, newSpans) => {
        onPatch({ cells: trim(newCells), spans: newSpans });
    };

    // Remove um botão colocado e a respetiva entrada de span (se tiver).
    const removerBotao = (pos) => {
        const newCells = trim(cells.map((v, i) => (i === pos ? null : v)));
        if (spans[pos]) {
            const { [pos]: _omit, ...resto } = spans;
            onPatch({ cells: newCells, spans: resto });
        } else {
            onPatch({ cells: newCells });
        }
    };

    const { spansEfetivos, cellsEfetivas, startResize } = useGridResize({
        cells,
        spans,
        cols,
        gridRef,
        onPlace: commitPlacement,
    });
    const {
        activeId,
        dragFootprint,
        onDragStart: onDragStartPlacement,
        onDragMove: onDragMovePlacement,
        onDragEnd,
        onDragCancel,
    } = useDragPlacement({ cells, spans, cols, gridRef, onPlace: commitPlacement, onRemove: removerBotao });

    // Geometria de desenho: usa cells/spans "efetivos" (com a pré-visualização
    // de um resize em curso sobreposta) — ver useGridResize para o porquê.
    const { rows, slots, ocupacao, gridCategorias } = useGridGeometry({
        cells: cellsEfetivas,
        spans: spansEfetivos,
        cols,
        dispositivo,
        botaoPorId,
    });

    const aoSelecionarLib = (botaoId) =>
        setSelecionado((s) =>
            s?.tipo === "lib" && s.botaoId === botaoId ? null : { tipo: "lib", botaoId },
        );

    const aoClicarCelula = (pos) => {
        if (selecionado?.tipo === "slot" && selecionado.pos === pos) {
            setSelecionado(null);
            return;
        }
        if (!selecionado) {
            if (cells[pos] != null) setSelecionado({ tipo: "slot", pos });
            return;
        }
        if (selecionado.tipo === "lib") {
            const resultado = colocarComEmpurrao(cells, spans, cols, pos, selecionado.botaoId, { w: 1, h: 1 }, null);
            if (resultado) commitPlacement(resultado.cells, resultado.spans);
        } else if (selecionado.tipo === "slot") {
            const { w, h } = getSpan(spans, selecionado.pos);
            const resultado = colocarComEmpurrao(cells, spans, cols, pos, cells[selecionado.pos], { w, h }, selecionado.pos);
            if (resultado) commitPlacement(resultado.cells, resultado.spans);
        }
        setSelecionado(null);
    };

    const aoEliminarSelecionado = () => {
        if (selecionado?.tipo !== "slot") return;
        removerBotao(selecionado.pos);
        setSelecionado(null);
    };

    // categorias presentes no Quadro Atual (para o painel de cores), excluindo SOS
    const categoriasNoQuadro = useMemo(() => {
        const set = new Set();
        for (const bId of cells) {
            const b = botaoPorId[bId];
            if (b && !isSOS(b)) set.add(b.categoria || "Sem categoria");
        }
        return [...set].sort();
    }, [cells, botaoPorId]);

    const dev = DISPOSITIVOS[dispositivo];
    const escala = escalaPorColunas(cols);
    const handleCols = (c) => onPatch({ cols: c, size: escalaPorColunas(c) });

    // botão a mostrar no overlay durante o arrasto, e o seu tamanho real (w×h) —
    // da biblioteca é sempre 1x1; um slot já colocado mantém o seu span, para o
    // "ghost" do arrasto corresponder ao tamanho real.
    const activeBotao = (() => {
        if (!activeId) return null;
        const [tipo, val] = String(activeId).split(":");
        if (tipo === "lib") return botaoPorId[Number(val)];
        if (tipo === "slot") return botaoPorId[cells[Number(val)]];
        return null;
    })();
    const activeSpan = (() => {
        if (!activeId) return { w: 1, h: 1 };
        const [tipo, val] = String(activeId).split(":");
        if (tipo === "slot") return getSpan(spans, Number(val));
        return { w: 1, h: 1 };
    })();
    const cellPx = gridRef.current ? gridRef.current.getBoundingClientRect().width / cols : 96;

    return (
        <DndContext
            sensors={sensors}
            onDragStart={(e) => {
                onDragStartPlacement(e);
                setSelecionado(null);
            }}
            onDragMove={(e) => onDragMovePlacement(e, rows)}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
        >
            <div
                onClick={() => setSelecionado(null)}
                className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-background text-on-background font-body-md"
            >
                <EditorTopBar
                    titulo={titulo}
                    utenteNome={utenteNome}
                    dispositivo={dispositivo}
                    setDispositivo={setDispositivo}
                    dirty={dirty}
                    saving={saving}
                    onSave={onSave}
                    onVoltar={onVoltar}
                />

                {/* ===== Corpo ===== */}
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 p-4 sm:p-6 overflow-auto lg:overflow-hidden">
                    {/* Canvas */}
                    <div className="flex-1 bg-surface-container-lowest rounded-[24px] shadow-sm p-3 sm:p-4 flex flex-col min-w-0 min-h-0 relative">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <h2
                                className="font-display-lg text-base font-bold text-on-surface"
                                title={t.tabelaEditor.currentBoardHint}
                            >
                                {t.tabelaEditor.currentBoard}
                            </h2>
                            <div className="flex items-center gap-3">
                                <span
                                    className="material-symbols-outlined text-on-surface-variant text-[18px]"
                                    title={t.tabelaEditor.smaller}
                                >
                                    apps
                                </span>
                                <input
                                    type="range"
                                    min={dev.colsMin}
                                    max={dev.colsMax}
                                    value={dev.colsMin + dev.colsMax - cols}
                                    onChange={(e) => handleCols(dev.colsMin + dev.colsMax - Number(e.target.value))}
                                    className="w-32 sm:w-44 accent-primary cursor-pointer"
                                    aria-label={t.tabelaEditor.device}
                                />
                                <span
                                    className="material-symbols-outlined text-on-surface-variant text-[26px]"
                                    title={t.tabelaEditor.bigger}
                                >
                                    crop_square
                                </span>
                            </div>
                        </div>

                        {/* Borda a simular o dispositivo (dois dedos = zoom) */}
                        <div
                            ref={frameWrapRef}
                            className="flex-1 overflow-auto min-h-0"
                            style={{ touchAction: "pan-x pan-y" }}
                        >
                            <div className="min-h-full w-full flex items-center justify-center">
                                <div
                                    className="w-full rounded-[20px] border-2 border-outline-variant bg-surface p-2 sm:p-3 overflow-hidden"
                                    style={{
                                        maxWidth: dev.maxW,
                                        aspectRatio: dev.aspect,
                                        maxHeight: "100%",
                                        transform: `scale(${zoom})`,
                                        transformOrigin: "center",
                                    }}
                                >
                                    <div
                                        ref={gridRef}
                                        className="grid h-full"
                                        style={{
                                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                                            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                                        }}
                                    >
                                        {Array.from({ length: slots }).map((_, pos) => {
                                            const anchor = ocupacao.get(pos);
                                            if (anchor !== undefined && anchor !== pos) return null; // coberta por um botão maior
                                            const isAnchor = anchor === pos;
                                            const { w, h } = isAnchor ? getSpan(spansEfetivos, pos) : { w: 1, h: 1 };
                                            const b = isAnchor ? botaoPorId[cellsEfetivas[pos]] : null;
                                            const cor = b && !isSOS(b) ? resolverCorCategoria(b.categoria, coresCategoria) : null;
                                            const r = Math.floor(pos / cols),
                                                c = pos % cols;
                                            return (
                                                <GridCell
                                                    key={pos}
                                                    pos={pos}
                                                    botao={b}
                                                    apiUrl={apiUrl}
                                                    size={escala}
                                                    corFundo={cor}
                                                    col={c + 1}
                                                    row={r + 1}
                                                    w={w}
                                                    h={h}
                                                    raio={raioFusao(gridCategorias, r, c, w, h)}
                                                    selecionado={selecionado?.tipo === "slot" && selecionado.pos === pos}
                                                    onCellClick={aoClicarCelula}
                                                    onResizeStart={(e, p, handle) => startResize(e, p, handle, rows)}
                                                    onRemove={removerBotao}
                                                    destacado={dragFootprint?.has(pos)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {zoom > 1.02 && (
                            <button
                                onClick={() => aplicarZoom(1)}
                                className="absolute bottom-4 right-4 z-20 flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface shadow-md text-staff-mono"
                            >
                                <span className="material-symbols-outlined text-[18px]">zoom_out_map</span>{" "}
                                {t.tabelaEditor.resetZoom}
                            </button>
                        )}
                    </div>

                    {/* Biblioteca (droppable para remover) */}
                    <LibDrop>
                        <PainelCoresCategoria
                            categoriasNoQuadro={categoriasNoQuadro}
                            coresCategoria={coresCategoria}
                            setCoresCategoria={(fn) =>
                                onPatch({ coresCategoria: typeof fn === "function" ? fn(coresCategoria) : fn })
                            }
                            aberto={coresAbertas}
                            setAberto={setCoresAbertas}
                        />
                        <BibliotecaBotoes
                            botoes={botoes}
                            apiUrl={apiUrl}
                            busca={busca}
                            setBusca={setBusca}
                            selecionado={selecionado}
                            onSelect={aoSelecionarLib}
                        />
                    </LibDrop>
                </div>
            </div>

            <TrashZone
                visible={!!activeId || selecionado?.tipo === "slot"}
                tap={!activeId && selecionado?.tipo === "slot"}
                onClick={aoEliminarSelecionado}
            />

            <DragOverlay dropAnimation={null}>
                {activeBotao ? (
                    <div style={{ width: cellPx * activeSpan.w, height: cellPx * activeSpan.h }}>
                        <ButtonTile botao={activeBotao} apiUrl={apiUrl} size={escala} fill />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default TabelaEditor;
