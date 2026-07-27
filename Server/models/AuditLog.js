const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Trilho de auditoria: um registo por mutação feita por staff (ver Util/auditoria.js
// e IMPROVEMENTS_CHECKLIST.md item 4). Imutável por natureza — sem updatedAt.
// staffSessionId identifica a SESSÃO, não uma pessoa (PIN partilhado, sem contas
// nominais) — ver comentário na migration sobre a ausência deliberada de FK.
const AuditLog = sequelize.define(
    "AuditLog",
    {
        action: { type: DataTypes.STRING, allowNull: false },
        staffSessionId: { type: DataTypes.INTEGER, allowNull: true },
        ip: { type: DataTypes.STRING, allowNull: true },
        detalhes: { type: DataTypes.JSON, allowNull: true },
    },
    {
        tableName: "audit_logs",
        timestamps: true,
        updatedAt: false,
    }
);

module.exports = AuditLog;
