import { isSOS, resolverCorCategoria, raioFusao } from "./constants";
import { getSpan } from "./gridSpans";
import { useGridGeometry } from "./useGridGeometry";

// Grelha read-only do tabuleiro do utente (o que o utente toca). Mesma geometria
// do editor (via useGridGeometry) para reproduzir o desenho fielmente; cada botão
// dispara onButtonClick, exceto o SOS que dispara onSOS.
const GrelhaTabuleiro = ({ config, dispositivo, botaoPorId, apiUrl, onButtonClick, onSOS }) => {
    const cols = config.cols || 4;
    const cells = config.cells || [];
    const spans = config.spans || {};
    const coresCategoria = config.coresCategoria || {};
    // exige gap 0 na grelha, senão os fundos não "encostam" e a fusão de cantos não resulta.
    const { rows, slots, ocupacao, gridCategorias } = useGridGeometry({
        cells,
        spans,
        cols,
        dispositivo,
        botaoPorId,
    });

    return (
        <div
            className="flex-grow-1"
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: 0,
                minHeight: 0,
            }}
        >
            {Array.from({ length: slots }).map((_, pos) => {
                const anchor = ocupacao.get(pos);
                if (anchor !== undefined && anchor !== pos) return null; // coberta por um botão maior
                const b = anchor === pos ? botaoPorId[cells[pos]] : null;
                const r = Math.floor(pos / cols),
                    c = pos % cols;
                const { w, h } = anchor === pos ? getSpan(spans, pos) : { w: 1, h: 1 };
                const posStyle = {
                    gridColumn: `${c + 1} / span ${w}`,
                    gridRow: `${r + 1} / span ${h}`,
                };
                if (!b)
                    return (
                        <div
                            key={pos}
                            style={posStyle}
                            className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low"
                        />
                    );
                const sos = isSOS(b);
                const cor = !sos ? resolverCorCategoria(b.categoria, coresCategoria) : null;
                return (
                    <div
                        key={pos}
                        className="transition-all"
                        style={{
                            ...posStyle,
                            minHeight: 0,
                            padding: "4%",
                            background: cor || "transparent",
                            ...raioFusao(gridCategorias, r, c, w, h),
                        }}
                    >
                        <button
                            onClick={() => (sos ? onSOS() : onButtonClick(b))}
                            aria-label={b.nome}
                            className={`btn d-flex flex-column align-items-center justify-content-center rounded overflow-hidden w-100 h-100 ${sos ? "btn-danger" : "btn-light border border-secondary"}`}
                            style={{ minHeight: 0, padding: "2%" }}
                        >
                            <img
                                src={apiUrl + (b.imagem || "/imagesBotoes/default.png")}
                                alt={b.nome}
                                style={{
                                    flex: "1 1 0",
                                    minHeight: 0,
                                    maxWidth: "100%",
                                    objectFit: "contain",
                                }}
                            />
                            <span
                                className="fw-bold text-center text-truncate w-100"
                                style={{ fontSize: "min(2.5vw, 16px)" }}
                            >
                                {b.nome}
                            </span>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default GrelhaTabuleiro;
