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
    const { pedidosPendentes } = useContext(Context);
    const [now, setNow] = useState(Date.now());
    const navigate = useNavigate();
    const mode = useViewportMode();
    const bellRef = useRef(null);
    const warningRef = useRef(null);

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
    // quando a lista muda (chega pedido novo). Dispara só quando a lista muda.
    useEffect(() => {
        if (!bellRef.current) bellRef.current = new window.Audio("/Hand-bell-rings-sound-effect.mp3");
        if (!warningRef.current) {
            warningRef.current = new window.Audio("/Warning-alarm-tone.mp3");
            warningRef.current.loop = true;
        }
        const existeEmergencia = pedidosPendentes.some((p) => p.emergencia);
        if (existeEmergencia) {
            warningRef.current.play().catch(() => {});
        } else {
            warningRef.current.pause();
            warningRef.current.currentTime = 0;
            if (pedidosPendentes.length > 0) {
                bellRef.current.currentTime = 0;
                bellRef.current.play().catch(() => {});
            }
        }
        return () => {
            warningRef.current?.pause();
            if (warningRef.current) warningRef.current.currentTime = 0;
        };
    }, [pedidosPendentes]);

    const { all, emergencias, normais } = split(pedidosPendentes, now);

    // TV/PC (≥1280px) usa o board (Opção B). Tablet e telemóvel partilham a
    // mesma lista de cartões.
    if (mode === "tv") return <PedidosTV emergencias={emergencias} normais={normais} />;
    return (<><PedidosPhone all={all} /><StaffBottomNav /></>);
}

export default PedidosPendentes;
