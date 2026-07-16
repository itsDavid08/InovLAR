const { Botao } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");

// Whitelist: only these fields ever reach the model (no mass assignment).
const pickBotaoFields = (body) => {
    const { nome, mensagem, imagem, categoria } = body;
    const fields = { nome, mensagem, imagem, categoria };
    Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
    return fields;
};

const botaoController = {
    // GET /botoes — the shared button catalog (open: the board needs it).
    getAllBotoes: async (req, res) => {
        const botoes = await Botao.findAll();
        res.json(botoes);
    },

    // POST /botoes
    createBotao: async (req, res) => {
        const botao = await Botao.create(pickBotaoFields(req.body));
        notificarAlteracaoBD();
        res.status(201).json(botao);
    },

    // PUT /botoes/:id
    updateBotao: async (req, res) => {
        const botao = await Botao.findByPk(req.params.id);
        if (!botao) return res.status(404).json({ mensagem: "Botão não encontrado" });

        await botao.update(pickBotaoFields(req.body));
        notificarAlteracaoBD();
        res.json(botao);
    },

    // DELETE /botoes/:id
    deleteBotao: async (req, res) => {
        const deleted = await Botao.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ mensagem: "Botão não encontrado" });
        notificarAlteracaoBD();
        res.json({ mensagem: "Botão eliminado com sucesso" });
    },
};

module.exports = botaoController;
