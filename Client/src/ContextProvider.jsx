// ContextProvider.jsx
// Estado global da app. O estado e as operações de cada domínio vivem em hooks
// próprios (`state/`); aqui fica só a composição e a orquestração transversal
// (socket, gating das leituras só-staff, refetch ao mudar de utente).
import { createContext, useState, useEffect, useRef, useMemo } from "react";
import { io } from "socket.io-client";
import { apiUrl } from "./api/client";
import { useBotoesState } from "./state/useBotoesState";
import { useUtentesState } from "./state/useUtentesState";
import { usePedidosState } from "./state/usePedidosState";
import { useStaffAuthState } from "./state/useStaffAuthState";

export const Context = createContext();

export const ContextProvider = ({ children }) => {
    const botoesState = useBotoesState();
    const utentesState = useUtentesState();
    const pedidosState = usePedidosState();
    const authState = useStaffAuthState();

    const { fetchBotoes } = botoesState;
    const { fetchUtentes, fetchUtente } = utentesState;
    const { fetchPedidosUtilizador, fetchPedidosPendentesByEmergencia } = pedidosState;
    const { staffUnlocked, staffUnlockedRef } = authState;

    // utenteId: qual o utente "ativo" (o do tabuleiro). Muda → refetch dos seus dados.
    const [utenteId, setUtenteId] = useState(null);
    const utenteIdRef = useRef(utenteId);

    // `botoes` é o catálogo genérico — o tabuleiro precisa dele, por isso é
    // buscado sempre (endpoint aberto).
    useEffect(() => {
        fetchBotoes();
    }, [fetchBotoes]);

    // Leituras só-staff (roster + agregados) — só quando o staff tem acesso; no
    // tabuleiro do utente (sem sessão) não são chamadas, evitando 401s.
    useEffect(() => {
        if (staffUnlocked) {
            fetchUtentes();
            fetchPedidosPendentesByEmergencia();
        }
    }, [staffUnlocked, fetchUtentes, fetchPedidosPendentesByEmergencia]);

    useEffect(() => {
        utenteIdRef.current = utenteId;
        if (utenteId) {
            // Dados do tabuleiro vêm da sessão (/board/*), não de um id na URL.
            fetchUtente();
            fetchPedidosUtilizador();
        }
    }, [utenteId, fetchUtente, fetchPedidosUtilizador]);

    // Socket.io: um evento 'bd_alterado' significa "algo mudou, refresca". Os
    // agregados só-staff só refrescam se o staff tiver acesso (senão dão 401 e
    // não são precisos no tabuleiro). Refs para dodgear stale-closures.
    useEffect(() => {
        const socket = io(apiUrl);
        socket.on("bd_alterado", () => {
            fetchBotoes();
            if (staffUnlockedRef.current) {
                fetchUtentes();
                fetchPedidosPendentesByEmergencia();
            }
            if (utenteIdRef.current) {
                fetchUtente();
                fetchPedidosUtilizador();
            }
        });
        return () => socket.disconnect();
    }, [fetchBotoes, fetchUtentes, fetchPedidosPendentesByEmergencia, fetchUtente, fetchPedidosUtilizador, staffUnlockedRef]);

    // Memoizado (item 9 do IMPROVEMENTS_CHECKLIST.md): os 4 hooks de estado já
    // devolvem objetos estáveis (useMemo próprio — só mudam quando o que
    // realmente contêm muda), por isso este `value` só ganha uma referência nova
    // quando algum deles (ou utenteId) muda de facto — não em todo e qualquer
    // re-render do provider (ex.: um causado por navegação, sem nenhum destes
    // dados ter mudado). Continua a ser um Context só: uma mudança em qualquer
    // domínio (botões, utentes, pedidos, auth) ainda re-renderiza todos os
    // consumidores — dividir em vários contexts fica para depois (a prazo).
    const value = useMemo(
        () => ({
            ...botoesState,
            ...utentesState,
            ...pedidosState,
            ...authState,
            utenteId,
            setUtenteId,
            apiUrl,
        }),
        [botoesState, utentesState, pedidosState, authState, utenteId]
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
};
