import { DISPOSITIVOS } from "./constants";
import { getSpan, buildOcupacao, extentRows } from "./gridSpans";

// Pré-visualização read-only de uma tabela (mesma lógica de linhas e spans do editor).
const TabelaPreview = ({ config, dispositivo, botaoPorId, apiUrl }) => {
    const dev = DISPOSITIVOS[dispositivo];
    const cells = Array.isArray(config?.cells) ? config.cells : [];
    const spans = config?.spans || {};
    const cols = config?.cols || dev.colsDefault;
    const [aspW, aspH] = dev.aspect.split("/").map((n) => parseFloat(n));
    const temBotoes = cells.some((v) => v != null);
    const rows = Math.max(Math.round((cols * aspH) / aspW), extentRows(cells, spans, cols), 1);
    const slots = rows * cols;
    const ocupacao = buildOcupacao(cells, spans, cols);

    if (!temBotoes) {
        return (
            <div className="w-full rounded-md border border-dashed border-outline-variant bg-surface-container-low flex items-center justify-center text-on-surface-variant"
                style={{ aspectRatio: dev.aspect }}>
                <span className="font-staff-mono text-staff-mono">Sem botões</span>
            </div>
        );
    }
    return (
        <div className="w-full rounded-md border border-outline-variant bg-surface overflow-hidden" style={{ aspectRatio: dev.aspect }}>
            <div className="grid h-full p-[3%]"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                {Array.from({ length: slots }).map((_, pos) => {
                    const anchor = ocupacao.get(pos);
                    if (anchor !== undefined && anchor !== pos) return null; // coberta por um botão maior
                    const b = anchor === pos ? botaoPorId[cells[pos]] : null;
                    const { w, h } = anchor === pos ? getSpan(spans, pos) : { w: 1, h: 1 };
                    const r = Math.floor(pos / cols), c = pos % cols;
                    return (
                        <div key={pos} className="p-[6%]" style={{ gridColumn: `${c + 1} / span ${w}`, gridRow: `${r + 1} / span ${h}` }}>
                            {b ? (
                                <div className="w-full h-full rounded-md bg-surface-container-lowest border border-surface-variant flex items-center justify-center overflow-hidden">
                                    <img src={apiUrl + (b.imagem || "/imagesBotoes/default.png")} alt="" className="w-full h-full object-contain p-[10%]" draggable={false} />
                                </div>
                            ) : (
                                <div className="w-full h-full rounded-md border border-dashed border-outline-variant/50" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TabelaPreview;
