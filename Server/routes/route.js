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
const tabelaPadraoController = require('../controller/tabelaPadraoController');
const { requireStaff } = require('../middleware/auth');
const { staffAuthLimiter } = require('../middleware/rateLimiter');
const { notificarAlteracaoBD } = require('../Util/socketIO');

const router = express.Router();
const { Botao, Utente } = require('../models');

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

// Fotos de perfil dos utentes. Pasta própria (separada dos ícones de botões) e
// nome de ficheiro único/não sequencial — os uploads pessoais nunca são listados
// pela API (só a subpasta 'predefinidos'), para confidencialidade.
const DIR_IMAGES_UTENTES = path.join(__dirname, '../public/imagesUtentes');
const storageImagesUtentes = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(DIR_IMAGES_UTENTES, { recursive: true }, (err) => cb(err, DIR_IMAGES_UTENTES));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(path.basename(file.originalname)).toLowerCase();
        const unico = `utente-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, unico);
    }
});

const uploadImagemUtente = multer({
    storage: storageImagesUtentes,
    fileFilter: (req, file, cb) => {
        const ok = /jpeg|jpg|png|gif/i.test(file.mimetype) &&
                   /\.(jpeg|jpg|png|gif)$/i.test(file.originalname);
        ok ? cb(null, true) : cb(new Error('Apenas imagens (JPEG, JPG, PNG, GIF)'));
    }
});

// True se o caminho é um upload PESSOAL de utente (não predefinido, sem traversal).
const ehUploadPessoalUtente = (p) =>
    typeof p === 'string' &&
    p.startsWith('/imagesUtentes/') &&
    !p.startsWith('/imagesUtentes/predefinidos/') &&
    !p.includes('..') &&
    !p.replace('/imagesUtentes/', '').includes('/');

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
router.post('/auth/staff/setup', staffAuthLimiter, authController.setup);
router.post('/auth/staff/login', staffAuthLimiter, authController.login);
router.post('/auth/staff/change', requireStaff, staffAuthLimiter, authController.change); // só autenticado
router.post('/auth/staff/logout', authController.logout);

// Rotas para Utentes
router.get('/utentes', requireStaff, utenteController.getUtentes); // roster completo -> só staff (RGPD)
router.get('/utentes/:id', utenteController.getUtenteById);
router.post('/utentes/create', requireStaff, utenteController.createUtente);
router.put('/utentes/:id', requireStaff, utenteController.updateUtente);
router.delete('/utentes/:id', requireStaff, utenteController.deleteUtente);
router.post('/utentes/:utenteId/botoes/:botaoId', requireStaff, utenteController.associarBotao);
router.delete('/utentes/:utenteId/botoes/:botaoId', requireStaff, utenteController.desassociarBotao);

// Layout da tabela por dispositivo
router.get('/tabelas', requireStaff, tabelaController.listarTabelas); // todos os layouts -> só staff
router.get('/utentes/:id/tabela/:dispositivo', tabelaController.getTabela);
router.put('/utentes/:id/tabela/:dispositivo', requireStaff, tabelaController.saveTabela);

// Templates de tabela ("defaults")
router.get('/tabelas-padrao', requireStaff, tabelaPadraoController.listar); // templates -> só staff
router.post('/tabelas-padrao', requireStaff, tabelaPadraoController.criar);
router.put('/tabelas-padrao/:id', requireStaff, tabelaPadraoController.atualizar);
router.delete('/tabelas-padrao/:id', requireStaff, tabelaPadraoController.eliminar);
router.post('/tabelas-padrao/:id/aplicar', requireStaff, tabelaPadraoController.aplicar);

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

// Upload de foto pessoal. Substitui automaticamente a foto anterior do utente
// (campo 'previousPath'), exceto se essa for um avatar predefinido.
router.post('/imagesUtentes/upload', requireStaff, uploadImagemUtente.single('imagem'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada' });
    const anterior = req.body.previousPath;
    if (ehUploadPessoalUtente(anterior)) {
        const filename = anterior.replace('/imagesUtentes/', '');
        try { await fs.promises.unlink(path.join(DIR_IMAGES_UTENTES, filename)); }
        catch (err) { if (err.code !== 'ENOENT') console.error('Erro ao apagar foto anterior:', err); }
    }
    res.json({ path: `/imagesUtentes/${req.file.filename}` });
});

// Eliminar foto pessoal (não permite apagar predefinidos). Anula o campo nos
// utentes que a usam, por consistência com o padrão dos botões.
router.delete('/imagesUtentes', requireStaff, async (req, res) => {
    const { path: imgPath } = req.body;
    if (!ehUploadPessoalUtente(imgPath)) {
        return res.status(400).json({ erro: 'Operação não permitida' });
    }
    const filename = imgPath.replace('/imagesUtentes/', '');
    try {
        await fs.promises.unlink(path.join(DIR_IMAGES_UTENTES, filename));
        const [affectedCount] = await Utente.update({ imagem: null }, { where: { imagem: imgPath } });
        if (affectedCount > 0) notificarAlteracaoBD();
        res.json({ eliminado: imgPath, utentesAfetados: affectedCount });
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
// Endpoints agregados (todos os pedidos / de todos os utentes) -> só staff (RGPD).
// O tabuleiro do utente usa apenas /pedidos/utente/:utenteId (o seu próprio), que fica aberto.
router.get('/pedidos', requireStaff, pedidoController.getTodosPedidos);
router.get('/pedidos/ativos/hora', requireStaff, pedidoController.getPedidosAtivosPorHora);
router.get('/pedidos/ativos/emergencia', requireStaff, pedidoController.getPedidosAtivosPorEmergencia);
router.get('/pedidos/:id', requireStaff, pedidoController.getPedidoPorId);
router.get('/pedidos/utente/:utenteId', pedidoController.getPedidosAtivosPorUtenteId);
router.post('/pedidos', pedidoController.criarPedido);
router.put('/pedidos/:id', pedidoController.atualizarPedido);
router.delete('/pedidos/:id', requireStaff, pedidoController.eliminarPedido);

router.get('/', (req,res) => viewController.renderIndexView(res));

module.exports = router;