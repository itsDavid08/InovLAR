import { get, mutate } from "./client";

export const fetchTabela = (utenteId, dispositivo) =>
    get(`utentes/${utenteId}/tabela/${dispositivo}`);

export async function saveTabela(utenteId, dispositivo, config) {
    const res = await mutate(`utentes/${utenteId}/tabela/${dispositivo}`, {
        method: "PUT",
        body: { config },
        auth: true,
        errorMsg: "Failed to save tabela",
    });
    return res.json();
}
