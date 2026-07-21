const { Utente, Pedido, Botao, TabelaLayout } = require("../models");
const { criarSessaoUtente, revogarSessaoUtente } = require("../Util/utenteSessions");
const { COOKIE_NAME_UTENTE } = require("../middleware/auth");
const { notificarAlteracaoBD } = require("../Util/socketIO");
const { PEDIDO_STATES, DEVICES } = require("../config/constants");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Todas as rotas /board/* derivam o utente de req.utenteId (sessão verificada no
// servidor) — o id nunca vem da URL. É isto que torna a posse dos pedidos inforjável.
const PEDIDO_INCLUDES = [
    { model: Botao, as: "botao" },
    { model: Utente, as: "utente" },
];

// Cookie da sessão do tabuleiro. Mesmo formato do cookie de staff (httpOnly,
// assinado, secure opt-in via COOKIE_SECURE), mas com nome próprio.
const cookieOptions = {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: THIRTY_DAYS_MS,
};

const boardController = {
    // POST /board/session { accessToken } — troca o accessToken (segredo da URL)
    // por uma sessão de tabuleiro (cookie). É o "bootstrap" do tablet.
    createSession: async (req, res) => {
        const { accessToken } = req.body;
        if (!accessToken) return res.status(400).json({ mensagem: "accessToken em falta" });

        const utente = await Utente.findOne({ where: { accessToken } });
        if (!utente) return res.status(404).json({ mensagem: "Utente não encontrado" });

        const token = await criarSessaoUtente(utente.id);
        res.cookie(COOKIE_NAME_UTENTE, token, cookieOptions);
        res.json({ id: utente.id });
    },

    // POST /board/logout — revoga a sessão do tabuleiro (limpa o cookie).
    logout: async (req, res) => {
        const token = req.signedCookies && req.signedCookies[COOKIE_NAME_UTENTE];
        await revogarSessaoUtente(token);
        res.clearCookie(COOKIE_NAME_UTENTE);
        res.json({ ok: true });
    },

    // GET /board/utente — o utente da sessão, com os seus pedidos pendentes.
    getUtente: async (req, res) => {
        const utente = await Utente.findByPk(req.utenteId, {
            include: [{
                model: Pedido,
                as: "pedidos",
                where: { estado: PEDIDO_STATES.PENDING },
                required: false,
                include: [{ model: Botao, as: "botao", required: false }],
            }],
        });
        if (!utente) return res.status(404).json({ mensagem: "Utente não encontrado" });
        res.json(utente);
    },

    // GET /board/pedidos — os pedidos pendentes do utente da sessão.
    getPedidos: async (req, res) => {
        const pedidos = await Pedido.findAll({
            where: { utenteId: req.utenteId, estado: PEDIDO_STATES.PENDING },
            include: PEDIDO_INCLUDES,
            order: [["emergencia", "DESC"], ["hora", "ASC"]],
        });
        res.json(pedidos);
    },

    // GET /board/tabela/:dispositivo — o layout do utente da sessão para o dispositivo.
    getTabela: async (req, res) => {
        const { dispositivo } = req.params;
        if (!DEVICES.includes(dispositivo)) {
            return res.status(400).json({ mensagem: "Dispositivo inválido" });
        }
        const row = await TabelaLayout.findOne({
            where: { utenteId: req.utenteId, dispositivo },
        });
        res.json(row ? row.config : null); // null = sem layout guardado
    },

    // POST /board/pedidos — cria um pedido para o utente da sessão. O utenteId vem
    // sempre da sessão (nunca do corpo); só botaoId e emergencia são aceites.
    createPedido: async (req, res) => {
        const { botaoId, emergencia } = req.body;
        const utenteId = req.utenteId;

        // Double-tap guard: pedido pendente idêntico já existe → devolve-o.
        const existing = await Pedido.findOne({
            where: { utenteId, botaoId, estado: PEDIDO_STATES.PENDING },
        });
        if (existing) {
            notificarAlteracaoBD();
            return res.status(200).json(existing);
        }

        const created = await Pedido.create({ emergencia, utenteId, botaoId });
        const pedido = await Pedido.findByPk(created.id, { include: PEDIDO_INCLUDES });
        notificarAlteracaoBD();
        res.status(201).json(pedido);
    },

    // PUT /board/pedidos/:id — atualiza o estado de um pedido, mas só se pertencer
    // ao utente da sessão (senão 403). Só o estado muda (whitelist + validação).
    updatePedido: async (req, res) => {
        const { estado } = req.body;
        if (!Object.values(PEDIDO_STATES).includes(estado)) {
            return res.status(400).json({ mensagem: "Estado inválido" });
        }
        const pedido = await Pedido.findByPk(req.params.id);
        if (!pedido) return res.status(404).json({ mensagem: "Pedido não encontrado" });
        if (pedido.utenteId !== req.utenteId) {
            return res.status(403).json({ mensagem: "Pedido de outro utente" });
        }

        await pedido.update({ estado });
        notificarAlteracaoBD();
        res.json(pedido);
    },
};

module.exports = boardController;
