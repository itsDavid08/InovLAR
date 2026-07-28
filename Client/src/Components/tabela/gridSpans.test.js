import { describe, it, expect } from "vitest";
import {
    trim,
    getSpan,
    footprint,
    buildOcupacao,
    extentRows,
    colocarComEmpurrao,
} from "./gridSpans";

// Geometria da grelha do editor de tabelas — lógica pura, sem DOM. É o núcleo mais
// frágil do projeto (ver CLAUDE.md: "pixel-geometry with no test coverage"), por isso
// é o primeiro alvo do safety net.

describe("trim", () => {
    it("remove nulls finais mas mantém os interiores", () => {
        expect(trim([1, null, 2, null, null])).toEqual([1, null, 2]);
    });
    it("array só de nulls → vazio", () => {
        expect(trim([null, null])).toEqual([]);
    });
    it("sem nulls finais → inalterado", () => {
        expect(trim([1, 2, 3])).toEqual([1, 2, 3]);
    });
});

describe("getSpan", () => {
    it("sem entrada → 1×1", () => {
        expect(getSpan({}, 0)).toEqual({ w: 1, h: 1 });
        expect(getSpan(undefined, 5)).toEqual({ w: 1, h: 1 });
    });
    it("com entrada → o span guardado", () => {
        expect(getSpan({ 2: { w: 2, h: 3 } }, 2)).toEqual({ w: 2, h: 3 });
    });
});

describe("footprint", () => {
    it("1×1 → só a própria célula", () => {
        expect(footprint(0, 1, 1, 5)).toEqual([0]);
    });
    it("2×2 row-major a partir da âncora", () => {
        expect(footprint(0, 2, 2, 5)).toEqual([0, 1, 5, 6]);
    });
    it("âncora deslocada (pos 6, cols 5) → r1c1", () => {
        expect(footprint(6, 2, 2, 5)).toEqual([6, 7, 11, 12]);
    });
    it("null quando não cabe na largura da grelha", () => {
        expect(footprint(4, 2, 1, 5)).toBeNull(); // c=4, 4+2 > 5
    });
});

describe("buildOcupacao", () => {
    it("mapeia cada célula coberta (âncora + span) para a sua âncora", () => {
        const ocup = buildOcupacao([10, null, 20], { 0: { w: 2, h: 1 } }, 5);
        expect([...ocup]).toEqual([
            [0, 0],
            [1, 0],
            [2, 2],
        ]);
    });
});

describe("extentRows", () => {
    it("conta a altura do span, não só a linha da âncora", () => {
        expect(extentRows([10], { 0: { w: 1, h: 2 } }, 5)).toBe(2);
    });
    it("botão numa linha mais abaixo estende as linhas", () => {
        const cells = Array(15).fill(null);
        cells[12] = 30; // linha 2 (cols 5)
        expect(extentRows(cells, {}, 5)).toBe(3);
    });
    it("grelha vazia → 0 linhas", () => {
        expect(extentRows([null, null], {}, 5)).toBe(0);
    });
});

