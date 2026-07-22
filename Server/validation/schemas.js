const { z } = require("zod");
const { PEDIDO_STATES } = require("../config/constants");

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

module.exports = { boardSessionSchema, createPedidoSchema, updatePedidoSchema };
