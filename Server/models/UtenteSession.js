const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Uma linha por sessão de tabuleiro ativa. O cookie guarda um token aleatório;
// aqui guardamos só o SHA-256 desse token + o utente a que pertence + a expiração.
// Espelha o StaffSession, mas ligado a um utenteId (o board é por-utente).
const UtenteSession = sequelize.define(
    "UtenteSession",
    {
        tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
        utenteId:  { type: DataTypes.INTEGER, allowNull: false },
        expiraEm:  { type: DataTypes.DATE, allowNull: false },
    },
    { tableName: "UtenteSessions", timestamps: true }
);

module.exports = UtenteSession;
