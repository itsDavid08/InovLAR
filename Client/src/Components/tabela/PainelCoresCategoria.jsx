import { resolverCorCategoria } from "./constants";
import { t } from "../../i18n";

// Painel colapsável "Cores por categoria" — só aparece quando o quadro atual
// tem categorias (SOS nunca entra, ver isSOS/matrizCategorias em constants.js).
const PainelCoresCategoria = ({
    categoriasNoQuadro,
    coresCategoria,
    setCoresCategoria,
    aberto,
    setAberto,
}) => {
    if (categoriasNoQuadro.length === 0) return null;
    return (
        <div
            className="mb-4 pb-4 border-b border-surface-variant"
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-left"
            >
                <h3 className="font-staff-mono font-bold text-on-surface-variant text-sm">
                    {t.tabelaEditor.colorsByCategory}
                </h3>
                <span
                    className={`material-symbols-outlined text-on-surface-variant text-[20px] transition-transform ${aberto ? "rotate-180" : ""}`}
                >
                    expand_more
                </span>
            </button>
            {aberto && (
                <div className="flex flex-col gap-1.5 mt-2">
                    {categoriasNoQuadro.map((cat) => {
                        const atual = resolverCorCategoria(cat, coresCategoria);
                        const temOverride = coresCategoria?.[cat] != null;
                        return (
                            <div key={cat} className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={atual || "#ffffff"}
                                    onChange={(e) =>
                                        setCoresCategoria((prev) => ({
                                            ...prev,
                                            [cat]: e.target.value,
                                        }))
                                    }
                                    className="w-7 h-7 rounded cursor-pointer border border-surface-variant shrink-0"
                                    aria-label={t.tabelaEditor.colorOf(cat)}
                                />
                                <span className="text-body-md text-on-surface truncate flex-1">
                                    {cat}
                                </span>
                                {temOverride && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setCoresCategoria((prev) => {
                                                const { [cat]: _omit, ...resto } = prev;
                                                return resto;
                                            })
                                        }
                                        className="text-staff-mono text-primary hover:underline shrink-0"
                                    >
                                        {t.tabelaEditor.resetColor}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default PainelCoresCategoria;
