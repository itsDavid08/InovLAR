import { useState, useEffect } from "react";

// Dispositivo (chave de DISPOSITIVOS) pelo tamanho do ecrã — decide qual dos
// layouts guardados o tabuleiro do utente mostra. Breakpoints próprios (mapeiam
// para configs de tabela), distintos do useViewportMode dos Pedidos Pendentes.
const detetar = () => {
    const w = window.innerWidth;
    return w < 600 ? "smartphone" : w < 1024 ? "tablet" : "pc";
};

export function useTipoDispositivo() {
    const [dispositivo, setDispositivo] = useState(detetar);
    useEffect(() => {
        const onResize = () => setDispositivo(detetar());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    return dispositivo;
}
