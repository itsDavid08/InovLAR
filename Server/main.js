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
const { purgarExpiradas: purgarStaffSessions } = require('./Util/sessions');
const { purgarExpiradas: purgarUtenteSessions } = require('./Util/utenteSessions');
(async () => {
    await StaffAuth.sync();
    await StaffSession.sync();
    await UtenteSession.sync();
    await TabelaLayout.sync();
    await TabelaPadrao.sync();
    await purgarStaffSessions();     // limpa sessões expiradas (as tabelas já existem)
    await purgarUtenteSessions();
    await seedDefaults();            // cria a "Predefinida" (1ª vez) + aplica a utentes sem tabela
})().catch((e) => console.error('Erro no arranque/seed:', e));

// Origem do dev server do Vite — única exceção cross-origin permitida, e só fora
// de produção (em produção o Client é servido por este mesmo Express: same-origin).
const DEV_ORIGIN = 'http://localhost:5173';

// Permite a origem se for a mesma do pedido (compara com o Host real, por isso
// funciona em qualquer IP/hostname sem hardcode) ou, fora de produção, a origem
// do Vite. Sem header Origin (curl, pedidos same-origin em GET, scripts) passa
// sempre — CORS só existe para o browser decidir se deixa JS de outra origem ler
// a resposta. Partilhado pela API REST e pelo socket.io (única fonte de verdade).
function isOrigemPermitida(origin, host) {
    if (!origin) return true;
    let sameOrigin = false;
    try {
        sameOrigin = new URL(origin).host === host;
    } catch {
        sameOrigin = false;
    }
    const devOrigin = process.env.NODE_ENV !== 'production' && origin === DEV_ORIGIN;
    return sameOrigin || devOrigin;
}

app.use(express.json());
// CORS com credenciais: allowlist dinâmica (mesma origem do pedido, ou o Vite em
// dev) em vez de refletir qualquer origem — ver isOrigemPermitida acima.
// Lê os headers diretamente de req.headers (em vez de req.header(), método do
// Express) para que a mesma função sirva também o middleware de CORS interno do
// engine.io mais abaixo, que corre sobre o req cru do Node, sem passar pelo Express.
const corsOptionsDelegate = (req, callback) => {
    const origin = req.headers.origin;
    callback(null, { origin: isOrigemPermitida(origin, req.headers.host), credentials: true });
};
app.use(cors(corsOptionsDelegate));
app.use(cookieParser(COOKIE_SECRET)); // antes das rotas (preenche req.signedCookies)
app.use(express.static('public'));
app.use(express.static(DIST));

app.use(router);

// SPA fallback: navegações (GET) a caminhos não-API devolvem o index do React.
// Métodos não-GET a caminhos desconhecidos caem no 404 do Express (não devolvem HTML).
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(DIST, 'index.html'));
});

// Tratamento central de erros (tem de ser o último middleware). O Express 5
// encaminha para aqui as promises rejeitadas dos handlers async.
app.use(errorHandler);

// Criação do servidor HTTP e integração com socket.io
const server = http.createServer(app);

// O transporte de polling do socket.io é XHR normal (sujeito à mesma política de
// origem do browser que qualquer fetch) e é servido pelo engine.io diretamente
// sobre o servidor HTTP, sem passar pelo `app` do Express — por isso o `cors()`
// montado acima em app.use() nunca chega a correr para /socket.io/*. A opção
// `cors` aqui é o próprio engine.io a chamar `require('cors')(this.opts.cors)`
// internamente, e aceita a mesma função-delegate (req, callback) que passámos ao
// Express — é isto que garante o header Access-Control-Allow-Origin nas respostas
// de polling, não o io.use() abaixo (esse só valida a origem do handshake do
// socket, não adiciona headers HTTP).
const io = new Server(server, { cors: corsOptionsDelegate });

// Mesma política de origem da API REST (isOrigemPermitida) — validação adicional
// ao nível do handshake do socket (cobre também o upgrade para WebSocket, que não
// passa pelo `cors` acima). O socket.io não transporta dados sensíveis (só o sinal
// vazio 'bd_alterado'), mas restringe-se na mesma por consistência e para não
// deixar a porta aberta a ligações de qualquer origem (amplificação de DoS via
// browsers de terceiros).
io.use((socket, next) => {
    const { origin, host } = socket.handshake.headers;
    if (isOrigemPermitida(origin, host)) return next();
    next(new Error('Origem não permitida'));
});

setIO(io);

// Exporte a função se quiser usar em outros arquivos de rota
module.exports = { app, server, io};

// Inicie o servidor
server.listen(port, () => console.log(`Server started on http://localhost:${port}`));
