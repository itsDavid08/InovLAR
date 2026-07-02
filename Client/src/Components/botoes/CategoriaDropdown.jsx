import { useState, useRef, useEffect } from "react";
import { COR_CATEGORIA } from "../tabela/constants";

// Dropdown de categoria do formulário de botão.
// - Lista as categorias disponíveis (escolher fecha o menu).
// - "Nova categoria" abre um campo inline para criar uma nova, que é
//   adicionada à lista e logo selecionada.
// Fecha ao clicar fora (mesmo padrão do ItemMenu).
const CategoriaDropdown = ({ value, categorias, onChange, onAddCategoria }) => {
    const [open, setOpen] = useState(false);
    const [aCriar, setACriar] = useState(false);
    const [nova, setNova] = useState("");
    const ref = useRef(null);
    const inputRef = useRef(null);

    const fechar = () => { setOpen(false); setACriar(false); setNova(""); };

    useEffect(() => {
        if (!open) return;
        const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) fechar(); };
        document.addEventListener("mousedown", fora);
        return () => document.removeEventListener("mousedown", fora);
    }, [open]);

    useEffect(() => { if (aCriar) inputRef.current?.focus(); }, [aCriar]);

    const escolher = (cat) => { onChange(cat); fechar(); };

    const confirmarNova = () => {
        const nome = nova.trim();
        if (!nome) return;
        const existente = categorias.find((c) => c.toLowerCase() === nome.toLowerCase());
        if (existente) { escolher(existente); return; } // evita duplicados
        onAddCategoria(nome);
        escolher(nome);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none transition-all text-left"
            >
                <span className={value ? "text-on-surface" : "text-on-surface-variant"}>
                    {value || "Selecione uma categoria"}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant">
                    {open ? "arrow_drop_up" : "arrow_drop_down"}
                </span>
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden rounded-[14px] border border-surface-variant bg-surface-container-lowest shadow-lg origin-top animate-pop-in">
                    <div className="max-h-56 overflow-y-auto">
                        {categorias.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => escolher(cat)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container transition-colors ${cat === value ? "bg-surface-container-high" : ""}`}
                            >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COR_CATEGORIA[cat] || "#7a7582" }} />
                                <span className="font-body-md text-on-surface truncate">{cat}</span>
                                {cat === value && <span className="material-symbols-outlined text-primary text-[18px] ml-auto">check</span>}
                            </button>
                        ))}
                        {categorias.length === 0 && (
                            <p className="px-4 py-2.5 text-sm text-on-surface-variant">Sem categorias.</p>
                        )}
                    </div>

                    <div className="border-t border-surface-variant">
                        {aCriar ? (
                            <div className="flex items-center gap-2 p-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={nova}
                                    onChange={(e) => setNova(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") { e.preventDefault(); confirmarNova(); }
                                        if (e.key === "Escape") { setACriar(false); setNova(""); }
                                    }}
                                    placeholder="Nome da categoria"
                                    className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-surface-container border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary focus:outline-none text-on-surface"
                                />
                                <button type="button" onClick={confirmarNova} className="p-2 rounded-full text-primary hover:bg-surface-container transition-colors" title="Adicionar">
                                    <span className="material-symbols-outlined">check</span>
                                </button>
                                <button type="button" onClick={() => { setACriar(false); setNova(""); }} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors" title="Cancelar">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setACriar(true)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-primary hover:bg-surface-container transition-colors font-semibold"
                            >
                                <span className="material-symbols-outlined text-[20px]">add</span>
                                <span className="font-staff-mono">Nova categoria</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoriaDropdown;
