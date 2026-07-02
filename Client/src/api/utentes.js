// Chamadas à API dos utentes. Devolvem dados; o estado vive no ContextProvider.
import { apiUrl, get, mutate } from "./client";

export const fetchUtentes = () => get("utentes");

export async function fetchUtente(id) {
    const res = await fetch(apiUrl + `utentes/${id}`);
    if (!res.ok) throw new Error("Utente not found");
    return res.json();
}

export function createUtente(utente) {
    return mutate("utentes/create", {
        method: "POST",
        body: utente,
        auth: true,
        errorMsg: "Failed to create utente",
    });
}

export async function updateUtente(utente) {
    const res = await mutate(`utentes/${utente.id}`, {
        method: "PUT",
        body: utente,
        auth: true,
        errorMsg: "Failed to update utente",
    });
    return res.json();
}

export function deleteUtente(id) {
    return mutate(`utentes/${id}`, {
        method: "DELETE",
        auth: true,
        errorMsg: "Failed to delete utente",
    });
}
