const sequelize = require('../config/database');
const Botao = require('./Botao');
const Utente = require('./Utente');
const Pedido = require('./Pedido');
const StaffAuth = require('./StaffAuth');
const StaffSession = require('./StaffSession');
const UtenteSession = require('./UtenteSession');
const TabelaLayout = require('./TabelaLayout');
const TabelaPadrao = require('./TabelaPadrao');
const AuditLog = require('./AuditLog');

const models = { Botao, Utente, Pedido, StaffAuth, StaffSession, UtenteSession, TabelaLayout, TabelaPadrao, AuditLog };

// Establecer relaciones
Object.keys(models).forEach((modelName) => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

module.exports = { ...models, sequelize };