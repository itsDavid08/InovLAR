// Mapeia um `pedido` do servidor para as props visuais usadas pelos 3 layouts.
// Ícones são imagens reais (botao.imagem), não emojis. Cores seguem o tempo de
// espera; a emergência tem sempre prioridade. Aproveita a ordem do servidor
// (emergencia DESC, hora ASC) — não reordena.
import { apiUrl } from "../../api/client";

export function decorate(pedido, now) {
    const m = Math.max(0, Math.round((now - new Date(pedido.hora).getTime()) / 60000));
    const ago = m < 1 ? "agora" : `há ${m} min`;

    let accent, accentSoft;
    if (pedido.emergencia) { accent = "#dc2626"; accentSoft = "#fee2e2"; }
    else if (m < 5)        { accent = "#15803d"; accentSoft = "#dcfce7"; }
    else if (m < 11)       { accent = "#b45309"; accentSoft = "#fef3c7"; }
    else                   { accent = "#b91c1c"; accentSoft = "#fee2e2"; }

    return {
        id: pedido.id,
        emergencia: !!pedido.emergencia,
        img: apiUrl + (pedido.botao?.imagem || "/imagesBotoes/default.png"),
        label: pedido.botao?.mensagem || "",
        nome: pedido.utente?.nome || "",
        quarto: pedido.utente?.quarto || "",
        m, ago, accent, accentSoft,
        iconBg: pedido.emergencia ? "#fff" : accentSoft,
        cardBg: pedido.emergencia ? "#fee2e2" : "#fff",
        cardBorder: pedido.emergencia ? "#ef4444" : "#e8edf4",
        titleColor: pedido.emergencia ? "#7f1d1d" : "#1e293b",
        emgAnim: pedido.emergencia
            ? "emgFlash 1.1s ease-in-out infinite, emgBorder 1.1s ease-in-out infinite"
            : "none",
    };
}

// Decora tudo e separa, mantendo a ordem que o servidor já devolve.
export function split(pedidos, now) {
    const all = pedidos.map((p) => decorate(p, now));
    return { all, emergencias: all.filter((r) => r.emergencia), normais: all.filter((r) => !r.emergencia) };
}
