const { AuditLog } = require("../models");

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const auditoriaController = {
    // GET /auditoria?limit=50 — mais recentes primeiro (requireStaff). `limit` é
    // opcional, capado em MAX_LIMIT para não permitir um dump ilimitado da tabela.
    list: async (req, res) => {
        const parsed = parseInt(req.query.limit, 10);
        const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
        const registos = await AuditLog.findAll({
            order: [["createdAt", "DESC"]],
            limit,
        });
        res.json(registos);
    },
};

module.exports = auditoriaController;
