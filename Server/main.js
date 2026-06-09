const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const {setIO} = require('./Util/socketIO.js');
const app = express();
const port = 3000;
const router = require('./routes/route.js');
const imagesRouter = require('./routes/images');
const multer = require('multer');
const path = require('path');
const DIST = path.join(__dirname, '../Client/dist');

// Configuração do armazenamento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.use(express.static(DIST));

app.use(router);
app.use(imagesRouter);

app.use((req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// Criação do servidor HTTP e integração com socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

setIO(io);

// Exporte a função se quiser usar em outros arquivos de rota
module.exports = { app, server, io};

// Inicie o servidor
server.listen(port, () => console.log(`Server started on http://localhost:${port}`));