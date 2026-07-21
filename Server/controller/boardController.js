const { Utente } = require("../models");
const { criarSessaoUtente, revogarSessaoUtente } = require("../Util/utenteSessions");
const { COOKIE_NAME_UTENTE } = require("../middleware/auth");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Cookie da sessão do tabuleiro. Mesmo formato do cookie de staff (httpOnly,
// assinado, secure opt-in via COOKIE_SECURE), mas com nome próprio.
const cookieOptions = {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: THIRTY_DAYS_MS,
};

const boardController = {
    // POST /board/session { accessToken } — troca o accessToken (segredo da URL)
    // por uma sessão de tabuleiro (cookie). É o "bootstrap" do tablet.
    createSession: async (req, res) => {
        const { accessToken } = req.body;
        if (!accessToken) return res.status(400).json({ mensagem: "accessToken em falta" });

        const utente = await Utente.findOne({ where: { accessToken } });
        if (!utente) return res.status(404).json({ mensagem: "Utente não encontrado" });

        const token = await criarSessaoUtente(utente.id);
        res.cookie(COOKIE_NAME_UTENTE, token, cookieOptions);
        res.json({ id: utente.id });
    },

    // POST /board/logout — revoga a sessão do tabuleiro (limpa o cookie).
    logout: async (req, res) => {
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME_UTENTE];
        await revogarSessaoUtente(token);
        res.clearCookie(COOKIE_NAME_UTENTE);
        res.json({ ok: true });
    },
};

module.exports = boardController;
