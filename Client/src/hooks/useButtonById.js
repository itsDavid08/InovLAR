import { useMemo } from "react";

// Memoized id → botão lookup map, recomputed only when the catalog changes.
export function useButtonById(botoes) {
    return useMemo(
        () => Object.fromEntries(botoes.map((b) => [b.id, b])),
        [botoes],
    );
}
