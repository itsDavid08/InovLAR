// Configuração de autenticação.
// COOKIE_SECRET é um segredo TÉCNICO usado para assinar o cookie de sessão.
// NÃO é a palavra-passe do staff (essa é definida por eles e guardada cifrada na BD).
//
// Em produção define-o por variável de ambiente:
//   COOKIE_SECRET="algo-bem-grande-e-aleatorio" node main.js
module.exports = {
    COOKIE_SECRET: process.env.COOKIE_SECRET || "troca-isto-por-um-segredo-bem-grande",
};
