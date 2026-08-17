const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const {setIO} = require('./Util/socketIO.js');
const { COOKIE_SECRET } = require('./config/auth');
const app = express();
const port = process.env.PORT || 3000;
// 'loopback': confia em X-Forwarded-* só quando o hop imediato é 127.0.0.1/::1 (um
// reverse proxy local, ex. Caddy — ver Caddyfile/install.sh, item 2 do
// IMPROVEMENTS_CHECKLIST.md). Sem isto, atrás de um proxy TODOS os pedidos
// pareceriam vir de 127.0.0.1 e o staffAuthLimiter (chaveado por req.ip) deixaria
// de distinguir atacantes — um único IP esgotava o limite para todos os staff.
// Sem proxy à frente (setup por omissão, sem TLS), isto é inofensivo: só muda o
// comportamento para ligações cujo socket já é loopback.
app.set('trust proxy', 'loopback');
const router = require('./routes/route.js');
const { errorHandler } = require('./middleware/errorHandler');
const path = require('path');
const DIST = path.join(__dirname, '../Client/dist');

// StaffAuth/StaffSession/UtenteSession/TabelaLayout/TabelaPadrao eram criadas aqui
// via Model.sync() no arranque; desde 2026-07-27 (item 5 do
// IMPROVEMENTS_CHECKLIST.md) são migrations como todas as outras tabelas
// (Server/migrations/20260727100000..100004) — correr `db:migrate` já é um passo
// obrigatório no setup (ver CLAUDE.md), por isso deixar de as sincronizar aqui não
// muda o fluxo documentado, só alinha estas 5 com Utente/Botao/Pedido (que nunca
// foram sync()'d). Purga de sessões expiradas + seed continuam a correr no arranque
// (não são criação de schema).
const { seedDefaults } = require('./Util/seedDefaults');
const { purgarExpiradas: purgarStaffSessions } = require('./Util/sessions');
const { purgarExpiradas: purgarUtenteSessions } = require('./Util/utenteSessions');
(async () => {
    await purgarStaffSessions();     // limpa sessões expiradas
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

// Headers de segurança HTTP (clickjacking, MIME-sniffing, referrer, HSTS, CSP —
// ver DEVELOPMENT_LOG.md 2026-07-23). Duas exceções aos defaults do helmet:
//
// - crossOriginResourcePolicy: "cross-origin" em vez de "same-origin". Em dev o
//   Vite serve a página em :5173 e as imagens (/imagesBotoes, /imagesUtentes) vêm
//   deste servidor em :3000 — origens diferentes — e "same-origin" bloqueava o
//   browser de as carregar (ERR_BLOCKED_BY_RESPONSE.NotSameOrigin). Em produção
//   nunca faria diferença (tudo same-origin), mas partia sempre o dev. Nada aqui é
//   sensível ao ponto de precisar da proteção do CORP (as fotos pessoais de
//   utentes já têm o próprio controlo de acesso — nome de ficheiro aleatório).
//
// O `script-src` fica nos defaults do helmet (só 'self', sem 'unsafe-inline' nem
// CDN): o Tailwind passou a ser um build real (ver index.html / tailwind.config.js),
// por isso já não há nem script externo nem <script> inline de config a autorizar —
// a CSP volta a barrar qualquer script inline injetado por XSS.
// - `upgrade-insecure-requests` (vem nos defaults do helmet) é REMOVIDA da CSP quando
//   não há TLS à frente. Essa diretiva manda o browser trocar http:// por https:// em
//   todos os pedidos; servindo em HTTP puro, isso transforma todos os assets em
//   ERR_SSL_PROTOCOL_ERROR e a página fica em branco. Nunca se notou porque o acesso
//   era sempre por IP, e a especificação manda ignorar o upgrade quando o host é um IP
//   literal — a isenção desaparece ao aceder por um NOME (mDNS, DNS, ou o próprio nome
//   da máquina), e aí a app deixa de abrir. Reproduzido em browser com
//   http://<nome>:3000 antes desta correção (ver DEVELOPMENT_LOG.md).
//   COOKIE_SECURE=true é o sinal de que existe um proxy TLS à frente (posto pelo
//   install.sh com ENABLE_TLS=true) — nesse caso a diretiva é útil e mantém-se.
const TEM_TLS_A_FRENTE = process.env.COOKIE_SECURE === 'true';
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: {
            useDefaults: true,
            directives: TEM_TLS_A_FRENTE ? {} : { upgradeInsecureRequests: null },
        },
    })
);

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

// Inicie o servidor. HOST é opt-in (process.env.HOST) — quando um reverse proxy
// local (Caddy) fica à frente com TLS, install.sh define HOST=127.0.0.1 para o
// Express deixar de ser alcançável diretamente de fora (só via HTTPS no proxy).
// Sem HOST definido, o comportamento é o de sempre (todas as interfaces).
const host = process.env.HOST;
server.listen(port, host, () =>
    console.log(`Server started on http://${host || 'localhost'}:${port}`)
);
