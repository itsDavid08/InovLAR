// Domain constants shared across controllers. Values are Portuguese on purpose —
// they are API/DB boundary values (enum in the pedidos table, REST params), not code.

// Pedido lifecycle states (ENUM in models/Pedido.js).
const PEDIDO_STATES = {
    PENDING: "pendente",
    COMPLETED: "concluido",
    CANCELLED: "cancelado",
};

// Devices a table layout can target (':dispositivo' route param whitelist).
const DEVICES = ["smartphone", "tablet", "pc"];

module.exports = { PEDIDO_STATES, DEVICES };
