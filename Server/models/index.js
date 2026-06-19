const sequelize = require('../config/database');
const Botao = require('./Botao');
const Utente = require('./Utente');
const Pedido = require('./Pedido');
const StaffAuth = require('./StaffAuth');
const TabelaLayout = require('./TabelaLayout');

const models = { Botao, Utente, Pedido, StaffAuth, TabelaLayout };

const initDb = async () => {
    try {
        await sequelize.sync({ force: false }); // Cambiar a true solo en desarrollo
        console.log('Database synchronized');
    } catch (error) {
        console.error('Error synchronizing database:', error);
    }
}

// Establecer relaciones
Object.keys(models).forEach((modelName) => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

module.exports = { ...models, sequelize, initDb };