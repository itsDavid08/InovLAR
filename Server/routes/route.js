const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Añadido para manejo de directorios
const os = require('os');
const utenteController = require('../controller/utenteController');
const botaoController = require('../controller/botaoController');
const pedidoController = require('../controller/pedidoController');
const viewController = require('../controller/viewController');
const authController = require('../controller/authController');
const tabelaController = require('../controller/tabelaController');
const { requireStaff } = require('../middleware/auth');
const { notificarAlteracaoBD } = require('../Util/socketIO');

const router = express.Router();
const { Botao } = require('../models');

const storageImagesBotoes = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/imagesBotoes');
        fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/imagesBotoes');
        const original = path.basename(file.originalname); // segurança: remove componentes de caminho (path traversal)
        if (req.query.onConflict === 'rename') {
            const ext = path.extname(original);
            const base = path.basename(original, ext);
            let nome = original, n = 1;
            while (fs.existsSync(path.join(dir, nome))) nome = `${base}(${n++})${ext}`;
            cb(null, nome);
        } else {
            cb(null, original); // substituir ou primeira vez
        }
    }
});

const uploadImagemBotao = multer({
    storage: storageImagesBotoes,
    fileFilter: (req, file, cb) => {
        const ok = /jpeg|jpg|png|gif/i.test(file.mimetype) &&
                   /\.(jpeg|jpg|png|gif)$/i.test(file.originalname);
        ok ? cb(null, true) : cb(new Error('Apenas imagens (JPEG, JPG, PNG, GIF)'));
    }
});

router.get('/localIP', (req, res) => {
    const interfaces = os.networkInterfaces();
    let localIP = '';

    Object.entries(interfaces).forEach(([ifaceName, iface]) => {
        iface.forEach(alias => {
            if (alias.family === 'IPv4' && !alias.internal) {
                localIP = { ip: alias.address };
                console.log('Local IP: ', localIP);
            }
        })
    });

    res.json(localIP);
});

// Rotas de autenticação do staff (palavra-passe geral, definida por eles)
router.get('/auth/staff/status', authController.status);
router.post('/auth/staff/setup', authController.setup);
router.post('/auth/staff/login', authController.login);
router.post('/auth/staff/change', requireStaff, authController.change); // só autenticado
router.post('/auth/staff/logout', authController.logout);

// Rotas para Utentes
router.get('/utentes', utenteController.getUtentes);
router.get('/utentes/:id', utenteController.getUtenteById);
router.post('/utentes/create', requireStaff, utenteController.createUtente);
router.put('/utentes/:id', requireStaff, utenteController.updateUtente);
router.delete('/utentes/:id', requireStaff, utenteController.deleteUtente);
router.post('/utentes/:utenteId/botoes/:botaoId', requireStaff, utenteController.associarBotao);
router.delete('/utentes/:utenteId/botoes/:botaoId', requireStaff, utenteController.desassociarBotao);

// Layout da tabela por dispositivo
router.get('/utentes/:id/tabela/:dispositivo', tabelaController.getTabela);
router.put('/utentes/:id/tabela/:dispositivo', requireStaff, tabelaController.saveTabela);

// Upload e eliminação de imagens de botões
router.post('/imagesBotoes/upload', requireStaff, uploadImagemBotao.single('imagem'), (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada' });
    res.json({ path: `/imagesBotoes/${req.file.filename}` });
});

router.delete('/imagesBotoes', requireStaff, async (req, res) => {
    const { path: imgPath } = req.body;
    if (!imgPath || !imgPath.startsWith('/imagesBotoes/') || imgPath.includes('..')) {
        return res.status(400).json({ erro: 'Operação não permitida' });
    }
    const filename = imgPath.replace('/imagesBotoes/', '');
    if (filename.includes('/')) return res.status(400).json({ erro: 'Operação não permitida' });

    const filePath = path.join(__dirname, '../public/imagesBotoes', filename);
    try {
        await fs.promises.unlink(filePath);
        const [affectedCount] = await Botao.update({ imagem: null }, { where: { imagem: imgPath } });
        if (affectedCount > 0) notificarAlteracaoBD();
        res.json({ eliminado: imgPath, botoesAfetados: affectedCount });
    } catch (err) {
        if (err.code === 'ENOENT') return res.status(404).json({ erro: 'Imagem não encontrada' });
        res.status(500).json({ erro: 'Erro ao eliminar imagem' });
    }
});

// Rotas para Botões
router.get('/botoes', botaoController.getAllBotoes);
router.get('/botoes/utente/:utenteId', botaoController.getBotoesByUtenteId);
router.post('/botoes', requireStaff, botaoController.createBotao);
router.put('/botoes/:id', requireStaff, botaoController.updateBotao);
router.delete('/botoes/:id', requireStaff, botaoController.deleteBotao);

// Rotas para Pedidos
router.get('/pedidos', pedidoController.getTodosPedidos);
router.get('/pedidos/ativos/hora', pedidoController.getPedidosAtivosPorHora);
router.get('/pedidos/ativos/emergencia', pedidoController.getPedidosAtivosPorEmergencia);
router.get('/pedidos/:id', pedidoController.getPedidoPorId);
router.get('/pedidos/utente/:utenteId', pedidoController.getPedidosAtivosPorUtenteId);
router.post('/pedidos', pedidoController.criarPedido);
router.put('/pedidos/:id', pedidoController.atualizarPedido);
router.delete('/pedidos/:id', requireStaff, pedidoController.eliminarPedido);

router.get('/', (req,res) => viewController.renderIndexView(res));

module.exports = router;