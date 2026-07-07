import { useMemo, useState, useRef, useEffect } from "react";
import {
    DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors,
    useDraggable, useDroppable,
} from "@dnd-kit/core";
import ButtonTile from "./ButtonTile";
import { DISPOSITIVOS, COR_CATEGORIA, resolverCorCategoria, matrizCategorias, raioFusao, escalaPorColunas } from "./constants";

// remove nulls finais (mantém o array compacto)
const trim = (arr) => { let e = arr.length; while (e > 0 && arr[e - 1] == null) e--; return arr.slice(0, e); };

// contorno animado (linha tracejada a mexer) do item selecionado
const MarchingAnts = () => (<svg className="ants-svg text-primary"><rect /></svg>);

// ---- peça arrastável da biblioteca ----
const LibraryTile = ({ botao, apiUrl, selecionado, onSelect }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `lib:${botao.id}`, data: { tipo: "lib", botaoId: botao.id },
    });
    return (
        <div ref={setNodeRef} {...listeners} {...attributes} onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`relative cursor-pointer active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}>
            <ButtonTile botao={botao} apiUrl={apiUrl} size="P" />
            {selecionado && <MarchingAnts />}
        </div>
    );
};

// ---- célula da grelha (droppable; arrastável quando preenchida) ----
const GridCell = ({ pos, botao, apiUrl, size, corFundo, raio = { borderRadius: "1rem" }, onRemove, selecionado, onCellClick }) => {
    const { setNodeRef: dropRef, isOver } = useDroppable({ id: `cell:${pos}`, data: { tipo: "cell", pos } });
    const drag = useDraggable({ id: `slot:${pos}`, data: { tipo: "slot", pos }, disabled: !botao });
    return (
        <div ref={dropRef} className="relative h-full min-h-0 transition-all" style={{ padding: "4%", background: corFundo || "transparent", ...raio }} onClick={(e) => { e.stopPropagation(); onCellClick(pos); }}>
            {botao ? (
                <div ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes}
                    className={`group relative h-full cursor-pointer active:cursor-grabbing ${drag.isDragging ? "opacity-40" : ""}`}>
                    <ButtonTile botao={botao} apiUrl={apiUrl} size={size} fill />
                    {selecionado && <MarchingAnts />}
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

// ---- zona de lixo: aparece ao arrastar OU com um botão selecionado (toque para eliminar) ----
const TrashZone = ({ visible, tap, onClick }) => {
    const { setNodeRef, isOver } = useDroppable({ id: "trash", data: { tipo: "trash" } });
    return (
        <div ref={setNodeRef} onClick={onClick}
            className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 flex items-center gap-2 px-6 py-3 rounded-full border-2 border-dashed shadow-lg transition-all duration-200
                ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
                ${isOver ? "bg-error text-on-error border-error scale-105" : "bg-error-container text-on-error-container border-error cursor-pointer"}`}>
            <span className="material-symbols-outlined">delete</span>
            <span className="text-staff-mono font-semibold">{isOver ? "Solte para eliminar" : tap ? "Toque para eliminar" : "Arraste aqui para eliminar"}</span>
        </div>
    );
};

