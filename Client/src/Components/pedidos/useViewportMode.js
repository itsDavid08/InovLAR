import { useState, useEffect } from "react";

// Classe de viewport dos Pedidos Pendentes por largura de ecrã:
//   'phone'  < 640px
//   'tablet' 640–1279px
//   'tv'     >= 1280px
// Nota: hoje o container trata 'phone' e 'tablet' do mesmo modo (lista de
// cartões); só 'tv' usa o board (Opção B). O hook mantém os 3 valores caso se
// queira voltar a diferenciar o tablet.
export function useViewportMode() {
    const get = () => {
        const w = window.innerWidth;
        if (w < 640) return "phone";
        if (w < 1280) return "tablet";
        return "tv";
    };
    const [mode, setMode] = useState(get);
    useEffect(() => {
        const onResize = () => setMode(get());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);
    return mode;
}
