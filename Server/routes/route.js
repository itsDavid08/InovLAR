const express = require("express");
const utenteController = require("../controller/utenteController");
const botaoController = require("../controller/botaoController");
const pedidoController = require("../controller/pedidoController");
const authController = require("../controller/authController");
const boardController = require("../controller/boardController");
const tabelaController = require("../controller/tabelaController");
const tabelaPadraoController = require("../controller/tabelaPadraoController");
const imageController = require("../controller/imageController");
const { requireStaff } = require("../middleware/auth");
const { staffAuthLimiter } = require("../middleware/rateLimiter");
const { uploadBotaoImage, uploadUtentePhoto } = require("../middleware/uploads");

const router = express.Router();

// Staff auth (shared device PIN)
router.get("/auth/staff/status", authController.status);
router.post("/auth/staff/setup", staffAuthLimiter, authController.setup);
router.post("/auth/staff/login", staffAuthLimiter, authController.login);
router.post("/auth/staff/change", requireStaff, staffAuthLimiter, authController.change);
router.post("/auth/staff/logout", authController.logout);

// Board (tabuleiro do utente): bootstrap da sessão a partir do accessToken da URL.
// As rotas de dados /board/* (ler/criar/atualizar) entram na Fase 2.
router.post("/board/session", boardController.createSession);
router.post("/board/logout", boardController.logout);

// Utentes
router.get("/utentes", requireStaff, utenteController.getAllUtentes); // full roster → staff only (RGPD)
router.get("/utentes/:id", utenteController.getUtenteById);
router.post("/utentes/create", requireStaff, utenteController.createUtente);
router.put("/utentes/:id", requireStaff, utenteController.updateUtente);
router.delete("/utentes/:id", requireStaff, utenteController.deleteUtente);
router.post("/utentes/:utenteId/botoes/:botaoId", requireStaff, utenteController.associateBotao);
router.delete("/utentes/:utenteId/botoes/:botaoId", requireStaff, utenteController.dissociateBotao);

// Table layouts (per utente + device)
router.get("/tabelas", requireStaff, tabelaController.listTabelas); // all layouts → staff only
router.get("/utentes/:id/tabela/:dispositivo", tabelaController.getTabela);
router.put("/utentes/:id/tabela/:dispositivo", requireStaff, tabelaController.saveTabela);

// Table templates ("defaults")
router.get("/tabelas-padrao", requireStaff, tabelaPadraoController.list);
router.post("/tabelas-padrao", requireStaff, tabelaPadraoController.create);
router.put("/tabelas-padrao/:id", requireStaff, tabelaPadraoController.update);
router.delete("/tabelas-padrao/:id", requireStaff, tabelaPadraoController.remove);
router.post("/tabelas-padrao/:id/aplicar", requireStaff, tabelaPadraoController.apply);

// Botão images (shared icon library)
router.get("/imagesBotoes", imageController.listBotaoImages);
router.post("/imagesBotoes/upload", requireStaff, uploadBotaoImage.single("imagem"), imageController.uploadBotaoImage);
router.delete("/imagesBotoes", requireStaff, imageController.deleteBotaoImage);

// Utente photos (personal → confidential pipeline, see middleware/uploads.js)
router.post("/imagesUtentes/upload", requireStaff, uploadUtentePhoto.single("imagem"), imageController.uploadUtentePhoto);
router.delete("/imagesUtentes", requireStaff, imageController.deleteUtentePhoto);

// Botões
router.get("/botoes", botaoController.getAllBotoes);
router.post("/botoes", requireStaff, botaoController.createBotao);
router.put("/botoes/:id", requireStaff, botaoController.updateBotao);
router.delete("/botoes/:id", requireStaff, botaoController.deleteBotao);

// Pedidos — aggregated reads are staff only (RGPD); the board only uses its
// own per-utente routes, which stay open (no auth on the tablet).
router.get("/pedidos", requireStaff, pedidoController.getAllPedidos);
router.get("/pedidos/ativos/hora", requireStaff, pedidoController.getActivePedidosByTime);
router.get("/pedidos/ativos/emergencia", requireStaff, pedidoController.getActivePedidosByEmergency);
router.get("/pedidos/:id", requireStaff, pedidoController.getPedidoById);
router.get("/pedidos/utente/:utenteId", pedidoController.getActivePedidosByUtenteId);
router.post("/pedidos", pedidoController.createPedido);
router.put("/pedidos/:id", pedidoController.updatePedido);
router.delete("/pedidos/:id", requireStaff, pedidoController.deletePedido);

module.exports = router;
