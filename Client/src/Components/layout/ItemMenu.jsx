import { useState, useRef, useEffect } from "react";

// Menu de ações por item (⋮): Editar/Eliminar. Responsivo:
//  - Desktop (md+): popover subtil ancorado ao ⋮, dentro do cartão.
//  - Mobile (<md): "bottom sheet" que desliza de baixo, com fundo escurecido e
//    cabeçalho (miniatura + nome do item) — alvos de toque grandes, sem ficar
//    espremido nos cartões pequenos. O sheet usa `position: fixed`, que escapa
//    ao `overflow-hidden` do cartão (sem precisar de portais).
// Popover e sheet são elementos SEPARADOS (`hidden md:block` / `md:hidden`) — evita
// o conflito `top-full`+`bottom-0` que colapsava a altura do popover num só elemento.
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

    // Botões de ação (Editar/Eliminar), partilhados pelo popover (desktop) e pelo
    // sheet (mobile). `compact` reduz padding/ícone para o popover.
    const acoes = (compact) => (
        <>
            <button
                onClick={(e) => escolher(e, onEdit)}
                className={`w-full flex items-center gap-3 px-4 text-left text-on-surface hover:bg-surface-container transition-colors ${compact ? "py-2.5" : "py-3"}`}
            >
                <span className={`material-symbols-outlined ${compact ? "text-[18px]" : "text-[22px]"}`}>edit</span>
                <span className={`font-staff-mono ${compact ? "text-staff-mono" : "text-base"}`}>Editar</span>
            </button>
            <button
                onClick={(e) => escolher(e, onDelete)}
                className={`w-full flex items-center gap-3 px-4 text-left text-error hover:bg-error-container hover:text-on-error-container transition-colors ${compact ? "py-2.5" : "py-3"}`}
            >
                <span className={`material-symbols-outlined ${compact ? "text-[18px]" : "text-[22px]"}`}>delete</span>
                <span className={`font-staff-mono ${compact ? "text-staff-mono" : "text-base"}`}>Eliminar</span>
            </button>
        </>
    );

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
                    {/* DESKTOP: popover ancorado ao ⋮. Só `top`/`right` (sem `bottom`
                        nem `fixed`) → a altura vem do conteúdo, não colapsa.
                        `overflow-hidden` recorta o hover aos cantos redondos. */}
                    <div className="hidden md:block absolute right-0 top-full mt-1 z-50 w-44 overflow-hidden rounded-[14px] border border-surface-variant bg-surface-container-lowest shadow-lg origin-top-right animate-pop-in">
                        {acoes(true)}
                    </div>

                    {/* MOBILE: fundo escurecido + bottom sheet (desliza de baixo). */}
                    <div className="md:hidden">
                        <div
                            className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
                            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                        />
                        <div className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-[16px] border-t border-surface-variant bg-surface-container-lowest shadow-lg pb-[env(safe-area-inset-bottom)] animate-sheet-up">
                            <div className="mx-auto mt-2 mb-3 h-1 w-9 rounded-full bg-surface-variant" />
                            {(title || thumbnail) && (
                                <div className="flex items-center gap-3 px-4 pb-3 mb-1 border-b border-surface-variant">
                                    {thumbnail && (
                                        <div className="w-10 h-10 rounded-[10px] bg-secondary-container text-on-secondary-container flex items-center justify-center overflow-hidden shrink-0">
                                            {thumbnail}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        {title && <div className="font-body-md text-on-surface font-semibold truncate">{title}</div>}
                                        {subtitle && <div className="text-xs text-on-surface-variant truncate">{subtitle}</div>}
                                    </div>
                                </div>
                            )}
                            {acoes(false)}
                            <button
                                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                                className="w-full py-3 text-center font-staff-mono text-base text-on-surface-variant hover:bg-surface-container transition-colors border-t border-surface-variant"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ItemMenu;
