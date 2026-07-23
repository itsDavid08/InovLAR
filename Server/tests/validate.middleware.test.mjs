import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { validate } from "../middleware/validate.js";
import { createPedidoSchema } from "../validation/schemas.js";

// O middleware `validate(schema)` corre ANTES do controller: 400 em input inválido,
// e substitui req.body pelo resultado parseado (campos fora do schema descartados).
// Testado end-to-end por HTTP com um mini-app, sem BD.

const app = express();
app.use(express.json());
app.post("/t", validate(createPedidoSchema), (req, res) => res.json(req.body));

describe("validate middleware", () => {
    it("400 genérico em corpo inválido (nunca o erro interno do zod)", async () => {
        const res = await request(app).post("/t").send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ mensagem: "Dados inválidos" });
    });

    it("200 em corpo válido, com os campos não declarados descartados", async () => {
        const res = await request(app)
            .post("/t")
            .send({ botaoId: 5, emergencia: true, utenteId: 999, hack: "x" });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ botaoId: 5, emergencia: true }); // utenteId/hack fora
    });

    it("400 quando botaoId não é positivo", async () => {
        const res = await request(app).post("/t").send({ botaoId: -1 });
        expect(res.status).toBe(400);
    });
});
