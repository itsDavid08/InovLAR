const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Guarda UMA linha com o hash da palavra-passe partilhada do staff.
// Não há nomes nem contas: é uma autenticação "geral" do dispositivo,
// como o código de acesso de um telemóvel (definido pelo próprio staff).
const StaffAuth = sequelize.define(
    "StaffAuth",
    {
        passwordHash: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        tableName: "StaffAuth",
        timestamps: true,
    }
);

module.exports = StaffAuth;
