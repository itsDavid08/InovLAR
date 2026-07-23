import { describe, it, expect } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { requireStaff, identifyUtente, requireUtente } from "../middleware/auth.js";

// Contrato de auth ao nível HTTP, sem BD: sem cookie, validarSessao* faz
// short-circuit a null (Util/sessions.js:18) — os caminhos fail-closed (401) não
// tocam na BD. O caminho positivo do requireUtente testa-se injetando req.utenteId
// (isola o guard sem depender da camada de sessões, cujos refs são desestruturados
// no import e não são fáceis de mockar com a interop CJS do Vitest).

const app = express();
app.use(cookieParser("test-secret"));
app.get("/staff", requireStaff, (req, res) => res.json({ ok: true }));
app.get("/board", identifyUtente, requireUtente, (req, res) => res.json({ utenteId: req.utenteId }));
app.get(
    "/board-guard",
    (req, _res, next) => { req.utenteId = 42; next(); },
    requireUtente,
    (req, res) => res.json({ utenteId: req.utenteId }),
);

describe("requireStaff", () => {
    it("401 sem sessão (fail-closed)", async () => {
        const res = await request(app).get("/staff");
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ mensagem: "Não autenticado" });
    });
});

describe("identifyUtente + requireUtente", () => {
    it("401 sem sessão de tabuleiro (id nunca vem da URL)", async () => {
        const res = await request(app).get("/board");
        expect(res.status).toBe(401);
    });

    it("segue quando há um utenteId na sessão", async () => {
        const res = await request(app).get("/board-guard");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ utenteId: 42 });
    });
});
