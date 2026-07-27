'use strict';

// Ver 20260727100000-create-staff-auth.js para o raciocínio completo (item 5 do
// checklist) — mesma lógica idempotente aplicada a TabelaPadrao.
async function tabelaJaExiste(queryInterface, nome) {
  const linhas = await queryInterface.sequelize.query(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(:nome)',
    { replacements: { nome }, type: queryInterface.sequelize.QueryTypes.SELECT }
  );
  return linhas.length > 0;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tabelaJaExiste(queryInterface, 'TabelaPadroes')) return;
    await queryInterface.createTable('TabelaPadroes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      nome: {
        type: Sequelize.STRING,
        allowNull: false
      },
      configs: {
        type: Sequelize.JSON,
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
    if (await tabelaJaExiste(queryInterface, 'TabelaPadroes')) {
      await queryInterface.dropTable('TabelaPadroes');
    }
  }
};
