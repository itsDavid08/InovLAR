const crypto = require("crypto");
const { UtenteSession } = require("../models");

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");

// Cria uma sessão para um utente; devolve o token em claro (vai para o cookie).
async function criarSessaoUtente(utenteId, dias = 30) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    await UtenteSession.create({ tokenHash: hashToken(token), utenteId, expiraEm });
    return token;
}

// Devolve a sessão (com utenteId) se o token for válido e não expirado; senão null.
// Limpeza preguiçosa: apaga a linha se estiver expirada.
async function validarSessaoUtente(token) {
    if (!token) return null;
    const sessao = await UtenteSession.findOne({ where: { tokenHash: hashToken(token) } });
    if (!sessao) return null;
    if (sessao.expiraEm.getTime() < Date.now()) { await sessao.destroy(); return null; }
    return sessao;
}

// Revoga uma sessão específica (logout do tabuleiro).
async function revogarSessaoUtente(token) {
    if (token) await UtenteSession.destroy({ where: { tokenHash: hashToken(token) } });
}

// Revoga todas as sessões de um utente (rotação do accessToken, eliminação).
async function revogarSessoesDoUtente(utenteId) {
    await UtenteSession.destroy({ where: { utenteId } });
}

module.exports = {
    criarSessaoUtente,
    validarSessaoUtente,
    revogarSessaoUtente,
    revogarSessoesDoUtente,
};
