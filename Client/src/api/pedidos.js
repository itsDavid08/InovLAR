// Chamadas à API dos pedidos. Devolvem dados; o estado vive no ContextProvider.
// Nota: criar/atualizar pedidos NÃO envia credenciais — são as rotas abertas que
// o tablet do utente usa (ver DEVELOPMENT_LOG.md). Só o staff mutila com cookie.
import { apiUrl, get, mutate } from "./client";

export const fetchPedidosUtente = (id) => get(`pedidos/utente/${id}`);

export async function fetchPedidosPendentesEmergencia() {
    // Agregado de todos os pedidos pendentes -> só staff (envia o cookie de sessão).
    const res = await fetch(apiUrl + "pedidos/ativos/emergencia", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch pending requests");
    return res.json();
}

export function createPedido(pedido) {
    return mutate("pedidos", {
        method: "POST",
        body: pedido,
        errorMsg: "Failed to create pedido",
    });
}

export function updatePedido(pedido, novoEstado) {
    return mutate(`pedidos/${pedido.id}`, {
        method: "PUT",
        body: { ...pedido, estado: novoEstado },
        errorMsg: "Erro ao atualizar pedido",
    });
}
