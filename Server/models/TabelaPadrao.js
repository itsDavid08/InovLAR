const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Template de tabela ("default") — reutilizável, independente do utente.
// `configs` guarda os 3 layouts por dispositivo: { smartphone, tablet, pc },
// cada um no mesmo formato do TabelaLayout: { cols, size, cells }.
const TabelaPadrao = sequelize.define(
    "TabelaPadrao",
    {
        nome: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
        configs: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    },
    { tableName: "TabelaPadroes", timestamps: true }
);

module.exports = TabelaPadrao;
