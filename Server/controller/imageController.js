const fs = require("fs");
const path = require("path");
const { Botao, Utente } = require("../models");
const { notificarAlteracaoBD } = require("../Util/socketIO");
const { isPersonalUtentePhoto, BOTAO_IMAGES_DIR, UTENTE_IMAGES_DIR } = require("../middleware/uploads");

const imageController = {
    // GET /imagesBotoes — flat listing of the shared botão icon library.
    listBotaoImages: async (req, res) => {
        const files = await fs.promises.readdir(BOTAO_IMAGES_DIR, { withFileTypes: true });
        const images = files
            .filter((f) => f.isFile() && /\.(png|jpg|jpeg|gif)$/i.test(f.name))
            .map((f) => `/imagesBotoes/${f.name}`);
        res.json(images);
    },

    // POST /imagesBotoes/upload — multer (uploadBotaoImage) already stored the file.
    uploadBotaoImage: (req, res) => {
        if (!req.file) return res.status(400).json({ mensagem: "Nenhuma imagem enviada" });
        res.json({ path: `/imagesBotoes/${req.file.filename}` });
    },

    // DELETE /imagesBotoes { path } — removes the file and nullifies `imagem`
    // on botões that used it (deletion never destroys botões).
    deleteBotaoImage: async (req, res) => {
        const { path: imgPath } = req.body;
        if (!imgPath || !imgPath.startsWith("/imagesBotoes/") || imgPath.includes("..")) {
            return res.status(400).json({ mensagem: "Operação não permitida" });
        }
        const filename = imgPath.replace("/imagesBotoes/", "");
        if (filename.includes("/")) return res.status(400).json({ mensagem: "Operação não permitida" });

        try {
            await fs.promises.unlink(path.join(BOTAO_IMAGES_DIR, filename));
        } catch (err) {
            if (err.code === "ENOENT") return res.status(404).json({ mensagem: "Imagem não encontrada" });
            throw err;
        }
        const [affectedCount] = await Botao.update({ imagem: null }, { where: { imagem: imgPath } });
        if (affectedCount > 0) notificarAlteracaoBD();
        res.json({ eliminado: imgPath, botoesAfetados: affectedCount });
    },

    // POST /imagesUtentes/upload — stores the new personal photo and deletes the
    // previous one ('previousPath'), unless that one is a stock avatar.
    uploadUtentePhoto: async (req, res) => {
        if (!req.file) return res.status(400).json({ mensagem: "Nenhuma imagem enviada" });
        const previous = req.body.previousPath;
        if (isPersonalUtentePhoto(previous)) {
            const filename = previous.replace("/imagesUtentes/", "");
            try {
                await fs.promises.unlink(path.join(UTENTE_IMAGES_DIR, filename));
            } catch (err) {
                if (err.code !== "ENOENT") console.error("Erro ao apagar foto anterior:", err);
            }
        }
        res.json({ path: `/imagesUtentes/${req.file.filename}` });
    },

    // DELETE /imagesUtentes { path } — personal photos only (stock avatars are
    // protected). Nullifies the field on utentes that used it.
    deleteUtentePhoto: async (req, res) => {
        const { path: imgPath } = req.body;
        if (!isPersonalUtentePhoto(imgPath)) {
            return res.status(400).json({ mensagem: "Operação não permitida" });
        }
        const filename = imgPath.replace("/imagesUtentes/", "");
        try {
            await fs.promises.unlink(path.join(UTENTE_IMAGES_DIR, filename));
        } catch (err) {
            if (err.code === "ENOENT") return res.status(404).json({ mensagem: "Imagem não encontrada" });
            throw err;
        }
        const [affectedCount] = await Utente.update({ imagem: null }, { where: { imagem: imgPath } });
        if (affectedCount > 0) notificarAlteracaoBD();
        res.json({ eliminado: imgPath, utentesAfetados: affectedCount });
    },
};

module.exports = imageController;
