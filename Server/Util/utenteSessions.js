const crypto = require("crypto");
const { Op } = require("sequelize");
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

// Estende a validade de uma sessão (janela deslizante). O bootstrap chama isto ao
// reutilizar a sessão existente, para o tabuleiro nunca expirar enquanto for usado.
async function renovarSessaoUtente(sessao, dias = 30) {
    sessao.expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    await sessao.save();
}

// Apaga sessões já expiradas. A limpeza preguiçosa (em validarSessaoUtente) só
// apanha as que voltam a ser validadas; como o bootstrap reutiliza a sessão, as
// antigas não reaparecem — este varrimento (no arranque) trata delas.
async function purgarExpiradas() {
    await UtenteSession.destroy({ where: { expiraEm: { [Op.lt]: new Date() } } });
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
    renovarSessaoUtente,
    purgarExpiradas,
    revogarSessaoUtente,
    revogarSessoesDoUtente,
};
