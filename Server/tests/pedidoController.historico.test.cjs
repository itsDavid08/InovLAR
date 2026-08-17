// CommonJS pela mesma razão do boardController.updatePedido.test.cjs: partilha o
// registo de módulos CJS com o controller, por isso o `Pedido` aqui É o que ele
// usa e o vi.spyOn nunca deixa chegar uma query à BD. Globais via vitest.config.mjs.
const { Op } = require("sequelize");
const pedidoController = require("../controller/pedidoController");
const { Pedido } = require("../models");

// O que se testa aqui é a TRADUÇÃO dos filtros da query string para o `where`/
// `order` do Sequelize — a parte que o teste de schema não cobre (esse só valida
// a forma dos parâmetros) e que decide se a página de registo mostra as linhas
// certas. O resultado das queries é mockado; a BD não é tocada.

const mockRes = () => {
    const res = { statusCode: 200 };
    res.status = vi.fn((c) => ((res.statusCode = c), res));
    res.json = vi.fn((b) => ((res.body = b), res));
    return res;
};

let findAndCountAll, count;
beforeEach(() => {
    findAndCountAll = vi.spyOn(Pedido, "findAndCountAll").mockResolvedValue({ rows: [], count: 0 });
    count = vi.spyOn(Pedido, "count").mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

const chamar = async (query) => {
    const res = mockRes();
    await pedidoController.getHistorico({ query }, res);
    return { res, args: findAndCountAll.mock.calls[0]?.[0] };
};

describe("getHistorico — filtros", () => {
    it("sem filtros: 1ª página, mais recente primeiro, sem where", async () => {
        const { res, args } = await chamar({});
        expect(res.statusCode).toBe(200);
        expect(args.where).toEqual({});
        expect(args.order).toEqual([["hora", "DESC"]]);
        expect(args.limit).toBe(50);
        expect(args.offset).toBe(0);
    });

    it("utente/estado passam para o where", async () => {
        const { args } = await chamar({ utenteId: "5", estado: "concluido" });
        expect(args.where.utenteId).toBe(5);
        expect(args.where.estado).toBe("concluido");
    });

    it("emergencia chega como texto e vai como boolean", async () => {
        expect((await chamar({ emergencia: "true" })).args.where.emergencia).toBe(true);
        vi.clearAllMocks();
        expect((await chamar({ emergencia: "false" })).args.where.emergencia).toBe(false);
    });

    it("o intervalo de datas abre no início do dia e fecha no fim do MESMO dia", async () => {
        const { args } = await chamar({ de: "2026-08-14", ate: "2026-08-14" });
        const inicio = args.where.hora[Op.gte];
        const fim = args.where.hora[Op.lte];
        // Hora local (é assim que o staff pensa nas datas), não UTC.
        expect(inicio.getFullYear()).toBe(2026);
        expect(inicio.getMonth()).toBe(7); // agosto
        expect(inicio.getDate()).toBe(14);
        expect(inicio.getHours()).toBe(0);
        expect(inicio.getMinutes()).toBe(0);
        expect(fim.getDate()).toBe(14);
        expect(fim.getHours()).toBe(23);
        expect(fim.getMinutes()).toBe(59);
        // Um dia só = intervalo de 24h menos 1 ms; se isto falhar, "hoje" perde pedidos.
        expect(fim - inicio).toBe(24 * 60 * 60 * 1000 - 1);
    });

    it("só `de` não fecha o intervalo (e vice-versa)", async () => {
        const so = (await chamar({ de: "2026-08-01" })).args.where.hora;
        expect(so[Op.gte]).toBeInstanceOf(Date);
        expect(so[Op.lte]).toBeUndefined();
    });

    it("categoria/texto tornam o join ao botão restritivo (INNER JOIN)", async () => {
        const { args } = await chamar({ categoria: "SOS", q: "medica" });
        const botao = args.include.find((i) => i.as === "botao");
        expect(botao.required).toBe(true);
        expect(botao.where.categoria).toBe("SOS");
        expect(botao.where[Op.or]).toHaveLength(2); // nome OU mensagem
        // Sem esses filtros o join fica opcional, senão perdiam-se pedidos.
        vi.clearAllMocks();
        const semFiltro = (await chamar({})).args.include.find((i) => i.as === "botao");
        expect(semFiltro.required).toBeUndefined();
        expect(semFiltro.where).toBeUndefined();
    });
});

describe("getHistorico — ordenação e paginação", () => {
    it("ordenar por utente ordena por uma coluna da tabela incluída", async () => {
        const { args } = await chamar({ ordenar: "utente", direcao: "asc" });
        expect(args.order[0][1]).toBe("nome");
        expect(args.order[0][2]).toBe("ASC");
        expect(args.order[0][0].as).toBe("utente");
    });

    it("qualquer ordenação desempata pela hora (paginação estável)", async () => {
        for (const chave of ["estado", "emergencia", "utente", "botao"]) {
            vi.clearAllMocks();
            const { args } = await chamar({ ordenar: chave });
            expect(args.order[args.order.length - 1]).toEqual(["hora", "DESC"]);
        }
    });

    it("limite e offset passam para a query", async () => {
        const { args } = await chamar({ limite: "10", offset: "30" });
        expect(args.limit).toBe(10);
        expect(args.offset).toBe(30);
    });
});

describe("getHistorico — entradas inválidas e resumo", () => {
    it("400 sem sequer consultar a BD", async () => {
        const { res } = await chamar({ estado: "arquivado" });
        expect(res.statusCode).toBe(400);
        expect(findAndCountAll).not.toHaveBeenCalled();
    });

    it("filtros vazios ('?estado=') são ignorados, não são um 400", async () => {
        const { res, args } = await chamar({ estado: "", utenteId: "", q: "" });
        expect(res.statusCode).toBe(200);
        expect(args.where).toEqual({});
    });

    it("o resumo cobre os 3 estados mesmo quando a BD só devolve alguns", async () => {
        count.mockResolvedValue([
            { estado: "concluido", emergencia: false, count: 4 },
            { estado: "concluido", emergencia: true, count: 1 },
            { estado: "cancelado", emergencia: true, count: 2 },
        ]);
        const res = mockRes();
        await pedidoController.getHistorico({ query: {} }, res);
        expect(res.body.resumo).toEqual({ pendente: 0, concluido: 5, cancelado: 2, emergencias: 3 });
    });
});
