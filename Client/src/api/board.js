// Chamadas à API do tabuleiro do utente (/board/*). Todas enviam credenciais — o
// servidor deriva o utente da sessão de tabuleiro (cookie), nunca de um id na URL.
import { apiUrl, get, mutate } from "./client";

// Bootstrap: troca o accessToken (segredo da URL) por uma sessão de tabuleiro
// (cookie httpOnly). Devolve { id } do utente.
export async function bootstrapBoard(accessToken) {
    const res = await fetch(apiUrl + "board/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
    });
    if (!res.ok) throw new Error("Falha ao iniciar a sessão do tabuleiro");
    return res.json();
}

export const fetchBoardUtente = () => get("board/utente", { auth: true });
export const fetchBoardPedidos = () => get("board/pedidos", { auth: true });
export const fetchBoardTabela = (dispositivo) =>
    get(`board/tabela/${dispositivo}`, { auth: true });

// Cria um pedido para o utente da sessão (o servidor força o utenteId).
export function createBoardPedido(pedido) {
    return mutate("board/pedidos", {
        method: "POST",
        body: pedido,
        auth: true,
        errorMsg: "Failed to create pedido",
    });
}

// Atualiza o estado de um pedido do próprio utente (o servidor verifica a posse).
export function updateBoardPedido(pedido, novoEstado) {
    return mutate(`board/pedidos/${pedido.id}`, {
        method: "PUT",
        body: { estado: novoEstado },
        auth: true,
        errorMsg: "Erro ao atualizar pedido",
    });
}
