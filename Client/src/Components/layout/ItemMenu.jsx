import { useState, useRef, useEffect } from "react";

// Menu de ações por item (⋮): popover subtil com Editar/Eliminar.
// Fecha ao clicar fora ou ao escolher uma ação. Abre dentro do card (cabe).
//
// Dois modos:
//  - Não-controlado (sem `open`/`onOpenChange`): gere o próprio estado, como antes.
//  - Controlado (com `open` + `onOpenChange`): o estado vive no pai (a lista), para
//    que um clique no cartão inteiro também abra/feche este menu. Nesse caso o pai
//    passa ainda `boundaryRef` (o ref do cartão): a fronteira do "clicar fora" passa
//    a ser o cartão, por isso clicar no corpo do cartão alterna o menu sem o piscar
//    "fecha-no-mousedown + reabre-no-click" — só cliques verdadeiramente fora fecham.
const ItemMenu = ({ onEdit, onDelete, open: openProp, onOpenChange, boundaryRef }) => {
    const [openLocal, setOpenLocal] = useState(false);
    const controlado = openProp !== undefined;
    const open = controlado ? openProp : openLocal;
    const proprioRef = useRef(null);
    const limite = boundaryRef ?? proprioRef; // fronteira do "clicar fora"

    const setOpen = (valor) => {
        const proximo = typeof valor === "function" ? valor(open) : valor;
        if (controlado) onOpenChange?.(proximo);
        else setOpenLocal(proximo);
    };

    useEffect(() => {
        if (!open) return;
        const fora = (e) => {
            if (limite.current && !limite.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", fora);
        return () => document.removeEventListener("mousedown", fora);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const escolher = (e, fn) => {
        e.stopPropagation();
        setOpen(false);
        fn();
    };

    return (
        <div className="relative" ref={proprioRef}>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                aria-label="Ações"
            >
                <span className="material-symbols-outlined">more_vert</span>
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-surface-container-lowest rounded-lg shadow-lg border border-surface-variant py-1">
                    <button
                        onClick={(e) => escolher(e, onEdit)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left text-on-surface hover:bg-surface-container transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span className="font-staff-mono text-staff-mono">Editar</span>
                    </button>
                    <button
                        onClick={(e) => escolher(e, onDelete)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left text-error hover:bg-error-container hover:text-on-error-container transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span className="font-staff-mono text-staff-mono">Eliminar</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ItemMenu;
