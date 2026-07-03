'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pedidos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      estado: {
        type: Sequelize.ENUM('pendente', 'concluido', 'cancelado'),
        defaultValue: 'pendente',
        allowNull: false
      },
      emergencia: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      hora: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('pedidos', ['utenteId']);
    await queryInterface.addIndex('pedidos', ['botaoId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pedidos');
  }
};