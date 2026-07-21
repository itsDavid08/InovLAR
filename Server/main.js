const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const {setIO} = require('./Util/socketIO.js');
const { COOKIE_SECRET } = require('./config/auth');
const { StaffAuth, StaffSession, UtenteSession, TabelaLayout, TabelaPadrao } = require('./models');
const app = express();
const port = 3000;
const router = require('./routes/route.js');
const { errorHandler } = require('./middleware/errorHandler');
const path = require('path');
const DIST = path.join(__dirname, '../Client/dist');

// Garante que as tabelas existem (cria só se não existirem, não mexe nas outras).
const { seedDefaults } = require('./Util/seedDefaults');
(async () => {
    await StaffAuth.sync();
    await StaffSession.sync();
    await UtenteSession.sync();
    await TabelaLayout.sync();
    await TabelaPadrao.sync();
    await seedDefaults();            // cria a "Predefinida" (1ª vez) + aplica a utentes sem tabela
})().catch((e) => console.error('Erro no arranque/seed:', e));

app.use(express.json());
// CORS com credenciais: reflete a origem do pedido (não pode ser "*" quando há cookies).
// Em produção (Client servido aqui mesmo) é mesma origem; em dev (Vite:5173) é cross-origin.
app.use(cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
}));
app.use(cookieParser(COOKIE_SECRET)); // antes das rotas (preenche req.signedCookies)
app.use(express.static('public'));
app.use(express.static(DIST));

app.use(router);

// SPA fallback: qualquer rota não-API devolve o index do React.
app.use((req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// Tratamento central de erros (tem de ser o último middleware). O Express 5
// encaminha para aqui as promises rejeitadas dos handlers async.
app.use(errorHandler);

// Criação do servidor HTTP e integração com socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

setIO(io);

// Exporte a função se quiser usar em outros arquivos de rota
module.exports = { app, server, io};

// Inicie o servidor
server.listen(port, () => console.log(`Server started on http://localhost:${port}`));