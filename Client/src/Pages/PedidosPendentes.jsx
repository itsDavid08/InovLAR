import { useState, useEffect, useContext, useRef } from "react";
import { Context } from "../ContextProvider";
import { useNavigate } from "react-router-dom";
import StaffBottomNav from "../Components/layout/StaffBottomNav";
import "../index.css";

function PedidosPendentes() {
    const { pedidosPendentes, apiUrl} = useContext(Context);
    const [pedidosEsquerda, setPedidosEsquerda] = useState([]);
    const [pedidosDireita, setPedidosDireita] = useState([]);
    const [paginaAtual, setPaginaAtual] = useState(1);
    const itensPorPagina = 5;
    const navigate = useNavigate();
    const bellRef = useRef(null);
    const warningRef = useRef(null);

    const indexUltimoItem = paginaAtual * itensPorPagina;
    const indexPrimeiroItem = indexUltimoItem - itensPorPagina;
    const pedidosPagina = pedidosDireita.slice(indexPrimeiroItem, indexUltimoItem);
    const totalPaginas = Math.ceil(pedidosDireita.length / itensPorPagina);

    useEffect(() => {
        const esquerda = pedidosPendentes.slice(0, 2);
        const direita = pedidosPendentes.slice(2);

        setPedidosEsquerda(esquerda);
        setPedidosDireita(direita);

        // console.log(pedidosPendentes);
    }, [pedidosPendentes]);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === "Escape") {
                navigate("/staff");
            }
        };

        const handleArrows = (event) => {
            if (event.key === "ArrowLeft" && paginaAtual > 1) {
                setPaginaAtual(paginaAtual - 1);
            } else if (event.key === "ArrowRight") {
                if (paginaAtual < totalPaginas) {
                    setPaginaAtual(paginaAtual + 1);
                }
            }
        };

        window.addEventListener("keydown", handleEsc);
        window.addEventListener("keydown", handleArrows);

        return () => {
            window.removeEventListener("keydown", handleEsc);
            window.removeEventListener("keydown", handleArrows);
        };
    }, [navigate, paginaAtual, totalPaginas]);

    useEffect(() => {
        if (!bellRef.current) {
            bellRef.current = new window.Audio("/Hand-bell-rings-sound-effect.mp3");
        }
        if (!warningRef.current) {
            warningRef.current = new window.Audio("/Warning-alarm-tone.mp3");
            warningRef.current.loop = true;
        }

        const existeEmergencia = pedidosPendentes.some(p => p.emergencia);

        if (!existeEmergencia) {
            warningRef.current.pause();
            warningRef.current.currentTime = 0;
        }

        if (existeEmergencia) {
            warningRef.current.play().catch(() => {});
        } else if (pedidosPendentes.length > 0) {
            bellRef.current.currentTime = 0;
            bellRef.current.play().catch(() => {});
        }

        return () => {
            warningRef.current?.pause();
            warningRef.current.currentTime = 0;
        };
    });

    const mudarPagina = (novaPagina) => {
        setPaginaAtual(novaPagina);
    };

    return (
        <div className="pedidos-container">
            <div className="pedidos-columnas">
                <div className="coluna-emergencia">
                    <h1 className="pedidos-titulo">Lista de Pedidos Pendentes</h1>
                    {pedidosEsquerda.map((pedido, index) => (
                        <div key={index} className={`Item-Pedido Item-Grande ${pedido.emergencia ? "Pedido-Emergencia" : ""}`}>
                            <div style={{ display: 'flex', alignItems: 'center',gap: "10px", width: '100%', justifyContent: 'space-between', height: '100%' }}>
                                <div className="pedido-icono iconoGrande">
                                    <img src={apiUrl + (pedido.botao?.imagem || '/imagesBotoes/default.png')} alt="" style={{ width: '70%' }} />
                                </div>
                                <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between' }}>
                                    <h2 style={{ margin: 0, fontSize: 'clamp(32px, 4vw, 40px)', wordBreak: "break-word", textAlign: "center" }}>{pedido.botao?.mensagem || ""}</h2>
                                    <p style={{fontSize: "clamp(18px, 3vw, 24px)"}}>
                                        {pedido.utente?.nome} - <strong>{pedido.utente?.quarto}</strong> - {" "}
                                        {new Date(pedido.hora).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                        {" - "}
                                        {new Date(pedido.hora).toLocaleDateString([], {day: '2-digit', month: '2-digit', year: 'numeric'})}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="coluna-normal">
                    {paginaAtual > 1 && ( <button style={{border : "none", borderRadius: "20%"}} onClick={() => mudarPagina(paginaAtual - 1)} >◀</button>)}

                    <div style={{flexDirection: "column", width: "100%", marginLeft: "10px", marginRight: "10px"}}>
                    {pedidosPagina.map((pedido, index) => (
                        <div key={index} className={`Item-Pedido Item-Pequeno ${pedido.emergencia ? "Pedido-Emergencia" : ""}`}>
                            <div style={{ display: 'flex', alignItems: 'center',gap: "10px", width: '100%', justifyContent: 'space-between', height: '100%' }}>
                                <div className="pedido-icono iconoPequeno">
                                    <img src={apiUrl + (pedido.botao?.imagem || '/imagesBotoes/default.png')} alt="" style={{ width: '70%' }} />
                                </div>
                                <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'space-between' }}>
                                    <h2 style={{ margin: 0, fontSize: 'clamp(16px, 2vw, 28px)', wordBreak: "break-word", textAlign: "center" }}>{pedido.botao?.mensagem || ""}</h2>
                                    <p style={{fontSize: "clamp(14px, 2vw, 22px)"}}>
                                        {pedido.utente?.nome}- <strong>{pedido.utente?.quarto}</strong> - {" "}
                                        {new Date(pedido.hora).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                        {" - "}
                                        {new Date(pedido.hora).toLocaleDateString([], {day: '2-digit', month: '2-digit', year: 'numeric'})}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>

                    {totalPaginas > 1 && paginaAtual != totalPaginas && (
                            <button style={{border : "none"}} onClick={() => mudarPagina(paginaAtual + 1)} >▶</button>
                    )}
                </div>
            </div>

            {/* Espaçador só-mobile: garante que o conteúdo não fica tapado pela
                barra inferior fixa (independente do CSS de .pedidos-container). */}
            <div className="h-20 md:hidden" />

            {/* Mesma navegação inferior das restantes páginas de staff (mobile). */}
            <StaffBottomNav />
        </div>
    );
}

export default PedidosPendentes;