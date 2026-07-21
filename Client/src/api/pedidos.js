// Chamadas à API dos pedidos usadas pelo STAFF. As leituras/escritas do tabuleiro
// do utente vivem em api/board.js (sessão de tabuleiro, não estas rotas).
import { apiUrl, mutate } from "./client";

export async function fetchPedidosPendentesEmergencia() {
    // Agregado de todos os pedidos pendentes -> só staff (envia o cookie de sessão).
    const res = await fetch(apiUrl + "pedidos/ativos/emergencia", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch pending requests");
    return res.json();
}

// Monitor de staff: resolve qualquer pedido pendente (sessão de staff).
export function updatePedido(pedido, novoEstado) {
    return mutate(`pedidos/${pedido.id}`, {
        method: "PUT",
        body: { ...pedido, estado: novoEstado },
        auth: true,
        errorMsg: "Erro ao atualizar pedido",
    });
}
