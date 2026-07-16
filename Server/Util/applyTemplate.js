const { TabelaLayout } = require("../models");

// Copies a template's per-device configs onto a utente's layouts, replacing
// any existing ones. Shared by utente creation (template picked at creation)
// and POST /tabelas-padrao/:id/aplicar.
async function applyTemplateToUtente(template, utenteId) {
    for (const [dispositivo, config] of Object.entries(template.configs || {})) {
        if (!config) continue;
        const [row, created] = await TabelaLayout.findOrCreate({
            where: { utenteId, dispositivo },
            defaults: { config },
        });
        if (!created) await row.update({ config });
    }
}

module.exports = { applyTemplateToUtente };
