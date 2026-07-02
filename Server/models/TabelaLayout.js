const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Layout do quadro de comunicação de um utente, por tipo de dispositivo.
// Uma linha por (utenteId, dispositivo). `config` guarda tudo em JSON:
//   { cols, size, cells: [botaoId|null, ...] }  (índice = posição na grelha)
const TabelaLayout = sequelize.define(
    "TabelaLayout",
    {
        utenteId: { type: DataTypes.INTEGER, allowNull: false },
        dispositivo: { type: DataTypes.STRING, allowNull: false }, // 'smartphone' | 'tablet' | 'pc'
        config: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    },
    {
        tableName: "TabelaLayouts",
        timestamps: true,
        indexes: [{ unique: true, fields: ["utenteId", "dispositivo"] }],
    }
);

TabelaLayout.associate = (models) => {
    TabelaLayout.belongsTo(models.Utente, {
        foreignKey: "utenteId",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
    });
};

module.exports = TabelaLayout;
