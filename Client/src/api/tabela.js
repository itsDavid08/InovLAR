import { get, mutate } from "./client";

// Editor de staff (GerirTabela). O tabuleiro do utente usa api/board.fetchBoardTabela.
export const fetchTabela = (utenteId, dispositivo) =>
    get(`utentes/${utenteId}/tabela/${dispositivo}`, { auth: true });

export const fetchTabelas = () => get("tabelas", { auth: true }); // todos os layouts -> só staff

export async function saveTabela(utenteId, dispositivo, config) {
    const res = await mutate(`utentes/${utenteId}/tabela/${dispositivo}`, {
        method: "PUT",
        body: { config },
        auth: true,
        errorMsg: "Failed to save tabela",
    });
    return res.json();
}
