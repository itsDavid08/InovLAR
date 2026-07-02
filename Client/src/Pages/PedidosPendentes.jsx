import { useState, useEffect, useContext, useRef } from "react";
import { Context } from "../ContextProvider";
import { useNavigate } from "react-router-dom";
import StaffBottomNav from "../Components/layout/StaffBottomNav";
import { split } from "../Components/pedidos/decorate";
import { useViewportMode } from "../Components/pedidos/useViewportMode";
import PedidosTV from "../Components/pedidos/PedidosTV";
import PedidosPhone from "../Components/pedidos/PedidosPhone";
import "../index.css";

// Container: mantém o estado/áudio/teclado e escolhe o layout por tamanho de ecrã
// (TV = Opção B, Tablet = Opção A, Telemóvel = lista). Os layouts são "burros".
function PedidosPendentes() {
    const { pedidosPendentes, updatePedido } = useContext(Context);
    const [now, setNow] = useState(Date.now());
    const navigate = useNavigate();
    const mode = useViewportMode();
    const bellRef = useRef(null);
    const warningRef = useRef(null);
    const prevIdsRef = useRef(new Set());

    // Atualiza o "há X min" a cada 10s (não depende de novos dados do servidor).
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(t);
    }, []);

    // Esc → volta ao painel de staff (comportamento anterior preservado).
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") navigate("/staff"); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [navigate]);

    // Alarme: 'warning' em loop enquanto houver emergência; senão o sino toca
    // APENAS quando entra um pedido NOVO (id que ainda não estava na lista).
    // Cancelar/retirar pedidos já não dispara o sino (comparação por ids, não
    // por comprimento — deteta o pedido novo mesmo se outro sair ao mesmo tempo).
    useEffect(() => {
        if (!bellRef.current) bellRef.current = new window.Audio("/Hand-bell-rings-sound-effect.mp3");
        if (!warningRef.current) {
            warningRef.current = new window.Audio("/Warning-alarm-tone.mp3");
            warningRef.current.loop = true;
        }
        const existeEmergencia = pedidosPendentes.some((p) => p.emergencia);
        const idsAtuais = pedidosPendentes.map((p) => p.id);
        const houvePedidoNovo = idsAtuais.some((id) => !prevIdsRef.current.has(id));

        if (existeEmergencia) {
            warningRef.current.play().catch(() => {});
        } else {
            warningRef.current.pause();
            warningRef.current.currentTime = 0;
            if (houvePedidoNovo) {
                bellRef.current.currentTime = 0;
                bellRef.current.play().catch(() => {});
            }
        }
        // Guarda os ids atuais para a próxima comparação.
        prevIdsRef.current = new Set(idsAtuais);

        return () => {
            warningRef.current?.pause();
            if (warningRef.current) warningRef.current.currentTime = 0;
        };
    }, [pedidosPendentes]);

    // Resolve (conclui) um pedido a partir do board. Procura o pedido ORIGINAL
    // (a versão decorada não tem todos os campos) e marca-o como concluído →
    // sai da lista (o servidor filtra estado: 'pendente'). Mesmo padrão da gaveta.
    const handleResolver = (id) => {
        const pedido = pedidosPendentes.find((p) => p.id === id);
        if (!pedido) return;
        updatePedido(pedido, "concluido");
    };

    const { all, emergencias, normais } = split(pedidosPendentes, now);

    // TV/PC (≥1280px) usa o board (Opção B). Tablet e telemóvel partilham a
    // mesma lista de cartões.
    if (mode === "tv") return <PedidosTV emergencias={emergencias} normais={normais} onResolver={handleResolver} />;
    return (<><PedidosPhone all={all} onResolver={handleResolver} /><StaffBottomNav /></>);
}

export default PedidosPendentes;
