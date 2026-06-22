import { useMemo, useState } from "react";
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
    useDraggable, useDroppable,
} from "@dnd-kit/core";
import ButtonTile from "./ButtonTile";
import { DISPOSITIVOS, COR_CATEGORIA, escalaPorColunas } from "./constants";

// remove nulls finais (mantém o array compacto)
const trim = (arr) => { let e = arr.length; while (e > 0 && arr[e - 1] == null) e--; return arr.slice(0, e); };

// ---- peça arrastável da biblioteca ----
const LibraryTile = ({ botao, apiUrl }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `lib:${botao.id}`, data: { tipo: "lib", botaoId: botao.id },
    });
    return (
        <div ref={setNodeRef} {...listeners} {...attributes}
            className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}>
            <ButtonTile botao={botao} apiUrl={apiUrl} size="P" />
        </div>
    );
};

// ---- célula da grelha (droppable; arrastável quando preenchida) ----
const GridCell = ({ pos, botao, apiUrl, size, onRemove }) => {
    const { setNodeRef: dropRef, isOver } = useDroppable({ id: `cell:${pos}`, data: { tipo: "cell", pos } });
    const drag = useDraggable({ id: `slot:${pos}`, data: { tipo: "slot", pos }, disabled: !botao });
    return (
        <div ref={dropRef} className="relative h-full min-h-0">
            {botao ? (
                <div ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes}
                    className={`group relative h-full cursor-grab active:cursor-grabbing ${drag.isDragging ? "opacity-40" : ""}`}>
                    <ButtonTile botao={botao} apiUrl={apiUrl} size={size} fill />
                    <button onClick={(e) => { e.stopPropagation(); onRemove(pos); }}
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        aria-label="Remover">
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                </div>
            ) : (
                <div className={`h-full rounded-2xl border-2 border-dashed transition-colors ${isOver ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-low"}`} />
            )}
        </div>
    );
};

const Segment = ({ ativo, onClick, children }) => (
    <button onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-staff-mono transition-colors ${ativo ? "bg-primary text-on-primary font-bold" : "text-on-surface-variant font-medium hover:bg-surface-container-high"}`}>
        {children}
    </button>
);

// ---- biblioteca (droppable para remover) — fora do componente para não perder o foco da pesquisa ----
const LibDrop = ({ children }) => {
    const { setNodeRef } = useDroppable({ id: "lib", data: { tipo: "lib" } });
    return <div ref={setNodeRef} className="w-full lg:w-[430px] shrink-0 bg-surface-container rounded-[24px] p-5 flex flex-col min-h-0">{children}</div>;
};

// ---- zona de lixo (só visível durante o arrasto) ----
const TrashZone = ({ visible }) => {
    const { setNodeRef, isOver } = useDroppable({ id: "trash", data: { tipo: "trash" } });
    return (
        <div ref={setNodeRef}
            className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 flex items-center gap-2 px-6 py-3 rounded-full border-2 border-dashed shadow-lg transition-all duration-200
                ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
                ${isOver ? "bg-error text-on-error border-error scale-105" : "bg-surface-container-high text-on-surface-variant border-outline-variant"}`}>
            <span className="material-symbols-outlined">delete</span>
            <span className="text-staff-mono font-semibold">{isOver ? "Solte para eliminar" : "Arraste aqui para eliminar"}</span>
        </div>
    );
};

