const crypto = require("crypto");
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Utente = sequelize.define(
    "Utente",
    {
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        quarto: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        // Foto de perfil: caminho da imagem (predefinida ou upload pessoal), ou null.
        imagem: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Cor de fundo do avatar (iniciais) quando não há foto, ou null.
        corAvatar: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Segredo de acesso ao tabuleiro (URL `/board/<accessToken>`). Gerado no hook
        // abaixo — nunca vem do corpo do pedido. Credencial real, não obfuscação.
        accessToken: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        }
    },
    {
        tableName: "Utentes",
        timestamps: true, // Habilitado para consistencia
        // O accessToken é um segredo — nunca sai nas leituras normais (algumas são
        // rotas abertas). Para o incluir (roster do staff, ver Fase 3) usa-se
        // `Utente.unscoped()`, que remove este defaultScope.
        defaultScope: {
            attributes: { exclude: ["accessToken"] }
        },
        hooks: {
            // Garante o invariante "todo o utente tem um accessToken" no próprio modelo,
            // qualquer que seja o caminho de criação.
            beforeValidate: (utente) => {
                if (!utente.accessToken) {
                    utente.accessToken = crypto.randomBytes(32).toString("hex");
                }
            }
        }
    }
);

Utente.associate = (models) => {
    Utente.belongsToMany(models.Botao, {
        through: "UtenteBotoes",
        foreignKey: "utenteId",
        as: "botoes",
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Utente.hasMany(models.Pedido, {
        foreignKey: "utenteId",
        as: "pedidos",
        onDelete: 'CASCADE', // Elimina pedidos si se borra el utente
        onUpdate: 'CASCADE'
    });
};

module.exports = Utente;