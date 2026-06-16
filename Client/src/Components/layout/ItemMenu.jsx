import { useState, useRef, useEffect } from "react";

// Menu de ações por item (⋮): popover subtil com Editar/Eliminar.
// Fecha ao clicar fora ou ao escolher uma ação. Abre dentro do card (cabe).
const ItemMenu = ({ onEdit, onDelete }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const fora = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", fora);
        return () => document.removeEventListener("mousedown", fora);
    }, [open]);

    const escolher = (e, fn) => {
        e.stopPropagation();
        setOpen(false);
        fn();
    };

    return (
        <div className="relative" ref={ref}>
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