const TabelaEditor = ({
    utenteNome, botoes, apiUrl,
    dispositivo, setDispositivo,
    cols, setCols, size, setSize,
    cells, setCells,
    dirty, saving, onSave, onVoltar,
}) => {
    const [activeId, setActiveId] = useState(null);
    const [busca, setBusca] = useState("");
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const botaoPorId = useMemo(() => Object.fromEntries(botoes.map((b) => [b.id, b])), [botoes]);

    const dev = DISPOSITIVOS[dispositivo];
    const [aspW, aspH] = dev.aspect.split("/").map((n) => parseFloat(n));
    const lastFilled = cells.reduce((m, v, i) => (v != null ? i : m), -1);
    // linhas que enchem a moldura mantendo as células ~quadradas (sem scroll nem espaço em branco)
    const rows = Math.max(Math.round((cols * aspH) / aspW), Math.ceil((lastFilled + 1) / cols), 1);
    const slots = rows * cols;

    const escala = escalaPorColunas(cols);
    const handleCols = (c) => { setCols(c); setSize(escalaPorColunas(c)); };

    // biblioteca agrupada por categoria, com filtro de procura
    const grupos = useMemo(() => {
        const f = busca.trim().toLowerCase();
        const m = {};
        for (const b of botoes) {
            if (f && !b.nome.toLowerCase().includes(f)) continue;
            const c = b.categoria || "Sem categoria";
            (m[c] = m[c] || []).push(b);
        }
        return Object.entries(m);
    }, [botoes, busca]);

    const onDragEnd = ({ active, over }) => {
        setActiveId(null);
        if (!over) return;
        const a = active.data.current, o = over.data.current;
        setCells((prev) => {
            const next = prev.slice();
            const need = (i) => { while (next.length <= i) next.push(null); };
            if (o.tipo === "trash" || o.tipo === "lib") { // largar no lixo ou na biblioteca = remover
                if (a.tipo === "slot") { need(a.pos); next[a.pos] = null; }
                return trim(next);
            }
            if (o.tipo === "cell") {
                need(o.pos);
                if (a.tipo === "lib") next[o.pos] = a.botaoId;       // colocar
                else if (a.tipo === "slot") {                        // mover/trocar
                    need(a.pos);
                    const tmp = next[o.pos]; next[o.pos] = next[a.pos]; next[a.pos] = tmp;
                }
                return trim(next);
            }
            return prev;
        });
    };

    // botão a mostrar no overlay durante o arrasto
    const activeBotao = (() => {
        if (!activeId) return null;
        const [tipo, val] = String(activeId).split(":");
        if (tipo === "lib") return botaoPorId[Number(val)];
        if (tipo === "slot") return botaoPorId[cells[Number(val)]];
        return null;
    })();

    return (
        <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-background text-on-background font-body-md">
                {/* ===== Barra superior (M3) ===== */}
                <div className="h-16 shrink-0 bg-surface-container-lowest border-b border-surface-variant flex items-center justify-between px-4 sm:px-6 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={onVoltar} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Voltar">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <span className="w-9 h-9 rounded-xl bg-primary text-on-primary hidden sm:flex items-center justify-center">
                            <span className="material-symbols-outlined text-[22px]">grid_view</span>
                        </span>
                        <h1 className="font-display-lg text-xl font-bold text-on-surface truncate">Gerir Tabela</h1>
                        <span className="text-on-surface-variant truncate hidden sm:inline">— {utenteNome}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Modelo (dispositivo) */}
                        <div className="hidden md:flex items-center gap-2">
                            <span className="text-staff-mono text-on-surface-variant">Modelo</span>
                            <div className="flex bg-surface-container rounded-full p-1 gap-1">
                                {Object.entries(DISPOSITIVOS).map(([k, d]) => (
                                    <Segment key={k} ativo={dispositivo === k} onClick={() => setDispositivo(k)}>
                                        <span className="material-symbols-outlined text-[17px] align-middle mr-1">{d.icon}</span>{d.label}
                                    </Segment>
                                ))}
                            </div>
                        </div>
                        <button onClick={onSave} disabled={!dirty || saving}
                            className="px-5 py-2 rounded-full bg-primary text-on-primary text-staff-mono font-semibold hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            {saving ? "A guardar…" : "Guardar"}
                        </button>
                    </div>
                </div>

                {/* Modelo em mobile */}
                <div className="md:hidden flex items-center gap-2 px-4 pt-3">
                    <div className="flex bg-surface-container rounded-full p-1 gap-1">
                        {Object.entries(DISPOSITIVOS).map(([k, d]) => (
                            <Segment key={k} ativo={dispositivo === k} onClick={() => setDispositivo(k)}>
                                <span className="material-symbols-outlined text-[17px] align-middle">{d.icon}</span>
                            </Segment>
                        ))}
                    </div>
                </div>

                {/* ===== Corpo ===== */}
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 p-4 sm:p-6 overflow-auto lg:overflow-hidden">
                    {/* Canvas */}
                    <div className="flex-1 bg-surface-container-lowest rounded-[24px] shadow-sm p-5 sm:p-6 flex flex-col min-w-0 min-h-0">
                        <div className="flex items-end justify-between gap-3 mb-4">
                            <div>
                                <h2 className="font-display-lg text-xl font-bold text-on-surface">Quadro Atual</h2>
                                <p className="text-staff-mono text-on-surface-variant">Arraste botões da biblioteca para qualquer célula.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-on-surface-variant text-[18px]" title="Mais pequenos">apps</span>
                                <input
                                    type="range" min={dev.colsMin} max={dev.colsMax}
                                    value={dev.colsMin + dev.colsMax - cols}
                                    onChange={(e) => handleCols(dev.colsMin + dev.colsMax - Number(e.target.value))}
                                    className="w-32 sm:w-44 accent-primary cursor-pointer"
                                    aria-label="Tamanho dos botões"
                                />
                                <span className="material-symbols-outlined text-on-surface-variant text-[26px]" title="Maiores">crop_square</span>
                            </div>
                        </div>

                        {/* Borda a simular o dispositivo */}
                        <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
                            <div className="w-full rounded-[20px] border-2 border-outline-variant bg-surface p-3 sm:p-4 overflow-hidden"
                                style={{ maxWidth: dev.maxW, aspectRatio: dev.aspect, maxHeight: "100%" }}>
                                <div className="grid gap-3 h-full"
                                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
                                    {Array.from({ length: slots }).map((_, pos) => (
                                        <GridCell key={pos} pos={pos} botao={botaoPorId[cells[pos]]} apiUrl={apiUrl} size={escala}
                                            onRemove={(p) => setCells((prev) => trim(prev.map((v, i) => (i === p ? null : v))))} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Biblioteca (droppable para remover) */}
                    <LibDrop>
                        <h2 className="font-display-lg text-lg font-bold text-on-surface mb-3">Biblioteca de Botões</h2>
                        <div className="relative mb-4">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar botão…"
                                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface-container-lowest border-none focus:ring-2 focus:ring-primary text-body-md text-on-surface" />
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto -mr-2 pr-2">
                            {grupos.map(([cat, lista]) => (
                                <div key={cat} className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_CATEGORIA[cat] || "#7a7582" }} />
                                        <span className="font-display-lg text-staff-mono font-bold text-on-surface">{cat}</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {lista.map((b) => <LibraryTile key={b.id} botao={b} apiUrl={apiUrl} />)}
                                    </div>
                                </div>
                            ))}
                            {grupos.length === 0 && <p className="text-staff-mono text-on-surface-variant">Sem botões.</p>}
                        </div>
                    </LibDrop>
                </div>
            </div>

            <TrashZone visible={!!activeId} />

            <DragOverlay dropAnimation={null}>
                {activeBotao ? <div style={{ width: 96 }}><ButtonTile botao={activeBotao} apiUrl={apiUrl} size="P" /></div> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default TabelaEditor;
