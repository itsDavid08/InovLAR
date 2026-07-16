// Domain constants shared across the app. Values are Portuguese on purpose —
// they are API/DB boundary values (the pedidos state ENUM), not code.
export const PEDIDO_STATES = {
    PENDING: "pendente",
    COMPLETED: "concluido",
    CANCELLED: "cancelado",
};
