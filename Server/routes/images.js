const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/imagesBotoes', (req, res) => {
    const dir = path.join(__dirname, '..', 'public', 'imagesBotoes');
    try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        const imagens = files
            .filter(f => f.isFile() && /\.(png|jpg|jpeg|gif)$/i.test(f.name))
            .map(f => `/imagesBotoes/${f.name}`);
        res.json(imagens);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler imagens' });
    }
});

module.exports = router;
