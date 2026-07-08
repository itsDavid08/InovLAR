import { useEffect, useRef, useState } from "react";
import { usePagedRotation } from "./usePagedRotation";

// Altura mínima de um cartão (px) para o texto (nome/quarto/pedido) não
// cortar; abaixo disto passa a rodar mais páginas em vez de espremer.
const MIN_ROW_HEIGHT = 100;
const GRID_GAP = 14; // aprox. do gap real (clamp 10-14px), só para o cálculo

// Tablet e TV/PC: grelha de 2 colunas (aproveita a largura do ecrã). O
// servidor já ordena emergência primeiro (depois por hora) e o grid preenche
// por linha, por isso o(s) cartão(ões) de emergência aparecem sempre primeiro
// — só que destacados (vermelho, flash) em vez de reservarem uma coluna
// dedicada, já que raramente há mais que um em simultâneo.
//
// O número de pedidos por página é variável: mede-se a altura disponível e
// calcula-se quantas linhas cabem sem descer de MIN_ROW_HEIGHT; o resto roda
// por páginas (usePagedRotation), tal como a versão anterior de 1 coluna.
export default function PedidosTV({ all, onResolver }) {
    const gridRef = useRef(null);
    const [rowsAvailable, setRowsAvailable] = useState(7);

    useEffect(() => {
        const el = gridRef.current;
        if (!el) return;
        const medir = () => {
            const rows = Math.max(1, Math.floor((el.clientHeight + GRID_GAP) / (MIN_ROW_HEIGHT + GRID_GAP)));
            setRowsAvailable(rows);
        };
        medir();
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const fila = usePagedRotation(all, rowsAvailable * 2, 8000);
    const numEmergencias = all.filter((r) => r.emergencia).length;
    const rows = Math.max(1, Math.ceil(fila.pageItems.length / 2));

    return (
        <div style={{ height: "100dvh", background: "#f1f5f9", padding: "clamp(20px,2vw,40px)",
            display: "flex", flexDirection: "column", gap: "clamp(12px,1.2vw,20px)", overflow: "hidden", fontFamily: "system-ui" }}>
            <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "clamp(10px,1vw,18px)" }}>
                    <span style={{ font: "900 clamp(20px,1.6vw,30px) system-ui", color: "#334155" }}>PEDIDOS PENDENTES</span>
                    {numEmergencias > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#dc2626", color: "#fff",
                            padding: "6px 16px", borderRadius: 999, font: "800 clamp(14px,1.2vw,22px) system-ui",
                            animation: "emgFlash 1.1s ease-in-out infinite" }}>
                            <span style={{ display: "inline-block", animation: "bell .9s ease-in-out infinite" }}>🔔</span>
                            {numEmergencias} EMERGÊNCIA{numEmergencias > 1 ? "S" : ""}
                        </span>
                    )}
                </div>
                <span style={{ font: "800 clamp(14px,1.3vw,24px) system-ui", color: "#64748b", background: "#e2e8f0",
                    padding: "6px 18px", borderRadius: 999 }}>
                    {all.length} a aguardar{fila.pageCount > 1 ? ` · ${fila.page + 1}/${fila.pageCount}` : ""}
                </span>
            </div>

            <div ref={gridRef} style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: `repeat(${rows}, minmax(${MIN_ROW_HEIGHT}px, 1fr))`,
                gap: "clamp(10px,0.9vw,14px)", minHeight: 0, overflow: "hidden" }}>
                {fila.pageItems.map((r) => (
                    <div key={r.id} style={{ minHeight: 0, minWidth: 0, background: r.cardBg, border: `2px solid ${r.cardBorder}`,
                        borderLeft: `12px solid ${r.accent}`, borderRadius: 20, padding: "clamp(6px,0.8vw,10px) clamp(12px,1.2vw,22px)",
                        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(10px,1.2vw,20px)", animation: r.emgAnim }}>
                        <div style={{ height: "70%", maxHeight: 130, aspectRatio: "1", borderRadius: 20,
                            background: r.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                            <img src={r.img} alt="" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                        </div>
                        <div style={{ flex: "1 1 100px", minWidth: 0 }}>
                            <div title={r.nome} style={{ font: "900 clamp(18px,2.2vw,44px) system-ui", color: r.titleColor,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                            <div style={{ font: "700 clamp(12px,1.1vw,22px) system-ui", color: "#64748b" }}>🚪 {r.quarto}</div>
                            <div style={{ font: "600 clamp(13px,1.4vw,27px) system-ui", color: "#1e293b",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                        </div>
                        <span style={{ flex: "0 0 auto", display: "inline-block", font: "900 clamp(14px,1.7vw,34px) system-ui",
                            color: r.accent, background: r.accentSoft, padding: "8px clamp(10px,1.6vw,24px)", borderRadius: 999 }}>{r.ago}</span>
                        <button onClick={() => onResolver(r.id)} title="Concluir pedido"
                            style={{ flex: "0 0 auto", cursor: "pointer", border: "none", borderRadius: 999,
                                background: "#15803d", color: "#fff", font: "900 clamp(16px,1.6vw,28px) system-ui",
                                padding: "8px clamp(12px,1.4vw,22px)" }}>✔</button>
                    </div>
                ))}
                {all.length === 0 && (
                    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8",
                        font: "700 clamp(16px,1.4vw,26px) system-ui", border: "2px dashed #cbd5e1", borderRadius: 20 }}>Sem pedidos pendentes</div>
                )}
            </div>
        </div>
    );
}
