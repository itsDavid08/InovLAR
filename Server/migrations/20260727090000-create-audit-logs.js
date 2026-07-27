'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      action: {
        // "recurso.verbo", ex.: "utente.update", "pedido.delete" — ver Util/auditoria.js.
        type: Sequelize.STRING,
        allowNull: false
      },
      staffSessionId: {
        // Sem FK de propósito: StaffSession é limpa (logout/expiração/purga no
        // arranque) e o registo de auditoria tem de sobreviver a essa limpeza —
        // uma FK com CASCADE apagaria o histórico junto com a sessão. Distingue
        // "qual sessão/dispositivo" fez a mutação; o PIN é partilhado, por isso
        // isto não identifica uma pessoa, só uma sessão de staff.
        type: Sequelize.INTEGER,
        allowNull: true
      },
      ip: {
        type: Sequelize.STRING,
        allowNull: true
      },
      detalhes: {
        // JSON livre com o que for relevante à ação (ex.: { utenteId, nome }).
        type: Sequelize.JSON,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('audit_logs', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  }
};
