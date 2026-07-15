import { get, mutate } from "./client";

export const fetchTabelasPadrao = () => get("tabelas-padrao", { auth: true }); // templates -> só staff

export async function criarTabelaPadrao(dados) {
    const res = await mutate("tabelas-padrao", { method: "POST", body: dados, auth: true, errorMsg: "Failed to create template" });
    return res.json();
}
export async function saveTabelaPadrao(id, dados) {
    const res = await mutate(`tabelas-padrao/${id}`, { method: "PUT", body: dados, auth: true, errorMsg: "Failed to save template" });
    return res.json();
}
export async function deleteTabelaPadrao(id) {
    await mutate(`tabelas-padrao/${id}`, { method: "DELETE", auth: true, errorMsg: "Failed to delete template" });
}
export async function aplicarTabelaPadrao(id, utenteId) {
    const res = await mutate(`tabelas-padrao/${id}/aplicar`, { method: "POST", body: { utenteId }, auth: true, errorMsg: "Failed to apply template" });
    return res.json();
}
