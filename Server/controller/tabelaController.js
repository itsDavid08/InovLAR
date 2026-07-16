const { TabelaLayout } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");
const { DEVICES } = require("../config/constants");

const tabelaController = {
    // GET /utentes/:id/tabela/:dispositivo — open (the board fetches its own layout).
    getTabela: async (req, res) => {
        const { id, dispositivo } = req.params;
        if (!DEVICES.includes(dispositivo)) {
            return res.status(400).json({ mensagem: "Dispositivo inválido" });
        }
        const row = await TabelaLayout.findOne({ where: { utenteId: id, dispositivo } });
        res.json(row ? row.config : null); // null = no layout saved yet
    },

    // GET /tabelas — every saved layout (staff only).
    listTabelas: async (req, res) => {
        const rows = await TabelaLayout.findAll({
            attributes: ["utenteId", "dispositivo", "config"],
        });
        res.json(rows);
    },

    // PUT /utentes/:id/tabela/:dispositivo — staff only.
    saveTabela: async (req, res) => {
        const { id, dispositivo } = req.params;
        if (!DEVICES.includes(dispositivo)) {
            return res.status(400).json({ mensagem: "Dispositivo inválido" });
        }
        const config = req.body?.config ?? {};
        const [row, created] = await TabelaLayout.findOrCreate({
            where: { utenteId: id, dispositivo },
            defaults: { config },
        });
        if (!created) await row.update({ config });
        notificarAlteracaoBD();
        res.json(row.config);
    },
};

module.exports = tabelaController;
