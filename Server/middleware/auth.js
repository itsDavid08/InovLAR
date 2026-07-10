// Nome do cookie de sessão do staff.
const COOKIE_NAME = "staff_session";
const { validarSessao } = require("../Util/sessions");

// Middleware: bloqueia o pedido se o cookie de sessão não corresponder a uma
// sessão válida e não expirada na BD. Usa-se nas rotas que só o staff pode aceder, p. ex.:
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

module.exports = { requireStaff, COOKIE_NAME };
