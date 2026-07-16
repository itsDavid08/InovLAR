const multer = require("multer");
const path = require("path");
const fs = require("fs");

const BOTAO_IMAGES_DIR = path.join(__dirname, "../public/imagesBotoes");
const UTENTE_IMAGES_DIR = path.join(__dirname, "../public/imagesUtentes");

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

const uploadBotaoImage = multer({ storage: botaoImageStorage, fileFilter: imageFileFilter });
const uploadUtentePhoto = multer({ storage: utentePhotoStorage, fileFilter: imageFileFilter });

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
    isPersonalUtentePhoto,
    BOTAO_IMAGES_DIR,
    UTENTE_IMAGES_DIR,
};
