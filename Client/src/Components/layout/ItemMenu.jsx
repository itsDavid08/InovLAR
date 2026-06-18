import { useState, useRef, useEffect } from "react";

// Menu de ações por item (⋮): Editar/Eliminar. Responsivo:
//  - Desktop (md+): popover subtil ancorado ao ⋮, dentro do cartão.
//  - Mobile (<md): "bottom sheet" que desliza de baixo, com fundo escurecido e
//    cabeçalho (miniatura + nome do item) — alvos de toque grandes, sem ficar
//    espremido nos cartões pequenos. O painel usa `position: fixed`, que escapa
//    ao `overflow-hidden` do cartão (sem precisar de portais).
// Fecha ao clicar fora, no fundo escurecido, em "Cancelar" ou ao escolher uma ação.
//
// Dois modos de estado:
//  - Não-controlado (sem `open`/`onOpenChange`): gere o próprio estado.
//  - Controlado (com `open` + `onOpenChange`): o estado vive no pai (a lista), para
//    que um clique no cartão inteiro também abra/feche este menu. Nesse caso o pai
//    passa ainda `boundaryRef` (o ref do cartão): a fronteira do "clicar fora" passa
//    a ser o cartão, por isso clicar no corpo do cartão alterna o menu sem piscar.
//
// Conteúdo do cabeçalho do sheet (mobile): `title`, `subtitle`, `thumbnail` (opcionais).
const ItemMenu = ({ onEdit, onDelete, open: openProp, onOpenChange, boundaryRef, title, subtitle, thumbnail }) => {
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
                <>
                    {/* Fundo escurecido — só no sheet (mobile). Toque fecha. */}
                    <div
                        className="md:hidden fixed inset-0 z-40 bg-black/40"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                    />
                    {/* Painel: bottom sheet em mobile, popover ancorado em desktop. */}
                    <div className="z-50 fixed inset-x-0 bottom-0 rounded-t-2xl p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] border-t bg-surface-container-lowest border-surface-variant shadow-lg md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-1 md:w-40 md:rounded-lg md:border md:p-1">
                        {/* Cabeçalho — só no sheet (mobile). */}
                        <div className="md:hidden">
                            <div className="mx-auto mt-1 mb-3 h-1 w-9 rounded-full bg-surface-variant" />
                            {(title || thumbnail) && (
                                <div className="flex items-center gap-3 px-3 pb-3 mb-1 border-b border-surface-variant">
                                    {thumbnail && (
                                        <div className="w-10 h-10 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center overflow-hidden shrink-0">
                                            {thumbnail}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        {title && <div className="font-body-md text-on-surface font-semibold truncate">{title}</div>}
                                        {subtitle && <div className="text-xs text-on-surface-variant truncate">{subtitle}</div>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={(e) => escolher(e, onEdit)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 md:py-2 rounded-xl md:rounded-md text-left text-on-surface hover:bg-surface-container transition-colors"
                        >
                            <span className="material-symbols-outlined text-[22px] md:text-sm">edit</span>
                            <span className="font-staff-mono text-base md:text-staff-mono">Editar</span>
                        </button>
                        <button
                            onClick={(e) => escolher(e, onDelete)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 md:py-2 rounded-xl md:rounded-md text-left text-error hover:bg-error-container hover:text-on-error-container transition-colors"
                        >
                            <span className="material-symbols-outlined text-[22px] md:text-sm">delete</span>
                            <span className="font-staff-mono text-base md:text-staff-mono">Eliminar</span>
                        </button>

                        {/* Cancelar — só no sheet (mobile). */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                            className="md:hidden w-full mt-1 py-3 rounded-xl text-center font-staff-mono text-base text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default ItemMenu;
