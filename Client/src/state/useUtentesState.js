import { useState, useCallback } from "react";
import * as utentesApi from "../api/utentes";
import { fetchBoardUtente } from "../api/board";

// Estado + operações dos utentes: a lista completa (só-staff) e o utente atual
// (o do tabuleiro). As mutações propagam o erro para quem chama; o socket
// 'bd_alterado' re-sincroniza a lista, por isso não é preciso atualizar
// otimisticamente em todo o lado.
export function useUtentesState() {
    const [utentes, setUtentes] = useState([]);
    const [utente, setUtente] = useState(null);

    const fetchUtentes = useCallback(async () => {
        setUtentes(await utentesApi.fetchUtentes());
    }, []);

    // O utente atual é o do tabuleiro — vem da sessão de tabuleiro (/board/utente),
    // não de um id na URL.
    const fetchUtente = useCallback(async () => {
        setUtente(await fetchBoardUtente());
    }, []);

    // Devolve o utente criado (JSON) — o "Criar do zero" usa o id para navegar.
    const postUtente = useCallback(async (utente) => {
        const res = await utentesApi.createUtente(utente);
        return res.json();
    }, []);

    const editUtente = useCallback(async (utente) => {
        const atualizado = await utentesApi.updateUtente(utente);
        setUtentes((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
        return atualizado;
    }, []);

    const deleteUtente = useCallback((id) => utentesApi.deleteUtente(id), []);

    return { utentes, setUtentes, utente, setUtente, fetchUtentes, fetchUtente, postUtente, editUtente, deleteUtente };
}
