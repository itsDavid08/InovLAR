'use strict';

// A migration original (20250506190829-create-pedidos.js) criava a tabela como 'Pedidos'
// (maiúscula), mas o model (Server/models/Pedido.js) usa `tableName: 'pedidos'` (minúscula).
// No SQLite e no MariaDB do Windows (lower_case_table_names=1) isto passava despercebido —
// os nomes de tabela são dobrados/comparados sem distinguir maiúsculas/minúsculas. No MariaDB
// de Linux (omissão lower_case_table_names=0, como na Raspberry Pi), os nomes são case-sensitive:
// a tabela física fica 'Pedidos' mas o Sequelize procura 'pedidos' → "Table 'pedidos' doesn't exist".
// Defensivo: em sistemas com lower_case_table_names=1 (Windows, macOS por omissão) 'Pedidos' e
// 'pedidos' já são a MESMA tabela — um RENAME às cegas rebentava com "already exists". Por isso
// verifica-se primeiro, com BINARY (comparação exata de maiúsculas/minúsculas), se existe mesmo uma
// tabela física distinta chamada 'Pedidos' antes de tentar o rename.
async function tabelaExisteExata(queryInterface, nome) {
  const linhas = await queryInterface.sequelize.query(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = :nome',
    { replacements: { nome }, type: queryInterface.sequelize.QueryTypes.SELECT }
  );
  return linhas.length > 0;
}

module.exports = {
  async up(queryInterface) {
    if (await tabelaExisteExata(queryInterface, 'Pedidos')) {
      await queryInterface.sequelize.query('RENAME TABLE `Pedidos` TO `pedidos`;');
    }
  },

  async down(queryInterface) {
    if (await tabelaExisteExata(queryInterface, 'pedidos')) {
      await queryInterface.sequelize.query('RENAME TABLE `pedidos` TO `Pedidos`;');
    }
  }
};
