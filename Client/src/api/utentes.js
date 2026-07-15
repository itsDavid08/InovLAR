// Chamadas à API dos utentes. Devolvem dados; o estado vive no ContextProvider.
import { apiUrl, get, mutate } from "./client";

export const fetchUtentes = () => get("utentes", { auth: true }); // roster -> só staff

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

// Upload de foto pessoal. previousPath: foto anterior a substituir (o servidor
// apaga-a só se for um upload pessoal, nunca um avatar predefinido).
export async function uploadImagemUtente(file, previousPath = '') {
    const formData = new FormData();
    formData.append('imagem', file);
    if (previousPath) formData.append('previousPath', previousPath);
    const res = await fetch(`${apiUrl}imagesUtentes/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });
    if (!res.ok) throw new Error('Erro ao fazer upload da imagem');
    return res.json();
}

export async function deleteImagemUtente(imgPath) {
    const res = await fetch(apiUrl + 'imagesUtentes', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: imgPath }),
    });
    if (!res.ok) throw new Error('Erro ao eliminar a imagem');
    return res.json();
}
