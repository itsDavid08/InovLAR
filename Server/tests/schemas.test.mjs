import { describe, it, expect } from "vitest";
import {
    boardSessionSchema,
    createPedidoSchema,
    updatePedidoSchema,
    historicoPedidosQuerySchema,
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

describe("historicoPedidosQuerySchema", () => {
    // Único schema aplicado a uma query string (não ao body) — tudo chega como
    // texto, por isso o que interessa aqui é a coerção e os valores por omissão.
    it("sem filtros dá os valores por omissão da 1ª página", () => {
        const r = historicoPedidosQuerySchema.safeParse({});
        expect(r.success).toBe(true);
        expect(r.data).toEqual({ ordenar: "hora", direcao: "desc", limite: 50, offset: 0 });
    });
    it("converte os números que vêm como texto", () => {
        const r = historicoPedidosQuerySchema.safeParse({ utenteId: "7", limite: "10", offset: "20" });
        expect(r.success).toBe(true);
        expect(r.data.utenteId).toBe(7);
        expect(r.data.limite).toBe(10);
        expect(r.data.offset).toBe(20);
    });
    it("aceita datas YYYY-MM-DD e rejeita outros formatos", () => {
        expect(historicoPedidosQuerySchema.safeParse({ de: "2026-08-14" }).success).toBe(true);
        expect(historicoPedidosQuerySchema.safeParse({ de: "14-08-2026" }).success).toBe(false);
        expect(historicoPedidosQuerySchema.safeParse({ ate: "2026-8-1" }).success).toBe(false);
    });
    it("rejeita valores fora das listas conhecidas", () => {
        expect(historicoPedidosQuerySchema.safeParse({ estado: "arquivado" }).success).toBe(false);
        expect(historicoPedidosQuerySchema.safeParse({ ordenar: "utenteId" }).success).toBe(false);
        expect(historicoPedidosQuerySchema.safeParse({ direcao: "cima" }).success).toBe(false);
        expect(historicoPedidosQuerySchema.safeParse({ emergencia: "1" }).success).toBe(false);
    });
    it("trava o limite no teto de 200 (não deixa puxar a tabela toda)", () => {
        expect(historicoPedidosQuerySchema.safeParse({ limite: "200" }).success).toBe(true);
        expect(historicoPedidosQuerySchema.safeParse({ limite: "201" }).success).toBe(false);
        expect(historicoPedidosQuerySchema.safeParse({ limite: "0" }).success).toBe(false);
        expect(historicoPedidosQuerySchema.safeParse({ offset: "-1" }).success).toBe(false);
    });
    it("descarta parâmetros não declarados", () => {
        const r = historicoPedidosQuerySchema.safeParse({ hack: "x", order: "DROP TABLE" });
        expect(r.success).toBe(true);
        expect(r.data.hack).toBeUndefined();
        expect(r.data.order).toBeUndefined();
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
