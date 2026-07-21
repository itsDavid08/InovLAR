import { useState, useCallback } from "react";
import * as pedidosApi from "../api/pedidos";
import * as boardApi from "../api/board";

// Estado + operações dos pedidos: os pendentes do utente atual (tabuleiro) e os
// agregados para o monitor do staff. As mutações propagam o erro (throw) — o
// tabuleiro precisa de saber se o POST falhou para não mostrar "enviado com
// sucesso" indevidamente. O socket 'bd_alterado' re-sincroniza tudo.
export function usePedidosState() {
    const [pedidosUtilizador, setPedidosUtilizador] = useState([]);
    const [pedidosPendentes, setPedidosPendentes] = useState([]);

    // Pedidos do tabuleiro (utente da sessão) — via /board/*.
    const fetchPedidosUtilizador = useCallback(async () => {
        setPedidosUtilizador(await boardApi.fetchBoardPedidos());
    }, []);

    // Pendentes de todos os utentes, ordenados por urgência (só-staff).
    const fetchPedidosPendentesByEmergencia = useCallback(async () => {
        setPedidosPendentes(await pedidosApi.fetchPedidosPendentesEmergencia());
    }, []);

    // Tabuleiro: cria/atualiza pedidos do próprio utente (sessão de tabuleiro).
    const postPedido = useCallback((pedido) => boardApi.createBoardPedido(pedido), []);
    const updatePedidoBoard = useCallback(
        (pedido, novoEstado) => boardApi.updateBoardPedido(pedido, novoEstado),
        [],
    );

    // Staff (monitor): resolve qualquer pedido pendente (sessão de staff).
    const updatePedido = useCallback(
        (pedido, novoEstado) => pedidosApi.updatePedido(pedido, novoEstado),
        [],
    );

    return {
        pedidosUtilizador,
        setPedidosUtilizador,
        pedidosPendentes,
        setPedidosPendentes,
        fetchPedidosUtilizador,
        fetchPedidosPendentesByEmergencia,
        postPedido,
        updatePedidoBoard,
        updatePedido,
    };
}
