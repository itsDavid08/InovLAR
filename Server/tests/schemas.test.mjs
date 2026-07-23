import { describe, it, expect } from "vitest";
import {
    boardSessionSchema,
    createPedidoSchema,
    updatePedidoSchema,
    createUtenteSchema,
    saveTabelaSchema,
} from "../validation/schemas.js";

// Contrato de validação (zod) — a primeira linha de defesa das rotas, antes do
// controller/ORM. Puro, sem infra.

describe("boardSessionSchema", () => {
    const hex64 = "a".repeat(64);
    it("aceita 64 chars hex", () => {
        expect(boardSessionSchema.safeParse({ accessToken: hex64 }).success).toBe(true);
    });
    it("rejeita comprimento errado", () => {
        expect(boardSessionSchema.safeParse({ accessToken: "abc" }).success).toBe(false);
    });
    it("rejeita não-hexadecimal", () => {
        expect(boardSessionSchema.safeParse({ accessToken: "z".repeat(64) }).success).toBe(false);
    });
});

describe("createPedidoSchema", () => {
    it("aceita botaoId positivo", () => {
        expect(createPedidoSchema.safeParse({ botaoId: 5 }).success).toBe(true);
    });
    it("rejeita botaoId em falta ou não-positivo", () => {
        expect(createPedidoSchema.safeParse({}).success).toBe(false);
        expect(createPedidoSchema.safeParse({ botaoId: 0 }).success).toBe(false);
    });
    it("descarta campos não declarados (não faz passthrough)", () => {
        const r = createPedidoSchema.safeParse({ botaoId: 5, utenteId: 999, hack: "x" });
        expect(r.success).toBe(true);
        expect(r.data).toEqual({ botaoId: 5 }); // utenteId/hack removidos
    });
});

describe("updatePedidoSchema", () => {
    it("aceita um estado do ENUM", () => {
        expect(updatePedidoSchema.safeParse({ estado: "pendente" }).success).toBe(true);
        expect(updatePedidoSchema.safeParse({ estado: "concluido" }).success).toBe(true);
    });
    it("rejeita estado fora do ENUM", () => {
        expect(updatePedidoSchema.safeParse({ estado: "xyz" }).success).toBe(false);
    });
});

describe("createUtenteSchema", () => {
    it("exige nome e quarto", () => {
        expect(createUtenteSchema.safeParse({ nome: "Ana", quarto: "A1" }).success).toBe(true);
        expect(createUtenteSchema.safeParse({ nome: "Ana" }).success).toBe(false);
    });
    it("corAvatar: aceita '' e hex válido, rejeita hex inválido", () => {
        const base = { nome: "Ana", quarto: "A1" };
        expect(createUtenteSchema.safeParse({ ...base, corAvatar: "" }).success).toBe(true);
        expect(createUtenteSchema.safeParse({ ...base, corAvatar: "#4f378a" }).success).toBe(true);
        expect(createUtenteSchema.safeParse({ ...base, corAvatar: "#zzzzzz" }).success).toBe(false);
    });
    it("rejeita nome acima de 255 chars (corte previsível, não erro do driver)", () => {
        expect(createUtenteSchema.safeParse({ nome: "x".repeat(256), quarto: "A1" }).success).toBe(false);
    });
});

describe("saveTabelaSchema (config do tabuleiro)", () => {
    it("valida a estrutura mas mantém chaves futuras (passthrough)", () => {
        const r = saveTabelaSchema.safeParse({
            config: { cols: 5, cells: [1, null, 2], spans: {}, futuraChave: 1 },
        });
        expect(r.success).toBe(true);
        expect(r.data.config.futuraChave).toBe(1); // retrocompatibilidade preservada
    });
    it("rejeita cells com tipo errado", () => {
        expect(saveTabelaSchema.safeParse({ config: { cols: 5, cells: ["x"] } }).success).toBe(false);
    });
});
