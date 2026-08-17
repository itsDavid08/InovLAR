'use strict';

// Índice em `pedidos.hora`, para a vista de registo (GET /pedidos/historico):
// filtra por intervalo de datas e ordena sempre por hora, sobre uma tabela que
// só cresce. Os índices de utenteId/botaoId já existem da migração inicial.
// Guardado por showIndex porque uma instalação pode já o ter criado à mão.
const NOME = 'pedidos_hora';

module.exports = {
    async up(queryInterface) {
        const indices = await queryInterface.showIndex('pedidos');
        if (indices.some((i) => i.name === NOME)) return;
        await queryInterface.addIndex('pedidos', ['hora'], { name: NOME });
    },

    async down(queryInterface) {
        const indices = await queryInterface.showIndex('pedidos');
        if (!indices.some((i) => i.name === NOME)) return;
        await queryInterface.removeIndex('pedidos', NOME);
    },
};