const TabelaEditor = ({
    titulo = "Gerir Tabela",
    utenteNome, botoes, apiUrl,
    dispositivo, setDispositivo,
    cols, setCols, size, setSize,
    cells, setCells,
    coresCategoria = {}, setCoresCategoria,
    dirty, saving, onSave, onVoltar,
}) => {
    const [activeId, setActiveId] = useState(null);
    const [busca, setBusca] = useState("");
    const [selecionado, setSelecionado] = useState(null); // { tipo:"lib", botaoId } | { tipo:"slot", pos }
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const frameWrapRef = useRef(null);
    const pinch = useRef({ dist: 0, zoom: 1 });
    const aplicarZoom = (z) => { const c = Math.min(3, Math.max(1, z)); zoomRef.current = c; setZoom(c); };

    useEffect(() => {
        const el = frameWrapRef.current;
        if (!el) return;
        const d = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        const onStart = (e) => { if (e.touches.length === 2) pinch.current = { dist: d(e.touches), zoom: zoomRef.current }; };
        const onMove = (e) => {
            if (e.touches.length === 2 && pinch.current.dist) {
                e.preventDefault();
                aplicarZoom(pinch.current.zoom * (d(e.touches) / pinch.current.dist));
            }
        };
        const onEnd = (e) => { if (e.touches.length < 2) pinch.current.dist = 0; };
        el.addEventListener("touchstart", onStart, { passive: false });
        el.addEventListener("touchmove", onMove, { passive: false });
        el.addEventListener("touchend", onEnd);
        el.addEventListener("touchcancel", onEnd);
        return () => {
            el.removeEventListener("touchstart", onStart);
            el.removeEventListener("touchmove", onMove);
            el.removeEventListener("touchend", onEnd);
            el.removeEventListener("touchcancel", onEnd);
        };
    }, []);

    const aoSelecionarLib = (botaoId) =>
        setSelecionado((s) => (s?.tipo === "lib" && s.botaoId === botaoId ? null : { tipo: "lib", botaoId }));

    const aoClicarCelula = (pos) => {
        if (selecionado?.tipo === "slot" && selecionado.pos === pos) { setSelecionado(null); return; }
        if (!selecionado) { if (cells[pos] != null) setSelecionado({ tipo: "slot", pos }); return; }
        setCells((prev) => {
            const next = prev.slice();
            const need = (i) => { while (next.length <= i) next.push(null); };
            need(pos);
            if (selecionado.tipo === "lib") next[pos] = selecionado.botaoId;            // colocar
            else if (selecionado.tipo === "slot") {                                      // mover/trocar
                need(selecionado.pos);
                const tmp = next[pos]; next[pos] = next[selecionado.pos]; next[selecionado.pos] = tmp;
            }
            return trim(next);
        });
        setSelecionado(null);
    };

    const aoEliminarSelecionado = () => {
        if (selecionado?.tipo !== "slot") return;
        setCells((prev) => trim(prev.map((v, i) => (i === selecionado.pos ? null : v))));
        setSelecionado(null);
    };

    const botaoPorId = useMemo(() => Object.fromEntries(botoes.map((b) => [b.id, b])), [botoes]);

    // categorias presentes no Quadro Atual (para o painel de cores), excluindo SOS
    const categoriasNoQuadro = useMemo(() => {
        const set = new Set();
        for (const bId of cells) {
            const b = botaoPorId[bId];
            if (b && b.categoria !== "SOS" && b.nome !== "SOS") set.add(b.categoria || "Sem categoria");
        }
        return [...set].sort();
    }, [cells, botaoPorId]);

    const dev = DISPOSITIVOS[dispositivo];
    const [aspW, aspH] = dev.aspect.split("/").map((n) => parseFloat(n));
    const lastFilled = cells.reduce((m, v, i) => (v != null ? i : m), -1);
    // linhas que enchem a moldura mantendo as células ~quadradas (sem scroll nem espaço em branco)
    const rows = Math.max(Math.round((cols * aspH) / aspW), Math.ceil((lastFilled + 1) / cols), 1);
    const slots = rows * cols;
    // matriz de categorias do quadro, para a fusão visual dos cantos (raioFusao)
    const gridCategorias = useMemo(() => matrizCategorias(cells, cols, rows, botaoPorId), [cells, cols, rows, botaoPorId]);

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
        <DndContext sensors={sensors} onDragStart={({ active }) => { setActiveId(active.id); setSelecionado(null); }} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            <div onClick={() => setSelecionado(null)}
                className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-background text-on-background font-body-md">
                {/* ===== Barra superior (M3) ===== */}
                <div className="h-16 shrink-0 bg-surface-container-lowest border-b border-surface-variant flex items-center justify-between px-4 sm:px-6 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={onVoltar} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors" aria-label="Voltar">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <span className="w-9 h-9 rounded-xl bg-primary text-on-primary hidden sm:flex items-center justify-center">
                            <span className="material-symbols-outlined text-[22px]">grid_view</span>
                        </span>
                        <h1 className="font-display-lg text-xl font-bold text-on-surface truncate">{titulo}</h1>
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
                    <div className="flex-1 bg-surface-container-lowest rounded-[24px] shadow-sm p-5 sm:p-6 flex flex-col min-w-0 min-h-0 relative">
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

                        {/* Borda a simular o dispositivo (dois dedos = zoom) */}
                        <div ref={frameWrapRef} className="flex-1 overflow-auto min-h-0" style={{ touchAction: "pan-x pan-y" }}>
                            <div className="min-h-full w-full flex items-center justify-center">
                                <div className="w-full rounded-[20px] border-2 border-outline-variant bg-surface p-2 sm:p-3 overflow-hidden"
                                    style={{ maxWidth: dev.maxW, aspectRatio: dev.aspect, maxHeight: "100%", transform: `scale(${zoom})`, transformOrigin: "center" }}>
                                    <div className="grid h-full"
                                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
                                        {Array.from({ length: slots }).map((_, pos) => {
                                            const b = botaoPorId[cells[pos]];
                                            const isSOS = b && (b.categoria === "SOS" || b.nome === "SOS");
                                            const cor = b && !isSOS ? resolverCorCategoria(b.categoria, coresCategoria) : null;
                                            const r = Math.floor(pos / cols), c = pos % cols;
                                            return (
                                                <GridCell key={pos} pos={pos} botao={b} apiUrl={apiUrl} size={escala} corFundo={cor} raio={raioFusao(gridCategorias, r, c)}
                                                    selecionado={selecionado?.tipo === "slot" && selecionado.pos === pos}
                                                    onCellClick={aoClicarCelula}
                                                    onRemove={(p) => setCells((prev) => trim(prev.map((v, i) => (i === p ? null : v))))} />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {zoom > 1.02 && (
                            <button onClick={() => aplicarZoom(1)}
                                className="absolute bottom-4 right-4 z-20 flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface shadow-md text-staff-mono">
                                <span className="material-symbols-outlined text-[18px]">zoom_out_map</span> 1:1
                            </button>
                        )}
                    </div>

                    {/* Biblioteca (droppable para remover) */}
                    <LibDrop>
                        {setCoresCategoria && categoriasNoQuadro.length > 0 && (
                            <div className="mb-4 pb-4 border-b border-surface-variant" onClick={(e) => e.stopPropagation()}>
                                <h3 className="font-staff-mono font-bold text-on-surface-variant mb-2 text-sm">Cores por categoria</h3>
                                <div className="flex flex-col gap-1.5">
                                    {categoriasNoQuadro.map((cat) => {
                                        const atual = resolverCorCategoria(cat, coresCategoria);
                                        const temOverride = coresCategoria?.[cat] != null;
                                        return (
                                            <div key={cat} className="flex items-center gap-2">
                                                <input type="color" value={atual || "#ffffff"}
                                                    onChange={(e) => setCoresCategoria((prev) => ({ ...prev, [cat]: e.target.value }))}
                                                    className="w-7 h-7 rounded cursor-pointer border border-surface-variant shrink-0"
                                                    aria-label={`Cor de ${cat}`} />
                                                <span className="text-body-md text-on-surface truncate flex-1">{cat}</span>
                                                {temOverride && (
                                                    <button type="button" onClick={() => setCoresCategoria((prev) => {
                                                        const { [cat]: _omit, ...resto } = prev;
                                                        return resto;
                                                    })} className="text-staff-mono text-primary hover:underline shrink-0">
                                                        repor
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                                        {lista.map((b) => (
                                            <LibraryTile key={b.id} botao={b} apiUrl={apiUrl}
                                                selecionado={selecionado?.tipo === "lib" && selecionado.botaoId === b.id}
                                                onSelect={() => aoSelecionarLib(b.id)} />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {grupos.length === 0 && <p className="text-staff-mono text-on-surface-variant">Sem botões.</p>}
                        </div>
                    </LibDrop>
                </div>
            </div>

            <TrashZone
                visible={!!activeId || selecionado?.tipo === "slot"}
                tap={!activeId && selecionado?.tipo === "slot"}
                onClick={aoEliminarSelecionado} />

            <DragOverlay dropAnimation={null}>
                {activeBotao ? <div style={{ width: 96 }}><ButtonTile botao={activeBotao} apiUrl={apiUrl} size="P" /></div> : null}
            </DragOverlay>
        </DndContext>
    );
};

export default TabelaEditor;
