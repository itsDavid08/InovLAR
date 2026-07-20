import { useMemo } from "react";
import { COR_CATEGORIA } from "./constants";
import LibraryTile from "./LibraryTile";
import { t } from "../../i18n";

// Biblioteca de botões: pesquisa + lista agrupada por categoria. Cada botão é
// um LibraryTile arrastável/clicável (ver aoSelecionarLib/onDragStart no editor).
const BibliotecaBotoes = ({ botoes, apiUrl, busca, setBusca, selecionado, onSelect }) => {
    const grupos = useMemo(() => {
        const f = busca.trim().toLowerCase();
        const m = {};
        for (const b of botoes) {
            if (f && !b.nome.toLowerCase().includes(f)) continue;
            const c = b.categoria || "Sem categoria";
            (m[c] = m[c] || []).push(b);
        }
        return Object.entries(m);
    }, [botoes, busca]);

    return (
        <>
            <h2 className="font-display-lg text-lg font-bold text-on-surface mb-3">
                {t.tabelaEditor.buttonLibrary}
            </h2>
            <div className="relative mb-4">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    search
                </span>
                <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder={t.tabelaEditor.searchButtonPlaceholder}
                    className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface-container-lowest border-none focus:ring-2 focus:ring-primary text-body-md text-on-surface"
                />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mr-2 pr-2">
                {grupos.map(([cat, lista]) => (
                    <div key={cat} className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ background: COR_CATEGORIA[cat] || "#7a7582" }}
                            />
                            <span className="font-display-lg text-staff-mono font-bold text-on-surface">
                                {cat}
                            </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {lista.map((b) => (
                                <LibraryTile
                                    key={b.id}
                                    botao={b}
                                    apiUrl={apiUrl}
                                    selecionado={selecionado?.tipo === "lib" && selecionado.botaoId === b.id}
                                    onSelect={() => onSelect(b.id)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                {grupos.length === 0 && (
                    <p className="text-staff-mono text-on-surface-variant">
                        {t.tabelaEditor.libraryEmpty}
                    </p>
                )}
            </div>
        </>
    );
};

export default BibliotecaBotoes;
