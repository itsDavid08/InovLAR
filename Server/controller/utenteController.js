const { Utente, Pedido, Botao, TabelaPadrao, TabelaLayout } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");

// Corrigir a sintaxe dos métodos do objeto: usar propriedades, não atribuições
const utenteController = {
    // Obter todos os utentes
    getUtentes: async (req, res) => {
        try {
            const utentes = await Utente.findAll();
            res.json(utentes);
        } catch (erro) {
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // Obter um utente por ID
    getUtenteById: async (req, res) => {
        try {
            const utenteId = parseInt(req.params.id, 10);
            const utente = await Utente.findByPk(utenteId,{
                include: [{
                    model: Pedido,
                    as: "pedidos",
                    where: { utenteId: utenteId, estado: "pendente" },
                    required: false,
                    include: [{
                        model: Botao,
                        as: "botao", // ajuste conforme o alias definido na associação
                        required: false
                    }]
                }]
            });
            if (!utente)
                return res
                    .status(404)
                    .json({ mensagem: "Utente não encontrado" });

            res.json(utente);
        } catch (erro) {
            console.error("Erro ao obter utente:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // Criar um novo utente (template opcional → aplica a tabela já na criação)
    createUtente: async (req, res) => {
        try {
            const { nome, quarto, imagem, corAvatar, templateId } = req.body;
            const utente = await Utente.create({ nome, quarto, imagem, corAvatar });
            if (templateId) {
                const template = await TabelaPadrao.findByPk(templateId);
                if (template) {
                    for (const [dispositivo, config] of Object.entries(template.configs || {}))
                        await TabelaLayout.findOrCreate({ where: { utenteId: utente.id, dispositivo }, defaults: { config } });
                }
            }
            notificarAlteracaoBD();
            res.status(201).json(utente);   // antes não devolvia nada (a request ficava pendurada)
        } catch (erro) {
            console.error("Erro ao criar utente:", erro);
            res.status(400).json({ mensagem: erro.message });
        }
    },

    // Atualizar um utente
    updateUtente: async (req, res) => {
        try {
            // Whitelist dos campos editáveis (evita mass assignment de req.body direto).
            const { nome, quarto, imagem, corAvatar } = req.body;
            const campos = { nome, quarto, imagem, corAvatar };
            // Só atualiza as chaves realmente enviadas (undefined = não mexer).
            Object.keys(campos).forEach((k) => campos[k] === undefined && delete campos[k]);
            const [updated] = await Utente.update(campos, {
                where: { id: req.params.id },
            });
            if (updated) {
                const utenteAtualizado = await Utente.findByPk(req.params.id);
                notificarAlteracaoBD();
                res.json(utenteAtualizado);
            } else {
                res.status(404).json({ mensagem: "Utente não encontrado" });
            }
        } catch (erro) {
            console.error("Erro ao atualizar utente:", erro);
            res.status(400).json({ mensagem: erro.message });
        }
    },

    // Eliminar um utente
    deleteUtente: async (req, res) => {
        try {
            const deleted = await Utente.destroy({
                where: { id: req.params.id },
            });
            if (deleted) {
                notificarAlteracaoBD();
                res.json({ mensagem: "Utente eliminado" });
            } else {
                res.status(404).json({ mensagem: "Utente não encontrado" });
            }
        } catch (erro) {
            console.error("Erro ao eliminar utente:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },
    // Asociar botão a utente
    associarBotao: async (req, res) => {
        try {
            const utente = await Utente.findByPk(req.params.utenteId);
            const botao = await Botao.findByPk(req.params.botaoId);
            if (!utente || !botao)
                return res
                    .status(404)
                    .json({ mensagem: "Utente ou Botão não encontrado" });

            await utente.addBotoes(botao);
            notificarAlteracaoBD();
            res.json({ mensagem: "Botão associado ao utente com sucesso" });
        } catch (erro) {
            console.error("Erro ao associar botão:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // Desasociar botão de utente
    desassociarBotao: async (req, res) => {
        try {
            const utente = await Utente.findByPk(req.params.utenteId);
            const botao = await Botao.findByPk(req.params.botaoId);
            if (!utente || !botao)
                return res
                    .status(404)
                    .json({ mensagem: "Utente ou Botão não encontrado" });
            await utente.removeBotoes(botao);
            notificarAlteracaoBD();
            res.json({ mensagem: "Botão desassociado do utente com sucesso" });
        } catch (erro) {
            console.error("Erro ao desassociar botão:", erro);
            res.status(500).json({ mensagem: erro.message });
        }
    },
};

module.exports = utenteController;
