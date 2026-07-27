'use strict';

// Ver 20260727100000-create-staff-auth.js para o raciocínio completo (item 5 do
// checklist) — mesma lógica idempotente aplicada a TabelaLayout.
//
// utenteId TEM uma foreign key real (confirmado por introspecção do schema real
// antes de escrever esta migration — ao contrário de UtenteSession) — vem do
// `TabelaLayout.associate` no model, com onDelete/onUpdate CASCADE.
async function tabelaJaExiste(queryInterface, nome) {
  const linhas = await queryInterface.sequelize.query(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(:nome)',
    { replacements: { nome }, type: queryInterface.sequelize.QueryTypes.SELECT }
  );
  return linhas.length > 0;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tabelaJaExiste(queryInterface, 'TabelaLayouts')) return;
    await queryInterface.createTable('TabelaLayouts', {
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
      dispositivo: {
        type: Sequelize.STRING,
        allowNull: false
      },
      config: {
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

    await queryInterface.addIndex('TabelaLayouts', ['utenteId', 'dispositivo'], {
      unique: true,
      name: 'tabela_layouts_utente_id_dispositivo'
    });
  },

  async down(queryInterface) {
    if (await tabelaJaExiste(queryInterface, 'TabelaLayouts')) {
      await queryInterface.dropTable('TabelaLayouts');
    }
  }
};
