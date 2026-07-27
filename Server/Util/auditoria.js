const { AuditLog } = require("../models");

// Regista uma mutação feita por staff (item 4 do IMPROVEMENTS_CHECKLIST.md — "não se
// sabe quem resolveu um pedido ou alterou um perfil"). `action` é "recurso.verbo"
// (ex.: "utente.update"); `detalhes` é um objeto livre com o que for útil para
// reconstruir o que aconteceu (ids, campos alterados).
//
// NUNCA rejeita: uma falha a escrever o log (BD em baixo, etc.) não pode transformar
// uma mutação bem sucedida numa resposta 500 ao staff — o Express 5 encaminha
// promises rejeitadas para o errorHandler automaticamente, e isto é chamado ANTES
// do res.json() nos controllers. Por isso o erro fica só no console, nunca propaga.
//
// staffSessionId vem de req.staffSessionId (posto pelo requireStaff — identifica a
// SESSÃO/dispositivo, não uma pessoa: o PIN é partilhado, sem contas nominais).
const registarAuditoria = async (req, action, detalhes = null) => {
    try {
        await AuditLog.create({
            action,
            staffSessionId: req.staffSessionId ?? null,
            ip: req.ip ?? null,
            detalhes,
        });
    } catch (err) {
        console.error(`[auditoria] falha ao registar "${action}":`, err);
    }
};

module.exports = { registarAuditoria };
