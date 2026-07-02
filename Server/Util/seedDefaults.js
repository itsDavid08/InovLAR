const { Botao, TabelaPadrao, TabelaLayout, Utente } = require("../models");

// colunas por dispositivo (espelha o colsDefault do cliente)
const DISPOSITIVOS = { smartphone: 4, tablet: 5, pc: 6 };
// ordem das secções do tabuleiro antigo (SOS primeiro, no topo)
const ORDEM = ["SOS", "Sinto-me", "Necessidades", "Tecnologias", "Chamar"];

function construirConfig(botoes, cols) {
    const cells = [];
    const fecharLinha = () => { while (cells.length % cols !== 0) cells.push(null); };
    for (const cat of ORDEM) {
        const doCat = botoes.filter((b) => b.categoria === cat);
        if (!doCat.length) continue;
        for (const b of doCat) cells.push(b.id);
        fecharLinha(); // cada secção começa numa nova linha (sobram brancos, é aceitável)
    }
    const previstas = new Set(ORDEM);
    for (const b of botoes.filter((b) => !previstas.has(b.categoria))) cells.push(b.id);
    return { cols, size: "M", cells };
}

async function garantirTemplatePadrao() {
    if ((await TabelaPadrao.count()) > 0) return;             // já existe algum template
    const botoes = await Botao.findAll({ order: [["id", "ASC"]] });
    const configs = {};
    for (const [disp, cols] of Object.entries(DISPOSITIVOS)) configs[disp] = construirConfig(botoes, cols);
    await TabelaPadrao.create({ nome: "Predefinida", configs });
}

async function backfillTabelas() {
    const template = await TabelaPadrao.findOne({ order: [["id", "ASC"]] });
    if (!template) return;
    const utentes = await Utente.findAll();
    for (const u of utentes) {
        if ((await TabelaLayout.count({ where: { utenteId: u.id } })) > 0) continue; // já tem tabela
        for (const [disp, config] of Object.entries(template.configs || {}))
            await TabelaLayout.findOrCreate({ where: { utenteId: u.id, dispositivo: disp }, defaults: { config } });
    }
}

async function seedDefaults() {
    await garantirTemplatePadrao();
    await backfillTabelas();
}

module.exports = { seedDefaults };
