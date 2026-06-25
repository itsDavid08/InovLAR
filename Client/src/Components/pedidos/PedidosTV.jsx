import { usePagedRotation } from "./usePagedRotation";

// Opção B (PC/TV): coluna de emergências à esquerda + fila por tempo de espera.
// Fluido — preenche 100dvh sem scroll; as páginas rodam sozinhas no overflow.
export default function PedidosTV({ emergencias, normais }) {
    const emg = usePagedRotation(emergencias, 2, 7000);
    const fila = usePagedRotation(normais, 6, 8000);

    return (
        <div style={{ height: "100dvh", background: "#f1f5f9", padding: "clamp(20px,2vw,40px)",
            display: "flex", gap: "clamp(16px,1.6vw,30px)", overflow: "hidden", fontFamily: "system-ui" }}>
            {/* Emergências */}
            <div style={{ flex: "0 0 34%", display: "flex", flexDirection: "column", gap: "clamp(12px,1.2vw,20px)", minHeight: 0 }}>
                <div style={{ font: "900 clamp(20px,1.6vw,30px) system-ui", color: "#dc2626", letterSpacing: 3 }}>⚠ EMERGÊNCIAS</div>
                {emg.pageItems.map((e) => (
                    <div key={e.id} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
                        justifyContent: "center", alignItems: "center", gap: "clamp(8px,1vw,14px)", background: "#fee2e2",
                        border: "5px solid #ef4444", borderRadius: 26, padding: "clamp(16px,2vw,30px)", textAlign: "center", animation: e.emgAnim }}>
                        <div style={{ width: "clamp(90px,8vw,150px)", height: "clamp(90px,8vw,150px)", borderRadius: "50%", background: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(127,29,29,.25)" }}>
                            <img src={e.img} alt="" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                        </div>
                        <div style={{ font: "900 clamp(28px,2.7vw,52px)/1.04 system-ui", color: "#7f1d1d" }}>{e.label}</div>
                        <div style={{ font: "800 clamp(22px,2.1vw,40px) system-ui", color: "#991b1b" }}>{e.quarto} · {e.nome}</div>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 4 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#dc2626", color: "#fff",
                                padding: "8px 18px", borderRadius: 999, font: "800 clamp(14px,1.2vw,22px) system-ui" }}>
                                <span style={{ display: "inline-block", animation: "bell .9s ease-in-out infinite" }}>🔔</span>SOM
                            </span>
                            <span style={{ font: "900 clamp(26px,2.4vw,46px) system-ui", color: "#dc2626" }}>{e.ago}</span>
                        </div>
                    </div>
                ))}
                {emergencias.length === 0 && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8",
                        font: "700 clamp(16px,1.4vw,26px) system-ui", border: "2px dashed #cbd5e1", borderRadius: 26 }}>Sem emergências</div>
                )}
            </div>

            {/* Fila */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "clamp(10px,0.9vw,14px)", minWidth: 0 }}>
                <div style={{ font: "900 clamp(20px,1.6vw,30px) system-ui", color: "#334155", display: "flex",
                    alignItems: "center", justifyContent: "space-between" }}>
                    <span>FILA DE PEDIDOS</span>
                    <span style={{ font: "800 clamp(14px,1.3vw,24px) system-ui", color: "#64748b", background: "#e2e8f0",
                        padding: "6px 18px", borderRadius: 999 }}>
                        {normais.length} a aguardar{fila.pageCount > 1 ? ` · ${fila.page + 1}/${fila.pageCount}` : ""}
                    </span>
                </div>
                {fila.pageItems.map((r) => (
                    <div key={r.id} style={{ flex: 1, minHeight: 0, background: "#fff", border: "2px solid #e8edf4",
                        borderLeft: `12px solid ${r.accent}`, borderRadius: 20, padding: "0 clamp(14px,1.4vw,26px)",
                        display: "flex", alignItems: "center", gap: "clamp(14px,1.4vw,26px)" }}>
                        <div style={{ width: "clamp(60px,5vw,92px)", height: "clamp(60px,5vw,92px)", borderRadius: 20,
                            background: r.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                            <img src={r.img} alt="" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                        </div>
                        <div style={{ width: "clamp(90px,8vw,150px)", flex: "0 0 auto" }}>
                            <div style={{ font: "900 clamp(28px,2.6vw,48px) system-ui", color: "#0f172a" }}>{r.quarto}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ font: "800 clamp(18px,1.8vw,32px) system-ui", color: "#1e293b",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                            <div style={{ font: "600 clamp(15px,1.5vw,27px) system-ui", color: "#64748b",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                        </div>
                        <span style={{ flex: "0 0 auto", display: "inline-block", font: "900 clamp(18px,1.9vw,34px) system-ui",
                            color: r.accent, background: r.accentSoft, padding: "10px 24px", borderRadius: 999 }}>{r.ago}</span>
                    </div>
                ))}
                {normais.length === 0 && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8",
                        font: "700 clamp(16px,1.4vw,26px) system-ui", border: "2px dashed #cbd5e1", borderRadius: 20 }}>Sem pedidos em fila</div>
                )}
            </div>
        </div>
    );
}
