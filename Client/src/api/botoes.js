// Chamadas à API dos botões. Devolvem dados; o estado vive no ContextProvider.
import { get, mutate } from "./client";

export const fetchBotoes = () => get("botoes");

// Lista de imagens disponíveis (usada no editor de botões).
export const fetchImagensBotoes = () => get("/imagesBotoes");

export async function updateBotao(botao) {
    const res = await mutate(`botoes/${botao.id}`, {
        method: "PUT",
        body: botao,
        auth: true,
        errorMsg: "Failed to update botao",
    });
    return res.json();
}

export async function createBotao(botao) {
    const res = await mutate("botoes", {
        method: "POST",
        body: botao,
        auth: true,
        errorMsg: "Failed to create botao",
    });
    return res.json();
}

export function deleteBotao(id) {
    return mutate(`botoes/${id}`, {
        method: "DELETE",
        auth: true,
        errorMsg: "Failed to delete botao",
    });
}
