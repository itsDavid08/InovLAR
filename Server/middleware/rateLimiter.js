const rateLimit = require('express-rate-limit');

// Protege contra brute-force do PIN de staff (4+ dígitos, alvo fácil sem isto).
// Conta só tentativas falhadas (skipSuccessfulRequests) para não penalizar uso normal.
const staffAuthLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { mensagem: 'Demasiadas tentativas. Tenta novamente mais tarde.' },
});

module.exports = { staffAuthLimiter };
