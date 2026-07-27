'use strict';

// Ver 20260727100000-create-staff-auth.js para o raciocínio completo (item 5 do
// checklist) — mesma lógica idempotente aplicada a UtenteSession.
//
// utenteId é uma coluna simples, SEM foreign key — confirmado por introspecção do
// schema real (information_schema.KEY_COLUMN_USAGE) antes de escrever esta
// migration: o model UtenteSession.js nunca teve um `.associate`, por isso o
// sync() nunca criou essa FK. Fidelidade à realidade existente, não uma "melhoria"
// não pedida.
async function tabelaJaExiste(queryInterface, nome) {
  const linhas = await queryInterface.sequelize.query(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(:nome)',
    { replacements: { nome }, type: queryInterface.sequelize.QueryTypes.SELECT }
  );
  return linhas.length > 0;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tabelaJaExiste(queryInterface, 'UtenteSessions')) return;
    await queryInterface.createTable('UtenteSessions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      tokenHash: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      utenteId: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      expiraEm: {
        type: Sequelize.DATE,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  async down(queryInterface) {
    if (await tabelaJaExiste(queryInterface, 'UtenteSessions')) {
      await queryInterface.dropTable('UtenteSessions');
    }
  }
};
