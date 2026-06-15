// ContextProvider.jsx
// Estado global da app + orquestração. As chamadas HTTP vivem na camada `api/`;
// aqui ficam o estado (useState) e as atualizações otimistas.
import { createContext, useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { apiUrl } from "./api/client";
import * as botoesApi from "./api/botoes";
import * as utentesApi from "./api/utentes";
import * as pedidosApi from "./api/pedidos";

export const Context = createContext(); // Exportación nombrada

export const ContextProvider = ({ children }) => {
    const [utenteId, setUtenteId] = useState(null);
    const [utente, setUtente] = useState(null);
    const [utentes, setUtentes] = useState([]);
    const [botoes, setBotoes] = useState([]);
    const [pedidosUtilizador, setPedidosUtilizador] = useState([]);
    const [pedidosPendentes, setPedidosPendentes] = useState([]);
    // Gate de "kiosk": true quando o staff está no console (após PIN). Vive só em
    // memória → reinicia a false no restart/reload, por isso a app arranca sempre
    // no ecrã de bloqueio. O PIN é sempre validado no servidor (staffLogin).
    const [staffUnlocked, setStaffUnlocked] = useState(false);

    const utenteIdRef = useRef(utenteId);


    const fetchUtentes = async () => {
        try {
            setUtentes(await utentesApi.fetchUtentes());
        } catch (error) {
            console.error("Error fetching utentes:", error);
        }
    };

    const fetchBotoes = async () => {
        try {
            setBotoes(await botoesApi.fetchBotoes());
        } catch (error) {
            console.error("Error fetching botoes:", error);
        }
    };

    const editBotao = async (botao) => {
        try {
            const updatedBotao = await botoesApi.updateBotao(botao);
            setBotoes((prevBotoes) =>
                prevBotoes.map((b) => (b.id === updatedBotao.id ? updatedBotao : b))
            );
        } catch (error) {
            console.error("Error updating botao:", error);
        }
    }

    const postBotao = async (botao) => {
        try {
            const newBotao = await botoesApi.createBotao(botao);
            setBotoes((prevBotoes) => [...prevBotoes, newBotao]);
        } catch (error) {
            console.error("Error creating botao:", error);
        }
    }

    const fetchPedidosUtilizador = async (id) => {
        try {
            setPedidosUtilizador(await pedidosApi.fetchPedidosUtente(id));
        } catch (error) {
            console.error("Error fetching pedidos:", error);
        }
    }

    const fetchUtente = async (id) => {
        try {
            setUtente(await utentesApi.fetchUtente(id));
        } catch (error) {
            console.error("Error fetching utente:", error);
        }
    }

    const postUtente = async (utente) => {
        try {
            await utentesApi.createUtente(utente);
        } catch (error) {
            console.error("Error creating utente:", error);
        }
    }

    const editUtente = async (utente) => {
        try {
            const data = await utentesApi.updateUtente(utente);
            setUtentes((prevUtentes) =>
                prevUtentes.map((u) => (u.id === data.id ? data : u))
            );
        } catch (error) {
            console.error("Error updating utente:", error);
        }
    }
    /**
     * Fetches pending requests for all patiens, thos requests are ordered by urgency.
     *
     * @returns {Promise<void>}
     */
    const fetchPedidosPendentesByEmergencia = async () => {
        try {
            setPedidosPendentes(await pedidosApi.fetchPedidosPendentesEmergencia());
        } catch (error) {
            console.error("Error fetching pending requests:", error);
        }
    }

    const postPedido = async (pedido) => {
        try {
            await pedidosApi.createPedido(pedido);
        } catch (error) {
            console.error("Error creating pedido:", error);
        }
    }

    const updatePedido = async (pedido, novoEstado) => {
        try {
            await pedidosApi.updatePedido(pedido, novoEstado);
        } catch (error) {
            console.error(error);
        }
    };

    const deleteUtente = async (id) => {
        try {
            await utentesApi.deleteUtente(id);
        } catch (error) {
            console.error("Error deleting utente:", error);
        }
    }

    const deleteBotao = async (id) => {
        try {
            await botoesApi.deleteBotao(id);
            setBotoes((prevBotoes) => prevBotoes.filter((b) => b.id !== id));
        } catch (error) {
            console.error("Error deleting botao:", error);
        }
    }




    useEffect(() => {

        fetchUtentes();
        fetchBotoes();
        fetchPedidosPendentesByEmergencia();

    }, []);

    useEffect(() => {
        if (utenteId) {
            utenteIdRef.current = utenteId;
            fetchUtente(utenteId);
            fetchPedidosUtilizador(utenteId);
        }
    }, [utenteId]);

    // Integração com socket.io
    useEffect(() => {
        const socket = io(apiUrl);

        socket.on('bd_alterado', () => {

            fetchUtentes();
            fetchBotoes();
            fetchPedidosPendentesByEmergencia();

            if (utenteIdRef.current) {
                fetchUtente(utenteIdRef.current);
                fetchPedidosUtilizador(utenteIdRef.current);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    return (
        <Context.Provider
            value={{
                utenteId,
                setUtenteId,
                utente,
                setUtente,
                utentes,
                setUtentes,
                botoes,
                setBotoes,
                pedidosUtilizador,
                setPedidosUtilizador,
                pedidosPendentes,
                setPedidosPendentes,
                staffUnlocked,
                setStaffUnlocked,
                deleteUtente,
                postPedido,
                postBotao,
                fetchUtente,
                postUtente,
                editUtente,
                editBotao,
                fetchPedidosUtilizador,
                updatePedido,
                fetchPedidosPendentesByEmergencia,
                deleteBotao,
                apiUrl,
            }}
        >
            {children}
        </Context.Provider>
    );
};
