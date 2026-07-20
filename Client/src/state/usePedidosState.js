import { useState, useCallback } from "react";
import * as pedidosApi from "../api/pedidos";

// Estado + operações dos pedidos: os pendentes do utente atual (tabuleiro) e os
// agregados para o monitor do staff. As mutações propagam o erro (throw) — o
// tabuleiro precisa de saber se o POST falhou para não mostrar "enviado com
// sucesso" indevidamente. O socket 'bd_alterado' re-sincroniza tudo.
export function usePedidosState() {
    const [pedidosUtilizador, setPedidosUtilizador] = useState([]);
    const [pedidosPendentes, setPedidosPendentes] = useState([]);

    const fetchPedidosUtilizador = useCallback(async (id) => {
        setPedidosUtilizador(await pedidosApi.fetchPedidosUtente(id));
    }, []);

    // Pendentes de todos os utentes, ordenados por urgência (só-staff).
    const fetchPedidosPendentesByEmergencia = useCallback(async () => {
        setPedidosPendentes(await pedidosApi.fetchPedidosPendentesEmergencia());
    }, []);

    const postPedido = useCallback((pedido) => pedidosApi.createPedido(pedido), []);

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
        updatePedido,
    };
}
