const bcrypt = require("bcryptjs");
const { Transaction } = require("sequelize");
const { StaffAuth, sequelize } = require("../models");
const { COOKIE_NAME } = require("../middleware/auth");
const { criarSessao, validarSessao, revogarSessao } = require("../Util/sessions");
const { MIN_PASSWORD_DIGITS: MIN_DIGITS, MAX_PASSWORD_DIGITS: MAX_DIGITS, BCRYPT_COST } = require("../config/auth");

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const PIN_RANGE_MSG = `A palavra-passe tem de ter entre ${MIN_DIGITS} e ${MAX_DIGITS} dígitos`;

const cookieOptions = {
    httpOnly: true, // browser JS can't read it
    signed: true, // signed with COOKIE_SECRET → can't be forged
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true", // only when HTTPS terminates in front (see .env.example)
    maxAge: ONE_YEAR_MS, // ~1 year on the device (no repeated logins)
};

// Válido só para uma palavra-passe NOVA (setup / novo PIN no change) — nunca para
// a palavra-passe ATUAL num change, que tem de continuar aceite mesmo que tenha
// sido definida sob um MIN_DIGITS mais baixo no passado (não há migração de PINs
// já existentes; só o próximo que for definido fica sujeito ao novo mínimo).
const novaPasswordValida = (p) =>
    typeof p === "string" && p.length >= MIN_DIGITS && p.length <= MAX_DIGITS;

const authController = {
    // GET /auth/staff/status — tells the frontend what to show:
    // first-time setup, login, or already authenticated.
    status: async (req, res) => {
        const record = await StaffAuth.findOne();
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME];
        const autenticado = !!(await validarSessao(token));
        res.json({ configurado: !!record, autenticado });
    },

    // Códigos do MariaDB para "duas transações colidiram, tenta outra vez" — não
    // são erros reais, são o mecanismo normal de deteção de corrida do próprio
    // motor (ver DEVELOPMENT_LOG.md 2026-07-23).
    _isRaceError: (err) =>
        err?.original?.code === "ER_LOCK_DEADLOCK" || err?.original?.code === "ER_LOCK_WAIT_TIMEOUT",

    // POST /auth/staff/setup { password } — first-time only. StaffAuth guarda uma
    // única linha por convenção (sem constraint na BD a impor isso), e este
    // endpoint não exige autenticação (é o próprio arranque). Sem mais nada, dois
    // pedidos verdadeiramente simultâneos passavam ambos o "já existe?" antes de
    // qualquer um criar a linha — a transação SERIALIZABLE fecha essa corrida: o
    // segundo `create()` colide com o primeiro (deadlock do MariaDB, confirmado em
    // teste) em vez de as duas passarem. Repete a transação (não só a leitura) até
    // 3 vezes: a que perde vê o erro antes da vencedora fazer commit, por isso uma
    // nova transação — não um `findOne()` isolado a seguir ao catch — é o que
    // garante que a leitura seguinte já vê a linha da vencedora.
    setup: async (req, res) => {
        const { password } = req.body;
        if (!novaPasswordValida(String(password ?? ""))) {
            return res.status(400).json({ mensagem: PIN_RANGE_MSG });
        }

        let jaConfigurado;
        for (let tentativa = 1; ; tentativa++) {
            try {
                jaConfigurado = await sequelize.transaction(
                    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
                    async (t) => {
                        if (await StaffAuth.findOne({ transaction: t })) return true;
                        const passwordHash = await bcrypt.hash(String(password), BCRYPT_COST);
                        await StaffAuth.create({ passwordHash }, { transaction: t });
                        return false;
                    }
                );
                break;
            } catch (err) {
                if (tentativa >= 3 || !authController._isRaceError(err)) throw err;
                await new Promise((r) => setTimeout(r, 20 * tentativa)); // pequeno backoff
            }
        }

        if (jaConfigurado) {
            return res.status(409).json({ mensagem: "Já existe uma palavra-passe definida" });
        }
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
    // authenticated session (cookie) AND knowing the current password. A atual não
    // passa por `novaPasswordValida` — pode ter sido definida sob regras antigas.
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
        if (!novaPasswordValida(String(newPassword ?? ""))) {
            return res.status(400).json({ mensagem: PIN_RANGE_MSG });
        }
        record.passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_COST);
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
