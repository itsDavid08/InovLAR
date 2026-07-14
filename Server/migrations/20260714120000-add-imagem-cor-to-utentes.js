'use strict';

// Foto de perfil do utente: caminho da imagem escolhida (predefinida ou upload
// pessoal) e cor de fundo do avatar quando não há foto (fallback das iniciais).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Utentes', 'imagem', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Utentes', 'corAvatar', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Utentes', 'imagem');
    await queryInterface.removeColumn('Utentes', 'corAvatar');
  }
};
