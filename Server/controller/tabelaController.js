const { TabelaLayout } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");

const DISPOSITIVOS = ["smartphone", "tablet", "pc"];

const tabelaController = {
    // GET /utentes/:id/tabela/:dispositivo  — leitura pública (como os outros GET)
    getTabela: async (req, res) => {
        try {
            const { id, dispositivo } = req.params;
            if (!DISPOSITIVOS.includes(dispositivo))
                return res.status(400).json({ mensagem: "Dispositivo inválido" });
            const linha = await TabelaLayout.findOne({ where: { utenteId: id, dispositivo } });
            res.json(linha ? linha.config : null); // null = ainda sem layout definido
        } catch (erro) {
            res.status(500).json({ mensagem: erro.message });
        }
    },

    // PUT /utentes/:id/tabela/:dispositivo  — só staff
    saveTabela: async (req, res) => {
        try {
            const { id, dispositivo } = req.params;
            if (!DISPOSITIVOS.includes(dispositivo))
                return res.status(400).json({ mensagem: "Dispositivo inválido" });
            const config = req.body?.config ?? {};
            const [linha, criada] = await TabelaLayout.findOrCreate({
                where: { utenteId: id, dispositivo },
                defaults: { config },
            });
            if (!criada) await linha.update({ config });
            notificarAlteracaoBD();
            res.json(linha.config);
        } catch (erro) {
            console.error("Erro ao guardar tabela:", erro);
            res.status(400).json({ mensagem: erro.message });
        }
    },
};

module.exports = tabelaController;
