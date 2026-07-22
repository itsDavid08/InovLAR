// Middleware genérico: valida req.body contra um zod schema ANTES do controller.
// Em sucesso, substitui req.body pelo resultado parseado (campos não declarados no
// schema são descartados — reforça o whitelisting já feito nos controllers, não o
// duplica). Em falha, 400 com mensagem genérica (nunca o erro interno do zod).
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ mensagem: "Dados inválidos" });
    }
    req.body = result.data;
    next();
};

module.exports = { validate };
