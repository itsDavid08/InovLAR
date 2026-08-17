const { Op } = require("sequelize");
const { Pedido, Botao, Utente } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");
const { registarAuditoria } = require("../Util/auditoria");
const { PEDIDO_STATES } = require("../config/constants");
const { historicoPedidosQuerySchema } = require("../validation/schemas");

// Every pedido read joins its botão and utente — the clients render both.
const PEDIDO_INCLUDES = [
    { model: Botao, as: "botao" },
    { model: Utente, as: "utente" },
];

// Fronteiras do dia em hora LOCAL do servidor (o Pi e o lar estão no mesmo fuso).
// `new Date("2026-08-14")` seria lido como UTC e no horário de verão português
// deslocava o intervalo uma hora — daí construir a partir dos componentes.
const inicioDoDia = (iso) => {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d, 0, 0, 0, 0);
};
const fimDoDia = (iso) => {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d, 23, 59, 59, 999);
};

// ORDER BY por chave de ordenação do histórico. O desempate é sempre a hora
// (mais recente primeiro), para a paginação ser estável quando há empates —
// sem ele, dois pedidos com o mesmo estado podiam trocar de página entre
// pedidos ao servidor. Ordenar por utente/botão é ordenar por uma coluna da
// tabela incluída, daí a forma [{ model, as }, coluna, direção].
const ORDENACOES = {
    hora: (dir) => [["hora", dir]],
    estado: (dir) => [["estado", dir], ["hora", "DESC"]],
    emergencia: (dir) => [["emergencia", dir], ["hora", "DESC"]],
    utente: (dir) => [[{ model: Utente, as: "utente" }, "nome", dir], ["hora", "DESC"]],
    botao: (dir) => [[{ model: Botao, as: "botao" }, "nome", dir], ["hora", "DESC"]],
};

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

    // GET /pedidos/historico — registo completo, filtrável e paginado (requireStaff).
    // Distingue-se do GET /pedidos por não ser um "traz tudo": aqui o filtro, a
    // ordenação e o corte são feitos em SQL, porque o histórico só cresce e a
    // página do staff nunca mostra mais do que uma página de cada vez.
    getHistorico: async (req, res) => {
        // Query strings vazias ("?estado=") chegam como "" — descartadas antes do
        // parse, para um filtro limpo não ser um 400.
        const recebido = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== ""));
        const parsed = historicoPedidosQuerySchema.safeParse(recebido);
        if (!parsed.success) return res.status(400).json({ mensagem: "Filtros inválidos" });
        const { utenteId, botaoId, categoria, estado, emergencia, q, de, ate, ordenar, direcao, limite, offset } = parsed.data;

        const where = {};
        if (utenteId) where.utenteId = utenteId;
        if (botaoId) where.botaoId = botaoId;
        if (estado) where.estado = estado;
        if (emergencia) where.emergencia = emergencia === "true";
        if (de || ate) {
            where.hora = {};
            if (de) where.hora[Op.gte] = inicioDoDia(de);
            if (ate) where.hora[Op.lte] = fimDoDia(ate);
        }

        // Filtros que vivem no botão (categoria e texto livre) obrigam o join a
        // ser restritivo: `required: true` passa o LEFT JOIN a INNER JOIN, senão
        // o where do include não corta linhas nenhumas.
        const filtroBotao = {};
        if (categoria) filtroBotao.categoria = categoria;
        if (q) filtroBotao[Op.or] = [{ nome: { [Op.like]: `%${q}%` } }, { mensagem: { [Op.like]: `%${q}%` } }];
        const filtraPeloBotao = !!(categoria || q);

        const include = [
            { model: Botao, as: "botao", ...(filtraPeloBotao ? { where: filtroBotao, required: true } : {}) },
            { model: Utente, as: "utente" },
        ];

        const { rows, count } = await Pedido.findAndCountAll({
            where,
            include,
            order: ORDENACOES[ordenar](direcao.toUpperCase()),
            limit: limite,
            offset,
        });

        // Resumo do conjunto FILTRADO inteiro (não só da página visível) — é o que
        // o cabeçalho da página mostra. Um único COUNT agrupado por estado e
        // emergência dá os dois totais de uma vez.
        const agrupado = await Pedido.count({ where, include, group: ["Pedido.estado", "Pedido.emergencia"] });
        const resumo = Object.fromEntries(Object.values(PEDIDO_STATES).map((e) => [e, 0]));
        resumo.emergencias = 0;
        for (const linha of agrupado) {
            const n = Number(linha.count);
            resumo[linha.estado] = (resumo[linha.estado] || 0) + n;
            if (linha.emergencia) resumo.emergencias += n;
        }

        res.json({ total: count, limite, offset, resumo, pedidos: rows });
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
        await registarAuditoria(req, "pedido.update", { pedidoId: pedido.id, utenteId: pedido.utenteId, estado });
        res.json(pedido);
    },

    // DELETE /pedidos/:id
    deletePedido: async (req, res) => {
        const pedidoId = Number(req.params.id);
        const deleted = await Pedido.destroy({ where: { id: pedidoId } });
        if (!deleted) return res.status(404).json({ mensagem: "Pedido não encontrado" });
        notificarAlteracaoBD();
        await registarAuditoria(req, "pedido.delete", { pedidoId });
        res.json({ mensagem: "Pedido eliminado com sucesso" });
    },
};

module.exports = pedidoController;
