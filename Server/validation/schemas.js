const { z } = require("zod");
const { PEDIDO_STATES, DEVICES } = require("../config/constants");

// accessToken = crypto.randomBytes(32).toString("hex") (models/Utente.js) — sempre
// 64 chars hexadecimais. Validar a forma aqui evita queries com payloads absurdos
// a chegar ao Utente.findOne({ where: { accessToken } }).
const boardSessionSchema = z.object({
    accessToken: z
        .string({ required_error: "accessToken em falta" })
        .length(64, "accessToken inválido")
        .regex(/^[0-9a-f]+$/, "accessToken inválido"),
});

// utenteId nunca vem daqui (é forçado a partir da sessão no controller) — só
// botaoId/emergencia são input do cliente.
const createPedidoSchema = z.object({
    botaoId: z.number().int().positive(),
    emergencia: z.boolean().optional(),
});

const updatePedidoSchema = z.object({
    estado: z.enum(Object.values(PEDIDO_STATES)),
});

// STRING no MariaDB = VARCHAR(255) (ver models/Utente.js e models/Botao.js) — o
// max(255) aqui faz o corte acontecer como um 400 previsível, não como um
// SequelizeDatabaseError vindo do driver (500 genérico no errorHandler).
const nomeCurto = z.string().trim().min(1).max(255);
// EditUtente.jsx/NewUtente.jsx mandam "" (nunca undefined) quando ainda não há
// cor escolhida — "" tem de ser uma cor válida aqui, não só null/omitido.
const corHex = z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")]);

// imagem: caminho de upload, o sentinela ICONE_PESSOA ("icone", ver
// Client/src/Components/utentes/UtenteAvatar.jsx) ou null — por isso fica livre,
// só limitado em tamanho.
const createUtenteSchema = z.object({
    nome: nomeCurto,
    quarto: nomeCurto,
    imagem: z.string().max(255).nullable().optional(),
    corAvatar: corHex.nullable().optional(),
    templateId: z.number().int().positive().optional(),
});

const updateUtenteSchema = z.object({
    nome: nomeCurto.optional(),
    quarto: nomeCurto.optional(),
    imagem: z.string().max(255).nullable().optional(),
    corAvatar: corHex.nullable().optional(),
});

const createBotaoSchema = z.object({
    nome: nomeCurto,
    mensagem: nomeCurto,
    categoria: nomeCurto,
    imagem: z.string().max(255).nullable().optional(),
});

const updateBotaoSchema = createBotaoSchema.partial();

// Forma de config.js (Client/src/Components/tabela/constants.js:defaultConfig) —
// validada estruturalmente (tipos dos campos conhecidos), mas .passthrough() para
// não travar em chaves futuras: o formato é deliberadamente retrocompatível
// (spans/coresCategoria ausentes = comportamento por omissão, ver CLAUDE.md).
const tabelaConfigSchema = z
    .object({
        cols: z.number().int().positive(),
        size: z.enum(["P", "M", "G"]).optional(),
        cells: z.array(z.number().int().positive().nullable()),
        spans: z
            .record(z.string(), z.object({ w: z.number().int().positive(), h: z.number().int().positive() }))
            .optional(),
        coresCategoria: z.record(z.string(), z.string()).optional(),
    })
    .passthrough();

const saveTabelaSchema = z.object({
    config: tabelaConfigSchema,
});

const tabelaPadraoConfigsSchema = z.object(
    Object.fromEntries(DEVICES.map((d) => [d, tabelaConfigSchema.optional()])),
);

const createTabelaPadraoSchema = z.object({
    nome: nomeCurto,
    configs: tabelaPadraoConfigsSchema.optional(),
});

const updateTabelaPadraoSchema = z.object({
    nome: nomeCurto.optional(),
    configs: tabelaPadraoConfigsSchema.optional(),
});

const aplicarTemplateSchema = z.object({
    utenteId: z.number().int().positive(),
});

module.exports = {
    boardSessionSchema,
    createPedidoSchema,
    updatePedidoSchema,
    createUtenteSchema,
    updateUtenteSchema,
    createBotaoSchema,
    updateBotaoSchema,
    saveTabelaSchema,
    createTabelaPadraoSchema,
    updateTabelaPadraoSchema,
    aplicarTemplateSchema,
};
