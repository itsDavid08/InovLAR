const crypto = require("crypto");
const { Utente, Pedido, Botao, TabelaPadrao } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");
const { applyTemplateToUtente } = require("../Util/applyTemplate");
const { revogarSessoesDoUtente } = require("../Util/utenteSessions");
const { PEDIDO_STATES } = require("../config/constants");

// Whitelist: only these fields ever reach the model (no mass assignment).
const pickUtenteFields = (body) => {
    const { nome, quarto, imagem, corAvatar } = body;
    const fields = { nome, quarto, imagem, corAvatar };
    Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
    return fields;
};

const utenteController = {
    // GET /utentes — full roster (staff only, RGPD). unscoped(): inclui o accessToken
    // para o StaffHome construir a URL do tabuleiro (/board/<accessToken>).
    getAllUtentes: async (req, res) => {
        const utentes = await Utente.unscoped().findAll();
        res.json(utentes);
    },

    // GET /utentes/:id — one utente with their pending pedidos (the board's own data).
    getUtenteById: async (req, res) => {
        const utenteId = parseInt(req.params.id, 10);
        const utente = await Utente.findByPk(utenteId, {
            include: [{
                model: Pedido,
                as: "pedidos",
                where: { utenteId, estado: PEDIDO_STATES.PENDING },
                required: false,
                include: [{ model: Botao, as: "botao", required: false }],
            }],
        });
        if (!utente) return res.status(404).json({ mensagem: "Utente não encontrado" });
        res.json(utente);
    },

    // POST /utentes/create — optional templateId applies a table right at creation.
    createUtente: async (req, res) => {
        const utente = await Utente.create(pickUtenteFields(req.body));
        if (req.body.templateId) {
            const template = await TabelaPadrao.findByPk(req.body.templateId);
            if (template) await applyTemplateToUtente(template, utente.id);
        }
        notificarAlteracaoBD();
        res.status(201).json(utente);
    },

    // PUT /utentes/:id
    updateUtente: async (req, res) => {
        const utente = await Utente.findByPk(req.params.id);
        if (!utente) return res.status(404).json({ mensagem: "Utente não encontrado" });

        await utente.update(pickUtenteFields(req.body));
        notificarAlteracaoBD();
        res.json(utente);
    },

    // POST /utentes/:id/rotate-token — gera um novo accessToken (revoga o URL antigo)
    // e corta todas as sessões de tabuleiro desse utente. Devolve o novo token para o
    // staff copiar o URL novo.
    rotateToken: async (req, res) => {
        const utente = await Utente.unscoped().findByPk(req.params.id);
        if (!utente) return res.status(404).json({ mensagem: "Utente não encontrado" });

        utente.accessToken = crypto.randomBytes(32).toString("hex");
        await utente.save();
        await revogarSessoesDoUtente(utente.id);
        notificarAlteracaoBD();
        res.json({ accessToken: utente.accessToken });
    },

    // DELETE /utentes/:id
    deleteUtente: async (req, res) => {
        const deleted = await Utente.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ mensagem: "Utente não encontrado" });
        notificarAlteracaoBD();
        res.json({ mensagem: "Utente eliminado" });
    },

    // POST /utentes/:utenteId/botoes/:botaoId
    associateBotao: async (req, res) => {
        const utente = await Utente.findByPk(req.params.utenteId);
        const botao = await Botao.findByPk(req.params.botaoId);
        if (!utente || !botao) {
            return res.status(404).json({ mensagem: "Utente ou Botão não encontrado" });
        }
        await utente.addBotoes(botao);
        notificarAlteracaoBD();
        res.json({ mensagem: "Botão associado ao utente com sucesso" });
    },

    // DELETE /utentes/:utenteId/botoes/:botaoId
    dissociateBotao: async (req, res) => {
        const utente = await Utente.findByPk(req.params.utenteId);
        const botao = await Botao.findByPk(req.params.botaoId);
        if (!utente || !botao) {
            return res.status(404).json({ mensagem: "Utente ou Botão não encontrado" });
        }
        await utente.removeBotoes(botao);
        notificarAlteracaoBD();
        res.json({ mensagem: "Botão desassociado do utente com sucesso" });
    },
};

module.exports = utenteController;
