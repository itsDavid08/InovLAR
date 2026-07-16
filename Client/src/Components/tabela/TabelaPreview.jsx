import { DISPOSITIVOS } from "./constants";
import { getSpan } from "./gridSpans";
import { useGridGeometry } from "./useGridGeometry";
import { t } from "../../i18n";

// Pré-visualização read-only de uma tabela (mesma geometria do editor, via useGridGeometry).
const TabelaPreview = ({ config, dispositivo, botaoPorId, apiUrl }) => {
    const dev = DISPOSITIVOS[dispositivo];
    const cells = Array.isArray(config?.cells) ? config.cells : [];
    const spans = config?.spans || {};
    const cols = config?.cols || dev.colsDefault;
    const temBotoes = cells.some((v) => v != null);
    const { rows, slots, ocupacao } = useGridGeometry({ cells, spans, cols, dispositivo });

    // Slot do cartão: tamanho fixo, igual para os 3 dispositivos — não é o `dev.aspect`
    // que dita o tamanho do cartão (um smartphone em retrato faria o cartão da grelha
    // "saltar" de altura ao trocar de separador). A moldura do dispositivo é desenhada
    // por dentro, centrada e a caber (como `object-fit: contain`), nunca maior que o slot.
    const slot = (conteudo) => (
        <div className="w-full aspect-[4/3] rounded-md bg-surface-container-low flex items-center justify-center overflow-hidden">
            <div className="h-full rounded-md border border-outline-variant bg-surface overflow-hidden"
                style={{ aspectRatio: dev.aspect, maxWidth: "100%", maxHeight: "100%" }}>
                {conteudo}
            </div>
        </div>
    );

    if (!temBotoes) {
        return slot(
            <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                <span className="font-staff-mono text-staff-mono">{t.tabelaEditor.noButtons}</span>
            </div>
        );
    }
    return slot(
        <div className="grid h-full w-full p-[3%]"
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
    );
};

export default TabelaPreview;
