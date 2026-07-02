// Nome do cookie de sessão do staff.
const COOKIE_NAME = "staff_session";

// Middleware: bloqueia o pedido se o cookie assinado não for válido.
// Usa-se nas rotas que só o staff pode aceder, p. ex.:
//   router.post("/utentes/create", requireStaff, utenteController.createUtente);
const requireStaff = (req, res, next) => {
    if (req.signedCookies && req.signedCookies[COOKIE_NAME] === "ok") {
        return next();
    }
    return res.status(401).json({ mensagem: "Não autenticado" });
};

module.exports = { requireStaff, COOKIE_NAME };
