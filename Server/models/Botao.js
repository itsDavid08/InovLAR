const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Botao = sequelize.define(
    "Botao",
    {
        nome: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        mensagem: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        },
        imagem: {
            type: DataTypes.STRING,
            allowNull: true
        },
        categoria: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: { notEmpty: true }
        }
    },
    {
        tableName: "Botoes",
        timestamps: true
    }
);

Botao.associate = (models) => {
    Botao.belongsToMany(models.Utente, {
        through: "UtenteBotoes",
        foreignKey: "botaoId",
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });

    Botao.hasMany(models.Pedido, {
        foreignKey: "botaoId",
        as: "pedidos",
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
};

module.exports = Botao;