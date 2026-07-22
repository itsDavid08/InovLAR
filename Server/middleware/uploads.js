const multer = require("multer");
const path = require("path");
const fs = require("fs");

const BOTAO_IMAGES_DIR = path.join(__dirname, "../public/imagesBotoes");
const UTENTE_IMAGES_DIR = path.join(__dirname, "../public/imagesUtentes");

// Tamanho máximo por ficheiro. Generoso para fotos de telemóvel/ícones sem
// permitir uploads capazes de esgotar o disco (DoS).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Shared filter: images only. `.status = 400` makes the central errorHandler
// answer with the message instead of a generic 500.
const imageFileFilter = (req, file, cb) => {
    const ok =
        /jpeg|jpg|png|gif/i.test(file.mimetype) &&
        /\.(jpeg|jpg|png|gif)$/i.test(file.originalname);
    if (ok) return cb(null, true);
    const err = new Error("Apenas imagens (JPEG, JPG, PNG, GIF)");
    err.status = 400;
    cb(err);
};

// Assinaturas (magic bytes) dos 4 formatos aceites. `imageFileFilter` só vê o
// mimetype/extensão que o CLIENTE declarou — falsificável. Isto valida o
// conteúdo real do ficheiro já gravado em disco.
const MAGIC_BYTES = [
    [0x89, 0x50, 0x4e, 0x47], // PNG
    [0xff, 0xd8, 0xff],        // JPEG
    [0x47, 0x49, 0x46, 0x38],  // GIF ("GIF8" — cobre GIF87a e GIF89a)
];
const hasValidImageSignature = (buf) =>
    MAGIC_BYTES.some((bytes) => bytes.every((b, i) => buf[i] === b));

// Middleware: corre DEPOIS do multer gravar o ficheiro (diskStorage já escreveu
// o conteúdo antes do fileFilter poder inspecioná-lo). Lê os primeiros bytes reais
// e rejeita — apagando o ficheiro, 400 — se não corresponderem a uma assinatura de
// imagem válida. Fecha o buraco de mimetype/extensão serem dados pelo cliente.
const verifyImageSignature = async (req, res, next) => {
    if (!req.file) return next(); // o controller trata "nenhum ficheiro enviado"
    const fd = await fs.promises.open(req.file.path, "r");
    const buffer = Buffer.alloc(8);
    await fd.read(buffer, 0, 8, 0);
    await fd.close();
    if (hasValidImageSignature(buffer)) return next();
    await fs.promises.unlink(req.file.path).catch(() => {});
    const err = new Error("O ficheiro não é uma imagem válida");
    err.status = 400;
    next(err);
};

// Botão icons keep their original filename (they're a shared, listable library);
// on name conflict the client chooses rename/replace via ?onConflict.
const botaoImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(BOTAO_IMAGES_DIR, { recursive: true }, (err) => cb(err, BOTAO_IMAGES_DIR));
    },
    filename: (req, file, cb) => {
        const original = path.basename(file.originalname); // strips path components (traversal)
        if (req.query.onConflict === "rename") {
            const ext = path.extname(original);
            const base = path.basename(original, ext);
            let name = original, n = 1;
            while (fs.existsSync(path.join(BOTAO_IMAGES_DIR, name))) name = `${base}(${n++})${ext}`;
            cb(null, name);
        } else {
            cb(null, original); // replace or first upload
        }
    },
});

// Utente photos get a random, non-sequential filename — personal photos must
// not be enumerable or guessable (confidentiality; see CLAUDE.md).
const utentePhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(UTENTE_IMAGES_DIR, { recursive: true }, (err) => cb(err, UTENTE_IMAGES_DIR));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(path.basename(file.originalname)).toLowerCase();
        cb(null, `utente-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
});

const uploadBotaoImage = multer({
    storage: botaoImageStorage,
    fileFilter: imageFileFilter,
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});
const uploadUtentePhoto = multer({
    storage: utentePhotoStorage,
    fileFilter: imageFileFilter,
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

// True when the path is a PERSONAL utente upload (not a stock avatar, no traversal).
const isPersonalUtentePhoto = (p) =>
    typeof p === "string" &&
    p.startsWith("/imagesUtentes/") &&
    !p.startsWith("/imagesUtentes/predefinidos/") &&
    !p.includes("..") &&
    !p.replace("/imagesUtentes/", "").includes("/");

module.exports = {
    uploadBotaoImage,
    uploadUtentePhoto,
    verifyImageSignature,
    isPersonalUtentePhoto,
    BOTAO_IMAGES_DIR,
    UTENTE_IMAGES_DIR,
};
