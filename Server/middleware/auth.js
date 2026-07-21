// Nomes dos cookies de sessão.
const COOKIE_NAME = "staff_session";
const COOKIE_NAME_UTENTE = "utente_session";
const { validarSessao } = require("../Util/sessions");
const { validarSessaoUtente } = require("../Util/utenteSessions");

// Middleware: bloqueia o pedido se o cookie de sessão não corresponder a uma
// sessão de staff válida e não expirada na BD. Usa-se nas rotas só-staff, p. ex.:
//   router.post("/utentes/create", requireStaff, utenteController.createUtente);
const requireStaff = async (req, res, next) => {
    try {
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME];
        if (await validarSessao(token)) return next();
        return res.status(401).json({ mensagem: "Não autenticado" });
    } catch (erro) {
        console.error("Erro ao validar sessão:", erro);
        return res.status(401).json({ mensagem: "Não autenticado" }); // fail closed
    }
};

// Middleware NÃO-bloqueante: marca req.isStaff conforme haja (ou não) sessão de
// staff válida. Para rotas partilhadas onde o staff tem privilégios extra.
const identifyStaff = async (req, res, next) => {
    try {
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME];
        req.isStaff = !!(await validarSessao(token));
    } catch (erro) {
        console.error("Erro ao identificar staff:", erro);
        req.isStaff = false;
    }
    next();
};

// Middleware NÃO-bloqueante: põe req.utenteId a partir do cookie de sessão do
// tabuleiro (ou null). O id vem da sessão verificada no servidor, nunca da URL.
const identifyUtente = async (req, res, next) => {
    try {
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME_UTENTE];
        const sessao = await validarSessaoUtente(token);
        req.utenteId = sessao ? sessao.utenteId : null;
    } catch (erro) {
        console.error("Erro ao identificar utente:", erro);
        req.utenteId = null;
    }
    next();
};

// Middleware bloqueante: exige uma sessão de tabuleiro válida. Depende de
// identifyUtente ter corrido antes (para preencher req.utenteId).
const requireUtente = (req, res, next) => {
    if (req.utenteId) return next();
    return res.status(401).json({ mensagem: "Sessão de utente inválida" });
};

module.exports = {
    requireStaff,
    identifyStaff,
    identifyUtente,
    requireUtente,
    COOKIE_NAME,
    COOKIE_NAME_UTENTE,
};
