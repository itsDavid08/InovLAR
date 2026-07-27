// CommonJS de propósito (ver boardController.updatePedido.test.cjs): partilha o
// registo de módulos CJS com Util/auditoria.js e middleware/auth.js (ambos via
// require), para o vi.spyOn nos objetos reais (AuditLog, Util/sessions) ser visto
// pelo código sob teste.
const { registarAuditoria } = require("../Util/auditoria");
const { AuditLog, StaffSession } = require("../models");
const { requireStaff } = require("../middleware/auth");
const auditoriaController = require("../controller/auditoriaController");

const mockRes = () => {
    const res = { statusCode: 200 };
    res.status = vi.fn((c) => ((res.statusCode = c), res));
    res.json = vi.fn((b) => ((res.body = b), res));
    return res;
};

afterEach(() => vi.restoreAllMocks());

describe("registarAuditoria", () => {
    it("cria um registo com action, staffSessionId, ip e detalhes", async () => {
        const create = vi.spyOn(AuditLog, "create").mockResolvedValue({});
        const req = { staffSessionId: 7, ip: "10.0.0.5" };
        await registarAuditoria(req, "utente.update", { utenteId: 3 });
        expect(create).toHaveBeenCalledWith({
            action: "utente.update",
            staffSessionId: 7,
            ip: "10.0.0.5",
            detalhes: { utenteId: 3 },
        });
    });

    it("NUNCA rejeita, mesmo se AuditLog.create falhar (não pode transformar uma mutação OK em 500)", async () => {
        vi.spyOn(AuditLog, "create").mockRejectedValue(new Error("BD em baixo"));
        await expect(registarAuditoria({}, "x.y")).resolves.toBeUndefined();
    });

    it("staffSessionId/ip em falta -> null, sem rebentar", async () => {
        const create = vi.spyOn(AuditLog, "create").mockResolvedValue({});
        await registarAuditoria({}, "auth.changePassword");
        expect(create).toHaveBeenCalledWith({
            action: "auth.changePassword",
            staffSessionId: null,
            ip: null,
            detalhes: null,
        });
    });
});

describe("requireStaff expõe req.staffSessionId (para a auditoria)", () => {
    // Espia StaffSession.findOne (não Util/sessions.validarSessao — middleware/auth.js
    // desestrutura o import no topo do ficheiro, `const { validarSessao } = require(...)`,
    // e um vi.spyOn no objeto do módulo não intercetava esse binding local; aqui a
    // validarSessao REAL corre, incl. o hash do token e o check de expiração).
    it("com sessão válida, põe req.staffSessionId = sessao.id e segue", async () => {
        vi.spyOn(StaffSession, "findOne").mockResolvedValue({
            id: 99,
            expiraEm: new Date(Date.now() + 60_000),
        });
        const req = { signedCookies: { staff_session: "qualquer-token" } };
        const res = mockRes();
        const next = vi.fn();
        await requireStaff(req, res, next);
        expect(req.staffSessionId).toBe(99);
        expect(next).toHaveBeenCalled();
    });

    it("sem sessão válida, não define staffSessionId e devolve 401", async () => {
        vi.spyOn(StaffSession, "findOne").mockResolvedValue(null);
        const req = { signedCookies: { staff_session: "token-invalido" } };
        const res = mockRes();
        const next = vi.fn();
        await requireStaff(req, res, next);
        expect(req.staffSessionId).toBeUndefined();
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
});

describe("auditoriaController.list", () => {
    it("usa o limite por omissão (50), mais recentes primeiro", async () => {
        const findAll = vi.spyOn(AuditLog, "findAll").mockResolvedValue([]);
        const req = { query: {} };
        const res = mockRes();
        await auditoriaController.list(req, res);
        expect(findAll).toHaveBeenCalledWith({ order: [["createdAt", "DESC"]], limit: 50 });
        expect(res.statusCode).toBe(200);
    });

    it("aceita ?limit= customizado", async () => {
        const findAll = vi.spyOn(AuditLog, "findAll").mockResolvedValue([]);
        const req = { query: { limit: "10" } };
        const res = mockRes();
        await auditoriaController.list(req, res);
        expect(findAll).toHaveBeenCalledWith({ order: [["createdAt", "DESC"]], limit: 10 });
    });

    it("capa o limite em MAX_LIMIT (200) mesmo que peçam mais", async () => {
        const findAll = vi.spyOn(AuditLog, "findAll").mockResolvedValue([]);
        const req = { query: { limit: "99999" } };
        const res = mockRes();
        await auditoriaController.list(req, res);
        expect(findAll).toHaveBeenCalledWith({ order: [["createdAt", "DESC"]], limit: 200 });
    });

    it("limit inválido (não numérico) cai no valor por omissão", async () => {
        const findAll = vi.spyOn(AuditLog, "findAll").mockResolvedValue([]);
        const req = { query: { limit: "abc" } };
        const res = mockRes();
        await auditoriaController.list(req, res);
        expect(findAll).toHaveBeenCalledWith({ order: [["createdAt", "DESC"]], limit: 50 });
    });
});
