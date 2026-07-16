const { ValidationError, ForeignKeyConstraintError } = require("sequelize");
const multer = require("multer");

// Central error handler. Express 5 forwards rejected promises from async route
// handlers here automatically, so controllers don't need per-handler try/catch.
// Error responses always have the shape { mensagem } (the field the client
// displays) and never expose internal error details.
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error(`[${req.method} ${req.originalUrl}]`, err);

    if (err instanceof ValidationError) {
        return res.status(400).json({
            mensagem: "Dados inválidos",
            detalhes: err.errors.map((e) => e.message),
        });
    }
    if (err instanceof ForeignKeyConstraintError) {
        return res.status(400).json({ mensagem: "Referência inválida" });
    }
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ mensagem: "Erro no upload do ficheiro" });
    }
    // Controlled errors can set err.status (+ a safe user-facing message).
    if (err.status) {
        return res.status(err.status).json({ mensagem: err.message });
    }
    res.status(500).json({ mensagem: "Erro interno do servidor" });
};

module.exports = { errorHandler };
