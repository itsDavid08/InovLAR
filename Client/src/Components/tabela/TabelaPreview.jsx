import { DISPOSITIVOS } from "./constants";

// Pré-visualização read-only de uma tabela (mesma lógica de linhas do editor).
const TabelaPreview = ({ config, dispositivo, botaoPorId, apiUrl }) => {
    const dev = DISPOSITIVOS[dispositivo];
    const cells = Array.isArray(config?.cells) ? config.cells : [];
    const cols = config?.cols || dev.colsDefault;
    const [aspW, aspH] = dev.aspect.split("/").map((n) => parseFloat(n));
    const lastFilled = cells.reduce((m, v, i) => (v != null ? i : m), -1);
    const rows = Math.max(Math.round((cols * aspH) / aspW), Math.ceil((lastFilled + 1) / cols), 1);
    const slots = rows * cols;

    if (lastFilled < 0) {
        return (
            <div className="w-full rounded-xl border border-dashed border-outline-variant bg-surface-container-low flex items-center justify-center text-on-surface-variant"
                style={{ aspectRatio: dev.aspect }}>
                <span className="font-staff-mono text-staff-mono">Sem botões</span>
            </div>
        );
    }
    return (
        <div className="w-full rounded-xl border border-outline-variant bg-surface overflow-hidden" style={{ aspectRatio: dev.aspect }}>
            <div className="grid h-full p-[3%]"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                {Array.from({ length: slots }).map((_, i) => {
                    const b = botaoPorId[cells[i]];
                    return (
                        <div key={i} className="p-[6%]">
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
