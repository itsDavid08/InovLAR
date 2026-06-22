const { TabelaPadrao, TabelaLayout } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");

const DISPOSITIVOS = ["smartphone", "tablet", "pc"];

const tabelaPadraoController = {
    // GET /tabelas-padrao — leitura pública
    listar: async (req, res) => {
        try { res.json(await TabelaPadrao.findAll()); }
        catch (erro) { res.status(500).json({ mensagem: erro.message }); }
    },

    // POST /tabelas-padrao — só staff
    criar: async (req, res) => {
        try {
            const { nome, configs } = req.body || {};
            const linha = await TabelaPadrao.create({ nome, configs: configs ?? {} });
            res.status(201).json(linha);
        } catch (erro) { res.status(400).json({ mensagem: erro.message }); }
    },

    // PUT /tabelas-padrao/:id — só staff
    atualizar: async (req, res) => {
        try {
            const linha = await TabelaPadrao.findByPk(req.params.id);
            if (!linha) return res.status(404).json({ mensagem: "Template não encontrado" });
            const { nome, configs } = req.body || {};
            await linha.update({
                ...(nome !== undefined ? { nome } : {}),
                ...(configs !== undefined ? { configs } : {}),
            });
            res.json(linha);
        } catch (erro) { res.status(400).json({ mensagem: erro.message }); }
    },

    // DELETE /tabelas-padrao/:id — só staff
    eliminar: async (req, res) => {
        try {
            const n = await TabelaPadrao.destroy({ where: { id: req.params.id } });
            if (!n) return res.status(404).json({ mensagem: "Template não encontrado" });
            res.json({ eliminado: true });
        } catch (erro) { res.status(400).json({ mensagem: erro.message }); }
    },

    // POST /tabelas-padrao/:id/aplicar — só staff. Copia (substitui) para um utente.
    aplicar: async (req, res) => {
        try {
            const { utenteId } = req.body || {};
            if (!utenteId) return res.status(400).json({ mensagem: "utenteId em falta" });
            const template = await TabelaPadrao.findByPk(req.params.id);
            if (!template) return res.status(404).json({ mensagem: "Template não encontrado" });
            const configs = template.configs || {};
            for (const dispositivo of DISPOSITIVOS) {
                const config = configs[dispositivo];
                if (!config) continue;
                const [linha, criada] = await TabelaLayout.findOrCreate({
                    where: { utenteId, dispositivo }, defaults: { config },
                });
                if (!criada) await linha.update({ config });
            }
            notificarAlteracaoBD();
            res.json({ aplicado: true });
        } catch (erro) { res.status(400).json({ mensagem: erro.message }); }
    },
};

module.exports = tabelaPadraoController;
