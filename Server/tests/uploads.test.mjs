import { describe, it, expect, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { uploadBotaoImage, verifyImageSignature } from "../middleware/uploads.js";
import { errorHandler } from "../middleware/errorHandler.js";

// Cablagem real (uploadBotaoImage + verifyImageSignature + errorHandler — os mesmos
// objetos que route.js monta), contra um mini-app, sem auth/DB. Cobre exatamente o
// tipo de input malicioso/malformado por trás das CVEs que motivaram a subida do
// multer 1.x -> 2.x (2026-07-27, IMPROVEMENTS_CHECKLIST.md item 3): ficheiro
// disfarçado, ficheiro oversized. Escreve na pasta REAL public/imagesBotoes (é onde
// o multer está configurado para gravar) — por isso todos os nomes de ficheiro usam
// o prefixo `test-upload-` e são apagados no `afterAll`, nunca tocando nos ícones
// reais dos botões.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOTAO_IMAGES_DIR = path.join(__dirname, "../public/imagesBotoes");
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const app = express();
app.post("/upload", uploadBotaoImage.single("imagem"), verifyImageSignature, (req, res) => {
    res.status(201).json({ path: `/imagesBotoes/${req.file.filename}` });
});
app.use(errorHandler);

afterAll(() => {
    for (const f of fs.readdirSync(BOTAO_IMAGES_DIR)) {
        if (f.startsWith("test-upload-")) fs.unlinkSync(path.join(BOTAO_IMAGES_DIR, f));
    }
});

describe("upload de imagens de botão (multer real, sem auth/DB)", () => {
    it("aceita uma imagem válida", async () => {
        const res = await request(app)
            .post("/upload")
            .attach("imagem", Buffer.concat([PNG_SIG, Buffer.alloc(50, 1)]), {
                filename: "test-upload-valid.png",
                contentType: "image/png",
            });
        expect(res.status).toBe(201);
        expect(res.body.path).toBe("/imagesBotoes/test-upload-valid.png");
    });

    it("rejeita extensão/mimetype não permitidos (fileFilter)", async () => {
        const res = await request(app)
            .post("/upload")
            .attach("imagem", Buffer.from("não é imagem"), {
                filename: "test-upload-bad.txt",
                contentType: "text/plain",
            });
        expect(res.status).toBe(400);
        expect(res.body.mensagem).toMatch(/Apenas imagens/);
    });

    it("rejeita bytes falsos com extensão/mimetype válidos e apaga o ficheiro (magic bytes)", async () => {
        const filename = "test-upload-fake.png";
        const res = await request(app)
            .post("/upload")
            .attach("imagem", Buffer.from("isto finge ser um png mas não é"), {
                filename,
                contentType: "image/png",
            });
        expect(res.status).toBe(400);
        expect(res.body.mensagem).toMatch(/não é uma imagem válida/);
        // verifyImageSignature apaga o ficheiro gravado pelo multer antes de rejeitar.
        expect(fs.existsSync(path.join(BOTAO_IMAGES_DIR, filename))).toBe(false);
    });

    it("rejeita ficheiros acima do limite (MulterError -> 400 via errorHandler)", async () => {
        const big = Buffer.concat([PNG_SIG, Buffer.alloc(11 * 1024 * 1024, 2)]); // > 10MB
        const res = await request(app)
            .post("/upload")
            .attach("imagem", big, { filename: "test-upload-big.png", contentType: "image/png" });
        expect(res.status).toBe(400);
        expect(res.body.mensagem).toMatch(/Erro no upload/);
    }, 15000);
});
