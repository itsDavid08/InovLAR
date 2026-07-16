const { TabelaPadrao } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");
const { applyTemplateToUtente } = require("../Util/applyTemplate");

const tabelaPadraoController = {
    // GET /tabelas-padrao — staff only.
    list: async (req, res) => {
        res.json(await TabelaPadrao.findAll());
    },

    // POST /tabelas-padrao
    create: async (req, res) => {
        const { nome, configs } = req.body || {};
        const row = await TabelaPadrao.create({ nome, configs: configs ?? {} });
        res.status(201).json(row);
    },

    // PUT /tabelas-padrao/:id
    update: async (req, res) => {
        const row = await TabelaPadrao.findByPk(req.params.id);
        if (!row) return res.status(404).json({ mensagem: "Template não encontrado" });
        const { nome, configs } = req.body || {};
        await row.update({
            ...(nome !== undefined ? { nome } : {}),
            ...(configs !== undefined ? { configs } : {}),
        });
        res.json(row);
    },

    // DELETE /tabelas-padrao/:id
    remove: async (req, res) => {
        const n = await TabelaPadrao.destroy({ where: { id: req.params.id } });
        if (!n) return res.status(404).json({ mensagem: "Template não encontrado" });
        res.json({ eliminado: true });
    },

    // POST /tabelas-padrao/:id/aplicar — copies (replaces) onto one utente.
    apply: async (req, res) => {
        const { utenteId } = req.body || {};
        if (!utenteId) return res.status(400).json({ mensagem: "utenteId em falta" });
        const template = await TabelaPadrao.findByPk(req.params.id);
        if (!template) return res.status(404).json({ mensagem: "Template não encontrado" });

        await applyTemplateToUtente(template, utenteId);
        notificarAlteracaoBD();
        res.json({ aplicado: true });
    },
};

module.exports = tabelaPadraoController;
