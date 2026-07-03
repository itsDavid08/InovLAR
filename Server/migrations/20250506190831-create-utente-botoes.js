'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UtenteBotoes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      utenteId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Utentes',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      botaoId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Botoes',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('UtenteBotoes', ['utenteId', 'botaoId'], {
      unique: true,
      name: 'unique_utente_botao'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('UtenteBotoes');
  }
};