import { useState, useCallback, useMemo } from "react";
import * as botoesApi from "../api/botoes";

// Estado + operações dos botões (catálogo genérico). O botão é buscado sempre
// (endpoint aberto) porque o tabuleiro do utente também precisa dele.
// As mutações propagam o erro (throw) para quem chama poder dar feedback; o
// socket 'bd_alterado' re-sincroniza o estado, por isso não é preciso otimismo.
export function useBotoesState() {
    const [botoes, setBotoes] = useState([]);

    const fetchBotoes = useCallback(async () => {
        setBotoes(await botoesApi.fetchBotoes());
    }, []);

    const postBotao = useCallback(async (botao) => {
        const novo = await botoesApi.createBotao(botao);
        setBotoes((prev) => [...prev, novo]);
        return novo;
    }, []);

    const editBotao = useCallback(async (botao) => {
        const atualizado = await botoesApi.updateBotao(botao);
        setBotoes((prev) => prev.map((b) => (b.id === atualizado.id ? atualizado : b)));
        return atualizado;
    }, []);

    const deleteBotao = useCallback(async (id) => {
        await botoesApi.deleteBotao(id);
        setBotoes((prev) => prev.filter((b) => b.id !== id));
    }, []);

    // Memoizado: sem isto, ContextProvider devolvia um objeto novo em cada render
    // (mesmo quando nenhum destes valores mudou — ex.: um re-render disparado por
    // navegação), o que por si só já dava ao Context.Provider um `value` novo e
    // fazia TODOS os consumidores re-renderizar. Ver item 9 do
    // IMPROVEMENTS_CHECKLIST.md — isto resolve o "re-render sem motivo"; o "um
    // pedido re-renderiza consumidores de botões" continua a acontecer enquanto
    // for um Context só (a prazo: dividir em vários contexts).
    return useMemo(
        () => ({ botoes, setBotoes, fetchBotoes, postBotao, editBotao, deleteBotao }),
        [botoes, setBotoes, fetchBotoes, postBotao, editBotao, deleteBotao]
    );
}
