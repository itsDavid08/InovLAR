const { Pedido, Botao, Utente } = require('../models');
const { notificarAlteracaoBD } = require("../Util/socketIO");

const pedidoController = {
    // Buscar pedidos ativos ordenados por hora de criação (mais recentes primeiro)
    getPedidosAtivosPorHora: async (req, res) => {
        try {
            const pedidos = await Pedido.findAll({
                where: { estado: 'pendente' },
                order: [['hora', 'DESC']],
                include: [
                    { model: Botao, as: 'botao' },
                    { model: Utente, as: 'utente' }
                ]

            });
            res.json(pedidos);
        } catch (error) {
            res.status(500).json({ erro: 'Erro ao obter os pedidos ativos por hora' });
        }
    },

    // Buscar pedidos ativos ordenados por emergência e hora (emergências primeiro, depois mais recentes)
    getPedidosAtivosPorEmergencia: async (req, res) => {
        try {
            const pedidos = await Pedido.findAll({
                where: { estado: 'pendente' },
                order: [
                    ['emergencia', 'DESC'],
                    ['hora', 'ASC']
                ],
                include: [
                    { model: Botao, as: 'botao' },
                    { model: Utente, as: 'utente' }
                ]
            });
            res.json(pedidos);
        } catch (error) {
            res.status(500).json({ erro: 'Erro ao obter os pedidos ativos por emergência' });
        }
    },

    // Obter todos os pedidos
    getTodosPedidos: async (req, res) => {
        try {
            const pedidos = await Pedido.findAll({
                include: [
                { model: Botao, as: 'botao' },
                { model: Utente, as: 'utente' }
            ]
            });
            res.json(pedidos);
        } catch (error) {
            res.status(500).json({ erro: 'Erro ao obter os pedidos' });
        }
    },

    // Obter pedido por ID
    getPedidoPorId: async (req, res) => {
        try {
            const pedido = await Pedido.findByPk(req.params.id);
            if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
            res.json(pedido);
        } catch (error) {
            res.status(500).json({ erro: 'Erro ao obter o pedido' });
        }
    },

    // Obter pedidos por ID de utente
    getPedidosAtivosPorUtenteId: async (req, res) => {
        try {
            const pedidos = await Pedido.findAll({
                where: { utenteId: req.params.utenteId, estado: 'pendente' },
                include: [
                    { model: Botao, as: 'botao' },
                    { model: Utente, as: 'utente' }
                ],
                order: [
                    ['emergencia', 'DESC'],
                    ['hora', 'ASC']
                ]
            });
            res.json(pedidos);
        } catch (error) {
            res.status(500).json({ erro: 'Erro ao obter os pedidos do utente' });
        }
    },

    // Criar um novo pedido
    criarPedido: async (req, res) => {
        try {
            // Verifica se já existe um pedido pendente para o mesmo utente e botão
            const pedidoExistente = await Pedido.findOne({
                where: {
                    utenteId: req.body.utenteId,
                    botaoId: req.body.botaoId,
                    estado: 'pendente'
                }
            });

            if (pedidoExistente) {
                notificarAlteracaoBD();
                return res.status(200).json(pedidoExistente);
            }

            const pedidoCriado = await Pedido.create(req.body);
            const pedido = await Pedido.findByPk(pedidoCriado.id, {
                include: [
                    { model: Botao, as: 'botao' },
                    { model: Utente, as: 'utente' }
                ]
            });
            notificarAlteracaoBD();
            res.status(201).json(pedido);
        } catch (error) {
            res.status(400).json({ erro: 'Erro ao criar o pedido' });
        }
    },

    // Atualizar um pedido
    atualizarPedido: async (req, res) => {
        try {
            const updated = await Pedido.update(req.body, {
                where: { id: req.params.id }
            });
            if (updated) {
                const pedidoAtualizado = await Pedido.findByPk(req.params.id);
                notificarAlteracaoBD();
                res.json(pedidoAtualizado);
            } else {
                res.status(404).json({ erro: 'Pedido não encontrado' });
            }
        } catch (error) {
            console.error("Erro ao atualizar pedido:", error);
            res.status(400).json({ erro: 'Erro ao atualizar o pedido' });
        }
    },

    // Eliminar um pedido
    eliminarPedido: async (req, res) => {
        try {
            const deleted = await Pedido.destroy({
                where: { id: req.params.id }
            });
            if (deleted) {
                notificarAlteracaoBD();
                res.json({ mensagem: 'Pedido eliminado com sucesso' });
            } else {
                res.status(404).json({ erro: 'Pedido não encontrado' });
            }
        } catch (error) {
            res.status(500).json({ erro: 'Erro ao eliminar o pedido' });
        }
    }
};

module.exports = pedidoController;