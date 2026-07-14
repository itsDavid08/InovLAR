import { useState, useEffect, useCallback } from "react";

// Divide `list` em páginas de `pageSize` e avança sozinha a cada `intervalMs`.
// Com 0 ou 1 páginas não roda. Reinicia para a 1ª página se a lista encolher.
// Usado para mostrar a fila/grelha num board sem scroll (TV/Tablet).
// Expõe `next`/`prev`/`goToPage` para navegação manual (teclado, botões).
export function usePagedRotation(list, pageSize, intervalMs = 8000) {
    const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
    const [page, setPage] = useState(0);

    useEffect(() => { if (page >= pageCount) setPage(0); }, [pageCount, page]);

    // `page` está nas dependências para que uma troca manual reinicie a
    // contagem — senão o próximo tick automático podia "engolir" a página
    // que o staff acabou de escolher poucos segundos depois.
    useEffect(() => {
        if (pageCount <= 1) return;
        const t = setInterval(() => setPage((p) => (p + 1) % pageCount), intervalMs);
        return () => clearInterval(t);
    }, [pageCount, intervalMs, page]);

    const goToPage = useCallback((p) => setPage(((p % pageCount) + pageCount) % pageCount), [pageCount]);
    const next = useCallback(() => goToPage(page + 1), [goToPage, page]);
    const prev = useCallback(() => goToPage(page - 1), [goToPage, page]);

    const start = (page % pageCount) * pageSize;
    return { pageItems: list.slice(start, start + pageSize), page: page % pageCount, pageCount, next, prev, goToPage };
}
