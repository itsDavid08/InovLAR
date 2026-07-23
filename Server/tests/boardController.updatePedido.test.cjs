// CommonJS de propósito: partilha o registo de módulos CJS com o boardController
// (ambos via `require`), por isso `Pedido` aqui É o mesmo objeto que o controller
// usa — o `vi.spyOn` no seu método é visto pelo controller e nunca se toca na BD.
// (Um teste .mjs importaria uma 2ª instância dos modelos → associate() a correr
// duas vezes e o spy invisível ao controller.) Globais do Vitest via vitest.config.mjs.
const boardController = require("../controller/boardController");
const { Pedido } = require("../models");

// A posse dos pedidos do tabuleiro é o item de segurança fechado em 2026-07-21:
// PUT /board/pedidos/:id só toca num pedido do utente da SESSÃO (senão 403).

const mockRes = () => {
    const res = { statusCode: 200 };
    res.status = vi.fn((c) => ((res.statusCode = c), res));
    res.json = vi.fn((b) => ((res.body = b), res));
    return res;
};

let findByPk;
beforeEach(() => {
    findByPk = vi.spyOn(Pedido, "findByPk");
});
afterEach(() => vi.restoreAllMocks());

describe("board updatePedido — posse", () => {
    it("403 quando o pedido é de outro utente", async () => {
        findByPk.mockResolvedValue({ id: 7, utenteId: 999, update: vi.fn() });
        const req = { params: { id: "7" }, body: { estado: "concluido" }, utenteId: 1 };
        const res = mockRes();
        await boardController.updatePedido(req, res);
        expect(res.statusCode).toBe(403);
    });

    it("404 quando o pedido não existe", async () => {
        findByPk.mockResolvedValue(null);
        const req = { params: { id: "7" }, body: { estado: "concluido" }, utenteId: 1 };
        const res = mockRes();
        await boardController.updatePedido(req, res);
        expect(res.statusCode).toBe(404);
    });

    it("400 quando o estado não é do ENUM (nem chega a consultar a BD)", async () => {
        const req = { params: { id: "7" }, body: { estado: "invalido" }, utenteId: 1 };
        const res = mockRes();
        await boardController.updatePedido(req, res);
        expect(res.statusCode).toBe(400);
        expect(findByPk).not.toHaveBeenCalled();
    });

    it("atualiza o pedido do próprio utente", async () => {
        const update = vi.fn().mockResolvedValue();
        findByPk.mockResolvedValue({ id: 7, utenteId: 1, update });
        const req = { params: { id: "7" }, body: { estado: "concluido" }, utenteId: 1 };
        const res = mockRes();
        await boardController.updatePedido(req, res);
        expect(update).toHaveBeenCalledWith({ estado: "concluido" });
        expect(res.statusCode).toBe(200);
    });
});
