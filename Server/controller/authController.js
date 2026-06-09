const bcrypt = require("bcryptjs");
const { StaffAuth } = require("../models");
const { COOKIE_NAME } = require("../middleware/auth");

const UM_ANO = 365 * 24 * 60 * 60 * 1000;
const MIN_DIGITOS = 4;

// Opções do cookie de sessão.
const opcoesCookie = {
    httpOnly: true, // o JS do browser não consegue ler -> mais seguro
    signed: true, // assinado com o COOKIE_SECRET -> não pode ser forjado
    sameSite: "lax",
    secure: false, // mete true quando servires por HTTPS
    maxAge: UM_ANO, // ~1 ano no dispositivo (não volta a pedir)
};

const authController = {
    // GET /auth/staff/status
    // Diz ao frontend o que mostrar: definir password (1ª vez), login, ou já dentro.
    status: async (req, res) => {
        try {
            const registo = await StaffAuth.findOne();
            const autenticado =
                req.signedCookies && req.signedCookies[COOKIE_NAME] === "ok";
            res.json({ configurado: !!registo, autenticado });
        } catch (erro) {
            console.error("Erro no status de auth:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // POST /auth/staff/setup  { password }
    // Define a palavra-passe pela 1ª vez. Só permitido se ainda não existir nenhuma.
    setup: async (req, res) => {
        try {
            const { password } = req.body;
            if (!password || String(password).length < MIN_DIGITOS) {
                return res
                    .status(400)
                    .json({ mensagem: `A palavra-passe tem de ter pelo menos ${MIN_DIGITOS} dígitos` });
            }
            if (await StaffAuth.findOne()) {
                return res
                    .status(409)
                    .json({ mensagem: "Já existe uma palavra-passe definida" });
            }
            const passwordHash = await bcrypt.hash(String(password), 10);
            await StaffAuth.create({ passwordHash });
            res.cookie(COOKIE_NAME, "ok", opcoesCookie); // fica logo autenticado
            res.json({ autenticado: true });
        } catch (erro) {
            console.error("Erro ao definir palavra-passe:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // POST /auth/staff/login  { password }
    login: async (req, res) => {
        try {
            const registo = await StaffAuth.findOne();
            if (!registo) {
                return res
                    .status(409)
                    .json({ mensagem: "Ainda não há palavra-passe definida" });
            }
            const ok = await bcrypt.compare(
                String(req.body.password || ""),
                registo.passwordHash
            );
            if (!ok) {
                return res.status(401).json({ mensagem: "Palavra-passe incorreta" });
            }
            res.cookie(COOKIE_NAME, "ok", opcoesCookie);
            res.json({ autenticado: true });
        } catch (erro) {
            console.error("Erro no login:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // POST /auth/staff/change  { currentPassword, newPassword }
    // Requer estar autenticado (cookie) + saber a palavra-passe atual.
    change: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const registo = await StaffAuth.findOne();
            if (!registo) {
                return res
                    .status(409)
                    .json({ mensagem: "Ainda não há palavra-passe definida" });
            }
            const ok = await bcrypt.compare(
                String(currentPassword || ""),
                registo.passwordHash
            );
            if (!ok) {
                return res
                    .status(401)
                    .json({ mensagem: "Palavra-passe atual incorreta" });
            }
            if (!newPassword || String(newPassword).length < MIN_DIGITOS) {
                return res
                    .status(400)
                    .json({ mensagem: `A nova palavra-passe tem de ter pelo menos ${MIN_DIGITOS} dígitos` });
            }
            registo.passwordHash = await bcrypt.hash(String(newPassword), 10);
            await registo.save();
            res.json({ alterado: true });
        } catch (erro) {
            console.error("Erro ao alterar palavra-passe:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // POST /auth/staff/logout
    logout: (req, res) => {
        res.clearCookie(COOKIE_NAME);
        res.json({ autenticado: false });
    },
};

module.exports = authController;
