import { useState, useEffect } from "react";

// Divide `list` em páginas de `pageSize` e avança sozinha a cada `intervalMs`.
// Com 0 ou 1 páginas não roda. Reinicia para a 1ª página se a lista encolher.
// Usado para mostrar a fila/grelha num board sem scroll (TV/Tablet).
export function usePagedRotation(list, pageSize, intervalMs = 8000) {
    const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
    const [page, setPage] = useState(0);

    useEffect(() => { if (page >= pageCount) setPage(0); }, [pageCount, page]);

    useEffect(() => {
        if (pageCount <= 1) return;
        const t = setInterval(() => setPage((p) => (p + 1) % pageCount), intervalMs);
        return () => clearInterval(t);
    }, [pageCount, intervalMs]);

    const start = (page % pageCount) * pageSize;
    return { pageItems: list.slice(start, start + pageSize), page: page % pageCount, pageCount };
}