describe("colocarComEmpurrao", () => {
    it("coloca num tabuleiro vazio", () => {
        expect(colocarComEmpurrao([], {}, 5, 0, 10, { w: 1, h: 1 })).toEqual({
            cells: [10],
            spans: {},
        });
    });

    it("devolve null se o botão não couber na largura da grelha", () => {
        expect(colocarComEmpurrao([], {}, 5, 4, 10, { w: 2, h: 1 })).toBeNull();
    });

    it("guarda um span só quando é maior que 1×1", () => {
        const r = colocarComEmpurrao([], {}, 5, 0, 10, { w: 2, h: 1 });
        expect(r.cells[0]).toBe(10);
        expect(r.spans).toEqual({ 0: { w: 2, h: 1 } });
    });

    it("colisão relocaliza o ocupante para a 1ª célula livre (fora do alvo)", () => {
        // 10 em @2; coloca 20 em @2 → 10 empurrado para @0 (1ª livre, ≠ alvo)
        const grid = Array(10).fill(null);
        grid[2] = 10;
        grid[3] = 30;
        const r = colocarComEmpurrao(grid, {}, 5, 2, 20, { w: 1, h: 1 });
        expect(r.cells[2]).toBe(20); // novo botão no alvo
        expect(r.cells[0]).toBe(10); // ocupante relocalizado
        expect(r.cells[3]).toBe(30); // vizinho intacto
    });

    it("mover um botão para cima de outro (sem trocarComOrigem) empurra-o para a 1ª célula livre", () => {
        // selfAnchor=0: move 10 de @0 para @1 (onde está 20) → sem a opção de troca, 20 vai
        // para a 1ª célula livre da grelha (que aqui coincide com @0, a origem, por acaso —
        // ver o teste seguinte para o caso em que NÃO coincide)
        const grid = Array(10).fill(null);
        grid[0] = 10;
        grid[1] = 20;
        const r = colocarComEmpurrao(grid, {}, 5, 1, 10, { w: 1, h: 1 }, 0);
        expect(r.cells[0]).toBe(20);
        expect(r.cells[1]).toBe(10);
    });

    it("trocarComOrigem: move um botão para cima de outro e troca-os, mesmo quando a origem não é a 1ª célula livre", () => {
        // 20@2, 10@5, @0 livre; move 10 de @5 para @2 (onde está 20) → com trocarComOrigem,
        // 20 tem de ir para @5 (a origem de 10), não para @0 (que ficaria livre e "ganharia"
        // no varrimento normal por vir antes de @5)
        const grid = Array(10).fill(null);
        grid[2] = 20;
        grid[5] = 10;
        const r = colocarComEmpurrao(grid, {}, 5, 2, 10, { w: 1, h: 1 }, 5, { trocarComOrigem: true });
        expect(r.cells[2]).toBe(10);
        expect(r.cells[5]).toBe(20);
        expect(r.cells[0]).toBeNull();
    });

    it("trocarComOrigem: mais que um colidido cai para o empurrão normal", () => {
        // move um botão 2×1 (de @5) para @0, colidindo com dois botões 1×1 (@0 e @1) —
        // não há uma única "origem" para trocar, por isso ambos são empurrados normalmente
        const grid = Array(10).fill(null);
        grid[0] = 20;
        grid[1] = 30;
        grid[5] = 10;
        const r = colocarComEmpurrao(grid, {}, 5, 0, 10, { w: 2, h: 1 }, 5, { trocarComOrigem: true });
        expect(r.cells).toContain(20);
        expect(r.cells).toContain(30);
        expect(r.cells[0]).toBe(10);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // BUG antigo (documentado 2026-07-23, corrigido 2026-07-28 — ver DEVELOPMENT_LOG.md).
    // `colocarComEmpurrao` não reservava a pegada do ALVO em `ocup` antes de realocar os
    // botões colididos, por isso um colidido podia ser colocado dentro da pegada do alvo e
    // depois sobrescrito pelo `pousar(targetPos)` final → o botão desaparecia (ou ficava
    // sobreposto). Alcançável pelo gesto de RESIZE por cima de um vizinho (useGridResize.js)
    // e, como reportado pelo utilizador, também ao arrastar um botão colocado por cima de
    // outro. Fixo: a pegada do alvo agora fica reservada durante o empurrão (`reservado` em
    // `colocarComEmpurrao`). Estes dois testes já não precisam de `it.fails`.
    // ─────────────────────────────────────────────────────────────────────────
    it("resize por cima do vizinho empurra-o, não o perde", () => {
        // 10@0, 20@1; redimensiona 10 para 2×1 (cobre 0,1) → 20 vai para @2
        const grid = Array(10).fill(null);
        grid[0] = 10;
        grid[1] = 20;
        const r = colocarComEmpurrao(grid, {}, 5, 0, 10, { w: 2, h: 1 }, 0);
        expect(r.cells).toContain(20);
    });

    it("colocar sobre uma célula @0 ocupada relocaliza o ocupante", () => {
        // 10@0; coloca 20@0 (1×1) → 10 é realocado, não perdido
        const grid = Array(10).fill(null);
        grid[0] = 10;
        const r = colocarComEmpurrao(grid, {}, 5, 0, 20, { w: 1, h: 1 });
        expect(r.cells).toContain(10);
    });
});
