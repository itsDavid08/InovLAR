const bcrypt = require("bcryptjs");
const { StaffAuth } = require("../models");
const { COOKIE_NAME } = require("../middleware/auth");
const { criarSessao, validarSessao, revogarSessao } = require("../Util/sessions");
const { MIN_PASSWORD_DIGITS: MIN_DIGITS } = require("../config/auth");

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const cookieOptions = {
    httpOnly: true, // browser JS can't read it
    signed: true, // signed with COOKIE_SECRET → can't be forged
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true", // only when HTTPS terminates in front (see .env.example)
    maxAge: ONE_YEAR_MS, // ~1 year on the device (no repeated logins)
};

const authController = {
    // GET /auth/staff/status — tells the frontend what to show:
    // first-time setup, login, or already authenticated.
    status: async (req, res) => {
        const record = await StaffAuth.findOne();
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME];
        const autenticado = !!(await validarSessao(token));
        res.json({ configurado: !!record, autenticado });
    },

    // POST /auth/staff/setup { password } — first-time only.
    setup: async (req, res) => {
        const { password } = req.body;
        if (!password || String(password).length < MIN_DIGITS) {
            return res.status(400).json({
                mensagem: `A palavra-passe tem de ter pelo menos ${MIN_DIGITS} dígitos`,
            });
        }
        if (await StaffAuth.findOne()) {
            return res.status(409).json({ mensagem: "Já existe uma palavra-passe definida" });
        }
        const passwordHash = await bcrypt.hash(String(password), 10);
        await StaffAuth.create({ passwordHash });
        const token = await criarSessao(); // authenticated right away
        res.cookie(COOKIE_NAME, token, cookieOptions);
        res.json({ autenticado: true });
    },

    // POST /auth/staff/login { password }
    login: async (req, res) => {
        const record = await StaffAuth.findOne();
        if (!record) {
            return res.status(409).json({ mensagem: "Ainda não há palavra-passe definida" });
        }
        const ok = await bcrypt.compare(String(req.body.password || ""), record.passwordHash);
        if (!ok) {
            return res.status(401).json({ mensagem: "Palavra-passe incorreta" });
        }
        const token = await criarSessao();
        res.cookie(COOKIE_NAME, token, cookieOptions);
        res.json({ autenticado: true });
    },

    // POST /auth/staff/change { currentPassword, newPassword } — requires an
    // authenticated session (cookie) AND knowing the current password.
    change: async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const record = await StaffAuth.findOne();
        if (!record) {
            return res.status(409).json({ mensagem: "Ainda não há palavra-passe definida" });
        }
        const ok = await bcrypt.compare(String(currentPassword || ""), record.passwordHash);
        if (!ok) {
            return res.status(401).json({ mensagem: "Palavra-passe atual incorreta" });
        }
        if (!newPassword || String(newPassword).length < MIN_DIGITS) {
            return res.status(400).json({
                mensagem: `A nova palavra-passe tem de ter pelo menos ${MIN_DIGITS} dígitos`,
            });
        }
        record.passwordHash = await bcrypt.hash(String(newPassword), 10);
        await record.save();
        res.json({ alterado: true });
    },

    // POST /auth/staff/logout — real server-side revocation.
    logout: async (req, res) => {
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME];
        await revogarSessao(token);
        res.clearCookie(COOKIE_NAME);
        res.json({ autenticado: false });
    },
};

module.exports = authController;
