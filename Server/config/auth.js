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

// Tamanho do PIN do staff (nº de dígitos). Mínimo 6 (4 dígitos = só 10.000
// combinações — força bruta viável mesmo com rate limiting, ver DEVELOPMENT_LOG.md
// 2026-07-23). Máximo 20: sem teto "prático" (o teclado físico também funciona,
// não só o táctil), mas continua limitado para não mandar uma string arbitrária
// para o bcrypt.hash.
const MIN_PASSWORD_DIGITS = 6;
const MAX_PASSWORD_DIGITS = 20;

// Custo do bcrypt (nº de "rounds" = 2^custo iterações). O rate limiting no login
// protege contra adivinhar o PIN online; isto protege contra um ataque offline
// (alguém a testar hashes localmente, sem limite, se algum dia ler a tabela
// StaffAuth) — ver DEVELOPMENT_LOG.md 2026-07-23. Só corre em setup/login/change,
// nunca por pedido normal (sessões validam por SHA-256), por isso o custo extra
// não é sentido no uso do dia a dia.
const BCRYPT_COST = 12;

module.exports = { COOKIE_SECRET, MIN_PASSWORD_DIGITS, MAX_PASSWORD_DIGITS, BCRYPT_COST };
