const crypto = require("crypto");
const { StaffSession } = require("../models");

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");

// Cria sessão nova; devolve o token em claro (vai para o cookie).
async function criarSessao(dias = 365) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    await StaffSession.create({ tokenHash: hashToken(token), expiraEm });
    return token;
}

// Devolve a sessão se o token for válido e não expirado; senão null.
// Limpeza preguiçosa: apaga a linha se estiver expirada.
async function validarSessao(token) {
    if (!token) return null;
    const sessao = await StaffSession.findOne({ where: { tokenHash: hashToken(token) } });
    if (!sessao) return null;
    if (sessao.expiraEm.getTime() < Date.now()) { await sessao.destroy(); return null; }
    return sessao;
}

// Revoga (apaga) a sessão de um token.
async function revogarSessao(token) {
    if (token) await StaffSession.destroy({ where: { tokenHash: hashToken(token) } });
}

module.exports = { criarSessao, validarSessao, revogarSessao };
