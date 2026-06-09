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
const { requireStaff } = require('../middleware/auth');

const router = express.Router();

// Configuración mejorada de Multer con creación automática de directorio
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/uploads');

        // Crear directorio si no existe (de forma recursiva)
        fs.mkdir(uploadDir, { recursive: true }, (err) => {
            if (err) {
                console.error('Error al crear directorio de uploads:', err);
                return cb(err);
            }
            cb(null, uploadDir);
        });
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configuración adicional de Multer para validación
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: Solo se permiten imágenes (JPEG, JPG, PNG, GIF)'));
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
router.post('/utentes/create', utenteController.createUtente);
router.put('/utentes/:id', utenteController.updateUtente);
router.delete('/utentes/:id', utenteController.deleteUtente);
router.post('/utentes/:utenteId/botoes/:botaoId', utenteController.associarBotao);
router.delete('/utentes/:utenteId/botoes/:botaoId', utenteController.desassociarBotao);

// Rotas para Botões - Añadido manejo de errores para la subida de imágenes
router.get('/botoes', botaoController.getAllBotoes);
router.get('/botoes/utente/:utenteId', botaoController.getBotoesByUtenteId);
router.post('/botoes', botaoController.createBotao);
router.put('/botoes/:id', botaoController.updateBotao);
router.delete('/botoes/:id', botaoController.deleteBotao);

// Rotas para Pedidos
router.get('/pedidos', pedidoController.getTodosPedidos);
router.get('/pedidos/ativos/hora', pedidoController.getPedidosAtivosPorHora);
router.get('/pedidos/ativos/emergencia', pedidoController.getPedidosAtivosPorEmergencia);
router.get('/pedidos/:id', pedidoController.getPedidoPorId);
router.get('/pedidos/utente/:utenteId', pedidoController.getPedidosAtivosPorUtenteId);
router.post('/pedidos', pedidoController.criarPedido);
router.put('/pedidos/:id', pedidoController.atualizarPedido);
router.delete('/pedidos/:id', pedidoController.eliminarPedido);

router.get('/', (req,res) => viewController.renderIndexView(res));

module.exports = router;