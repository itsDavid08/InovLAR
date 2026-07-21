const { Pedido, Botao, Utente } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");
const { PEDIDO_STATES } = require("../config/constants");

// Every pedido read joins its botão and utente — the clients render both.
const PEDIDO_INCLUDES = [
    { model: Botao, as: "botao" },
    { model: Utente, as: "utente" },
];

// Errors thrown here (invalid data, DB failures) are handled by the central
// errorHandler middleware — Express 5 forwards rejected promises to it.
const pedidoController = {
    // GET /pedidos/ativos/hora — pending, newest first.
    getActivePedidosByTime: async (req, res) => {
        const pedidos = await Pedido.findAll({
            where: { estado: PEDIDO_STATES.PENDING },
            order: [["hora", "DESC"]],
            include: PEDIDO_INCLUDES,
        });
        res.json(pedidos);
    },

    // GET /pedidos/ativos/emergencia — pending, emergencies first, then oldest first.
    getActivePedidosByEmergency: async (req, res) => {
        const pedidos = await Pedido.findAll({
            where: { estado: PEDIDO_STATES.PENDING },
            order: [
                ["emergencia", "DESC"],
                ["hora", "ASC"],
            ],
            include: PEDIDO_INCLUDES,
        });
        res.json(pedidos);
    },

    // GET /pedidos
    getAllPedidos: async (req, res) => {
        const pedidos = await Pedido.findAll({ include: PEDIDO_INCLUDES });
        res.json(pedidos);
    },

    // GET /pedidos/:id
    getPedidoById: async (req, res) => {
        const pedido = await Pedido.findByPk(req.params.id);
        if (!pedido) return res.status(404).json({ mensagem: "Pedido não encontrado" });
        res.json(pedido);
    },

    // GET /pedidos/utente/:utenteId — the board's own pending pedidos (open route).
    getActivePedidosByUtenteId: async (req, res) => {
        const pedidos = await Pedido.findAll({
            where: { utenteId: req.params.utenteId, estado: PEDIDO_STATES.PENDING },
            include: PEDIDO_INCLUDES,
            order: [
                ["emergencia", "DESC"],
                ["hora", "ASC"],
            ],
        });
        res.json(pedidos);
    },

    // PUT /pedidos/:id — staff monitor resolves any pending pedido (requireStaff).
    // The board updates its own pedidos via /board/pedidos/:id. Only the state
    // can change (whitelist + validation).
    updatePedido: async (req, res) => {
        const { estado } = req.body;
        if (!Object.values(PEDIDO_STATES).includes(estado)) {
            return res.status(400).json({ mensagem: "Estado inválido" });
        }
        const pedido = await Pedido.findByPk(req.params.id);
        if (!pedido) return res.status(404).json({ mensagem: "Pedido não encontrado" });

        await pedido.update({ estado });
        notificarAlteracaoBD();
        res.json(pedido);
    },

    // DELETE /pedidos/:id
    deletePedido: async (req, res) => {
        const deleted = await Pedido.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ mensagem: "Pedido não encontrado" });
        notificarAlteracaoBD();
        res.json({ mensagem: "Pedido eliminado com sucesso" });
    },
};

module.exports = pedidoController;
