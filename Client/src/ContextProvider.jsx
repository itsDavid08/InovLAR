// ContextProvider.jsx
// Estado global da app. O estado e as operações de cada domínio vivem em hooks
// próprios (`state/`); aqui fica só a composição e a orquestração transversal
// (socket, gating das leituras só-staff, refetch ao mudar de utente).
import { createContext, useState, useEffect, useRef } from "react";
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
            fetchUtente(utenteId);
            fetchPedidosUtilizador(utenteId);
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
                fetchUtente(utenteIdRef.current);
                fetchPedidosUtilizador(utenteIdRef.current);
            }
        });
        return () => socket.disconnect();
    }, [fetchBotoes, fetchUtentes, fetchPedidosPendentesByEmergencia, fetchUtente, fetchPedidosUtilizador, staffUnlockedRef]);

    return (
        <Context.Provider
            value={{
                ...botoesState,
                ...utentesState,
                ...pedidosState,
                ...authState,
                utenteId,
                setUtenteId,
                apiUrl,
            }}
        >
            {children}
        </Context.Provider>
    );
};
