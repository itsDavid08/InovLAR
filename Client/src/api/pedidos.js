// Chamadas à API dos pedidos usadas pelo STAFF. As leituras/escritas do tabuleiro
// do utente vivem em api/board.js (sessão de tabuleiro, não estas rotas).
import { apiUrl, get, mutate } from "./client";

export async function fetchPedidosPendentesEmergencia() {
    // Agregado de todos os pedidos pendentes -> só staff (envia o cookie de sessão).
    const res = await fetch(apiUrl + "pedidos/ativos/emergencia", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch pending requests");
    return res.json();
}

// Registo de pedidos (página de histórico do staff). Ao contrário das leituras
// acima, é o SERVIDOR que filtra/ordena/pagina — daí os filtros irem na query
// string. Chaves aceites: utenteId, botaoId, categoria, estado, emergencia, q,
// de, ate, ordenar, direcao, limite, offset (ver validation/schemas.js).
// Devolve { total, limite, offset, resumo, pedidos }.
export function fetchHistoricoPedidos(filtros = {}) {
    const qs = new URLSearchParams();
    for (const [chave, valor] of Object.entries(filtros)) {
        // "" e null = filtro não aplicado; enviá-los só encheria a URL de ruído.
        if (valor !== "" && valor !== null && valor !== undefined) qs.set(chave, valor);
    }
    const query = qs.toString();
    return get(`pedidos/historico${query ? `?${query}` : ""}`, { auth: true });
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
