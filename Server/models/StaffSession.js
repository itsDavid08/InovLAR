const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Uma linha por sessão de staff ativa. O cookie guarda um token aleatório;
// aqui guardamos só o SHA-256 desse token (nunca em claro) + a expiração.
// Permite revogação real (logout, limpeza) — ao contrário do antigo cookie "ok".
const StaffSession = sequelize.define(
    "StaffSession",
    {
        tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
        expiraEm:  { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: "StaffSessions", timestamps: true }
);

module.exports = StaffSession;
