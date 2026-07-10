require('dotenv').config();

// Configuração de autenticação.
// COOKIE_SECRET é um segredo TÉCNICO usado para assinar o cookie de sessão.
// NÃO é a palavra-passe do staff (essa é definida por eles e guardada cifrada na BD).
//
// Obrigatório em produção — define-o no Server/.env:
//   COOKIE_SECRET=algo-bem-grande-e-aleatorio
const isProd = process.env.NODE_ENV === 'production';
let COOKIE_SECRET = process.env.COOKIE_SECRET;

if (!COOKIE_SECRET) {
    if (isProd) {
        console.error('COOKIE_SECRET não definido. Define-o no Server/.env antes de arrancar em produção.');
        process.exit(1);
    }
    console.warn('AVISO: COOKIE_SECRET não definido — a usar um valor fixo só para desenvolvimento local. NÃO uses isto em produção.');
    COOKIE_SECRET = 'dev-only-cookie-secret-inseguro-nao-usar-em-producao';
}

module.exports = { COOKIE_SECRET };
