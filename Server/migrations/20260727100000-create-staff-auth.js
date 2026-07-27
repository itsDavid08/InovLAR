'use strict';

// Item 5 do IMPROVEMENTS_CHECKLIST.md: StaffAuth era criada por Model.sync() (sem
// histórico reproduzível). Esta migration passa a ser a fonte de verdade — mas em
// qualquer instalação existente a tabela já existe (criada por sync()), por isso o
// up() só cria se a tabela ainda não existir: nunca mexe numa instalação já a
// funcionar, só preenche o histórico para instalações NOVAS de agora em diante.
// Ver DEVELOPMENT_LOG.md 2026-07-27 para o raciocínio completo e a verificação.
//
// NOTA sobre a comparação SEM BINARY (ao contrário de
// 20260703150000-rename-pedidos-table.js): aquela migration precisava de
// distinguir 'Pedidos' de 'pedidos' como nomes potencialmente DIFERENTES (para
// decidir se havia um rename a fazer). Aqui só interessa "esta tabela já existe,
// seja qual for a capitalização" — com lower_case_table_names=1 (Windows/macOS) o
// information_schema guarda o nome em minúsculas independentemente de como a
// tabela foi criada, por isso um BINARY TABLE_NAME = 'StaffAuth' NUNCA encontra a
// tabela existente aí, e o up() tentava recriá-la (apanhado em teste local — ver
// DEVELOPMENT_LOG.md). LOWER() em ambos os lados funciona nos dois sistemas.
async function tabelaJaExiste(queryInterface, nome) {
  const linhas = await queryInterface.sequelize.query(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(:nome)',
    { replacements: { nome }, type: queryInterface.sequelize.QueryTypes.SELECT }
  );
  return linhas.length > 0;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tabelaJaExiste(queryInterface, 'StaffAuth')) return;
    await queryInterface.createTable('StaffAuth', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      passwordHash: {
        type: Sequelize.STRING,
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

  // Reverso estrutural simples (mesmo padrão das outras migrations deste projeto —
  // ex. 20260714120000): num sistema já a usar esta tabela, um `db:migrate:undo`
  // apaga os dados reais (sessões de staff ativas). Não é uma operação de rotina.
  async down(queryInterface) {
    if (await tabelaJaExiste(queryInterface, 'StaffAuth')) {
      await queryInterface.dropTable('StaffAuth');
    }
  }
};
