'use strict';

const crypto = require('crypto');

// Token de acesso do utente: segredo aleatório e imprevisível que passa a viver na
// URL do tabuleiro (`/board/<accessToken>`), substituindo o id cifrado de forma
// reversível. É uma credencial real — verificada no servidor — e não obfuscação.
//
// Nota: as queries raw levam `type` explícito. Sem isso, o conector `mariadb`
// rebenta com "Cannot delete property 'meta'". A migration é idempotente (guardas
// em cada passo) para tolerar uma execução parcial anterior.
module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    // 1. Adiciona a coluna anulável (só se ainda não existir).
    const table = await queryInterface.describeTable('Utentes');
    if (!table.accessToken) {
      await queryInterface.addColumn('Utentes', 'accessToken', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // 2. Backfill: um token único por cada utente ainda sem token.
    const rows = await queryInterface.sequelize.query(
      'SELECT id FROM Utentes WHERE accessToken IS NULL',
      { type: QueryTypes.SELECT }
    );
    for (const { id } of rows) {
      const token = crypto.randomBytes(32).toString('hex');
      await queryInterface.sequelize.query(
        'UPDATE Utentes SET accessToken = :token WHERE id = :id',
        { replacements: { token, id }, type: QueryTypes.UPDATE }
      );
    }

    // 3. Agora que todas as linhas têm valor: torna NOT NULL.
    await queryInterface.changeColumn('Utentes', 'accessToken', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // 4. Índice único (idempotente — ignora se já existir).
    try {
      await queryInterface.addIndex('Utentes', ['accessToken'], {
        unique: true,
        name: 'utentes_access_token_unique',
      });
    } catch (err) {
      if (!/exist|duplicate/i.test(err.message)) throw err;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('Utentes', 'utentes_access_token_unique');
    } catch (err) {
      if (!/exist/i.test(err.message)) throw err;
    }
    await queryInterface.removeColumn('Utentes', 'accessToken');
  },
};
