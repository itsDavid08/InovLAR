import { t } from "../../i18n";

// Telemóvel: lista de cartões (scroll). Emergências destacadas (flash) no topo.
// paddingBottom deixa espaço para a StaffBottomNav fixa.
export default function PedidosPhone({ all, onResolver }) {
    return (
        <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", fontFamily: "system-ui" }}>
            <div style={{ padding: "12px 18px 14px", borderBottom: "1px solid #eef1f6", flex: "0 0 auto" }}>
                <div style={{ font: "800 22px system-ui", color: "#0f172a" }}>{t.pedidos.title}</div>
                <div style={{ font: "600 14px system-ui", color: "#64748b" }}>{t.pedidos.countLine(all.length)}</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px", paddingBottom: 88, display: "flex", flexDirection: "column", gap: 12 }}>
                {all.map((r) => (
                    <div key={r.id} style={{ background: r.cardBg, border: `2px solid ${r.cardBorder}`, borderLeft: `8px solid ${r.accent}`,
                        borderRadius: 16, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto", animation: r.emgAnim }}>
                        <div style={{ width: 54, height: 54, borderRadius: 14, background: r.iconBg, display: "flex",
                            alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                            <img src={r.img} alt="" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div title={r.nome} style={{ font: "800 18px/1.15 system-ui", color: r.titleColor,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                            <div style={{ font: "600 14px system-ui", color: "#64748b" }}>🚪 {r.quarto}</div>
                            <div style={{ font: "600 14px system-ui", color: "#1e293b",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                            <div style={{ font: "800 13px system-ui", color: r.accent, marginTop: 2 }}>{r.ago}</div>
                        </div>
                        <button onClick={() => onResolver(r.id)} title={t.pedidos.resolve}
                            style={{ flex: "0 0 auto", cursor: "pointer", border: "none", borderRadius: 12,
                                background: "#15803d", color: "#fff", font: "900 18px system-ui",
                                width: 46, height: 46 }}>✔</button>
                    </div>
                ))}
                {all.length === 0 && (
                    <div style={{ textAlign: "center", color: "#94a3b8", font: "600 16px system-ui", padding: "40px 0" }}>{t.pedidos.empty}</div>
                )}
            </div>
        </div>
    );
}
