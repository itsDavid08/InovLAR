import { describe, it, expect } from "vitest";
import {
    isSOS,
    resolverCorCategoria,
    escalaPorColunas,
    hasCells,
    devicesWithLayout,
    defaultConfig,
    matrizCategorias,
    raioFusao,
} from "./constants";

describe("isSOS", () => {
    it("true por categoria ou por nome", () => {
        expect(isSOS({ categoria: "SOS" })).toBe(true);
        expect(isSOS({ nome: "SOS" })).toBe(true);
    });
    it("false para botão normal ou nulo", () => {
        expect(isSOS({ categoria: "Necessidades" })).toBe(false);
        expect(isSOS(null)).toBe(false);
    });
});

describe("resolverCorCategoria", () => {
    it("override do staff > pastel default > null", () => {
        expect(resolverCorCategoria("Chamar", { Chamar: "#111111" })).toBe("#111111");
        expect(resolverCorCategoria("Necessidades", {})).toBe("#E6DCC8"); // pastel default
        expect(resolverCorCategoria("Desconhecida", {})).toBeNull();
    });
});

describe("escalaPorColunas", () => {
    it("menos colunas → tiles maiores", () => {
        expect(escalaPorColunas(3)).toBe("G"); // <= 4
        expect(escalaPorColunas(5)).toBe("M"); // <= 6
        expect(escalaPorColunas(7)).toBe("P");
    });
});

describe("hasCells", () => {
    it("true só se houver pelo menos um botão colocado", () => {
        expect(hasCells({ cells: [null, null] })).toBe(false);
        expect(hasCells({ cells: [null, 3] })).toBe(true);
        expect(hasCells(null)).toBe(false);
    });
});

describe("devicesWithLayout", () => {
    it("só os dispositivos com layout preenchido", () => {
        const configs = {
            smartphone: { cells: [1] },
            tablet: { cells: [null] },
            pc: { cells: [] },
        };
        expect(devicesWithLayout(configs)).toEqual(["smartphone"]);
    });
});

describe("defaultConfig", () => {
    it("config vazia com o nº de colunas por omissão do dispositivo", () => {
        expect(defaultConfig("tablet")).toEqual({
            cols: 5,
            size: "M",
            cells: [],
            spans: {},
            coresCategoria: {},
        });
    });
});

describe("matrizCategorias", () => {
    const byId = {
        1: { categoria: "Necessidades" },
        2: { categoria: "Necessidades" },
        9: { categoria: "SOS", nome: "SOS" },
    };
    it("mapeia cada célula para a categoria do seu botão", () => {
        expect(matrizCategorias([1, 2], {}, 2, 1, byId)).toEqual([
            ["Necessidades", "Necessidades"],
        ]);
    });
    it("SOS nunca entra na matriz (fica sempre ilha isolada)", () => {
        expect(matrizCategorias([1, 9], {}, 2, 1, byId)).toEqual([
            ["Necessidades", null],
        ]);
    });
});

describe("raioFusao", () => {
    const grid = [["Necessidades", "Necessidades"]]; // dois vizinhos da mesma categoria

    it("quadra o canto partilhado com o vizinho da mesma categoria", () => {
        // célula esquerda: o lado direito toca o vizinho → cantos direitos a 0
        expect(raioFusao(grid, 0, 0)).toEqual({
            borderTopLeftRadius: "1rem",
            borderTopRightRadius: 0,
            borderBottomLeftRadius: "1rem",
            borderBottomRightRadius: 0,
        });
    });

    it("célula sem categoria → 4 cantos arredondados", () => {
        expect(raioFusao([[null]], 0, 0)).toEqual({ borderRadius: "1rem" });
    });
});
