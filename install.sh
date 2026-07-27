#!/usr/bin/env bash
#
# install.sh — Instalação/atualização do InovLAR numa Raspberry Pi (Raspberry Pi OS / Debian).
#
# Idempotente: correr duas vezes não parte nada. Faz, por esta ordem:
#   1. Instala e configura o mariadb-server (pacote da distro — ver NOTA DE VERSÃO abaixo).
#   2. Cria a base `inovlar` + utilizador `inovlar_app` com password GERADA (nunca hardcoded)
#      e escreve Server/.env (permissões 600) com essas credenciais.
#   3. Instala dependências (Server + Client), faz o build do React e corre as migrations.
#   4. Instala/ativa o serviço systemd `inov-lar` (arranca no boot; Express+Socket.io na porta 3000).
#
# NOTA DE VERSÃO (armhf):
#   A Pi corre userspace armhf 32-bit. Os repositórios OFICIAIS do MariaDB (incl. 12.3) só
#   publicam para arm64/amd64 — NÃO para armhf. Por isso usa-se o `mariadb-server` da DISTRO
#   (Raspberry Pi OS bookworm = MariaDB 10.11 LTS). É compatível: JSON (alias de LONGTEXT) e o
#   conector `mariadb` funcionam desde a 10.5+. Em dev testou-se contra 12.3.2 (x86_64); confirma
#   no fim o major instalado aqui e valida a app (ver DEVELOPMENT_LOG.md, Fase 3).
#
# NÃO instala nem usa sqlite3 (removido na migração para MariaDB — era a origem do SEGV na Pi).
#
# TLS (opt-in, item 2 do IMPROVEMENTS_CHECKLIST.md): por omissão o script mantém o
# comportamento de sempre — HTTP puro em :3000. Para pôr um Caddy à frente com HTTPS
# (certificado self-signed, sem precisar de domínio):
#   sudo ENABLE_TLS=true bash install.sh
# Uma vez ativado (COOKIE_SECURE fica gravado no .env), execuções seguintes SEM a
# variável não o desativam — evita que um `sudo bash install.sh` esquecido derrube a
# segurança de uma instalação já em HTTPS. Ver Caddyfile e a nota "Operacional" no
# fim deste script. IMPORTANTE nas primeiras vezes que ativas: os URLs dos tablets
# mudam de http://<ip>:3000/... para https://<ip>/... — têm de ser reabertos.
#
# Uso:  sudo bash install.sh
#       sudo ENABLE_TLS=true bash install.sh   # com HTTPS (Caddy + cert self-signed)
#
set -euo pipefail

### -------- Configuração (ajustável no topo) --------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${SCRIPT_DIR}"                 # convenção: /opt/inov-lar (mas adapta-se a onde o script estiver)
SERVER_DIR="${APP_DIR}/Server"
CLIENT_DIR="${APP_DIR}/Client"
SERVICE_NAME="inov-lar"
SERVICE_USER="${SUDO_USER:-pi}"         # utilizador que corre o serviço (quem chamou o sudo)
ENABLE_TLS="${ENABLE_TLS:-false}"       # opt-in: Caddy + HTTPS self-signed (ver nota acima)

DB_NAME="inovlar"
DB_USER="inovlar_app"
DB_HOST="127.0.0.1"
DB_PORT="3306"
ENV_FILE="${SERVER_DIR}/.env"

# Versão mínima do Node exigida pelo conector `mariadb` (package.json: engines.node >= 20).
NODE_MIN_MAJOR=20

### -------- Helpers --------
log()  { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[erro]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Corre com sudo:  sudo bash install.sh"
id "$SERVICE_USER" >/dev/null 2>&1 || die "Utilizador '${SERVICE_USER}' não existe. Define SERVICE_USER no topo do script."
[ -d "$SERVER_DIR" ] || die "Não encontro ${SERVER_DIR}. Corre o script a partir da raiz do projeto."

SERVICE_HOME="$(getent passwd "$SERVICE_USER" | cut -d: -f6)"

### -------- 0) Node / npm — encontra um binário ABSOLUTO com versão suficiente --------
# NUNCA confiamos no `node` resolvido por $PATH (lição da Pi: sob `sudo` o PATH não tem o nvm do
# utilizador, e um `/usr/local/bin/node` pode ser uma instalação antiga — foi o que aconteceu aqui:
# apontava para um Node 18 quando o mariadb exige >=20). Por isso procura-se e VALIDA-SE a versão de
# cada candidato, em vez de fixar um caminho às cegas.
node_major() { "$1" -v 2>/dev/null | sed 's/^v//' | cut -d. -f1; }

find_node() {
  local candidates=(
    "/usr/local/bin/node"
    "$(command -v node 2>/dev/null || true)"
  )
  # Todas as versões instaladas via nvm do utilizador do serviço, da mais recente para a mais antiga.
  local nvm_node
  for nvm_node in $(ls -d "${SERVICE_HOME}/.nvm/versions/node"/*/bin/node 2>/dev/null | sort -Vr); do
    candidates+=("$nvm_node")
  done
  local c major
  for c in "${candidates[@]}"; do
    [ -n "$c" ] && [ -x "$c" ] || continue
    major="$(node_major "$c")"
    if [ -n "$major" ] && [ "$major" -ge "$NODE_MIN_MAJOR" ] 2>/dev/null; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

NODE_BIN="$(find_node)" || die "Não encontrei nenhum Node >= ${NODE_MIN_MAJOR} (exigido pelo conector mariadb). Instala um (ex.: 'sudo -u ${SERVICE_USER} bash -lc \"nvm install --lts\"') e volta a correr o script."
NPM_BIN="$(dirname "$NODE_BIN")/npm"
[ -x "$NPM_BIN" ] || die "npm não encontrado ao lado de ${NODE_BIN}."
log "Node $("$NODE_BIN" -v) (${NODE_BIN}) / npm $("$NPM_BIN" -v)"

### -------- 1) MariaDB (pacote da distro) --------
log "A instalar/garantir o mariadb-server (pacote da distro)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y mariadb-server
systemctl enable --now mariadb

MYSQL_CLI="$(command -v mariadb || command -v mysql)"
[ -n "$MYSQL_CLI" ] || die "Cliente MariaDB não encontrado após a instalação."
MARIADB_VER="$("$MYSQL_CLI" --version 2>/dev/null || echo 'desconhecida')"
log "MariaDB instalado: ${MARIADB_VER}"

### -------- 2) Base de dados + utilizador (password gerada, idempotente) --------
# Reutiliza a password se o .env já existir — não a muda em execuções seguintes (idempotência).
if [ -f "$ENV_FILE" ] && grep -q '^DB_PASS=' "$ENV_FILE"; then
  DB_PASS="$(grep '^DB_PASS=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
  log "Reutilizo a password da BD já registada em ${ENV_FILE}."
else
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
  log "Gerada nova password para a BD."
fi

# Reutiliza o COOKIE_SECRET se o .env já existir — não o muda em execuções seguintes (idempotência).
if [ -f "$ENV_FILE" ] && grep -q '^COOKIE_SECRET=' "$ENV_FILE"; then
  COOKIE_SECRET="$(grep '^COOKIE_SECRET=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
  log "Reutilizo o COOKIE_SECRET já registado em ${ENV_FILE}."
else
  COOKIE_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
  log "Gerado novo COOKIE_SECRET."
fi

# TLS_ACTIVE decide tudo o resto (Caddy, HOST do Express, mensagem final) — fica
# "colado" a true assim que ativado (lido de volta do .env), mesmo que uma execução
# futura não passe ENABLE_TLS=true (ver nota no topo do script).
if [ -f "$ENV_FILE" ] && grep -q '^COOKIE_SECURE=true' "$ENV_FILE"; then
  TLS_ACTIVE="true"
else
  TLS_ACTIVE="$ENABLE_TLS"
fi
[ "$TLS_ACTIVE" = "true" ] && COOKIE_SECURE_VAL="true" || COOKIE_SECURE_VAL="false"

# root autentica por unix_socket na Pi → o cliente corre como root sem password.
# Cria o utilizador para 127.0.0.1 (a app liga por TCP) e para localhost (conveniência/CLI).
"$MYSQL_CLI" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
log "Base '${DB_NAME}' e utilizador '${DB_USER}' prontos."

### -------- 3) Server/.env (credenciais que a app lê via dotenv) --------
umask 077
cat > "$ENV_FILE" <<ENV
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
COOKIE_SECRET=${COOKIE_SECRET}
COOKIE_SECURE=${COOKIE_SECURE_VAL}
ENV
chown "${SERVICE_USER}:${SERVICE_USER}" "$ENV_FILE" 2>/dev/null || true
log "Escrito ${ENV_FILE} (permissões 600)."

### -------- 4) Dependências + build + migrations --------
# `npm` (e o seu `npm-cli.js`) tem shebang `#!/usr/bin/env node` — invocado diretamente, o SO resolve
# esse `node` por $PATH, não pelo NODE_BIN que escolhemos. Sob `sudo`, o $PATH é mínimo e não inclui o
# nvm, por isso `env node` cairia de volta no v18 antigo (visto nos avisos EBADENGINE de uma corrida
# anterior). Corrige-se pondo a pasta do NODE_BIN escolhido à frente do $PATH só nestas subshells.
NODE_DIR="$(dirname "$NODE_BIN")"

log "A instalar dependências do Server..."
( export PATH="${NODE_DIR}:${PATH}"; cd "$SERVER_DIR" && "$NPM_BIN" install )

if [ -d "$CLIENT_DIR" ]; then
  log "A instalar dependências e a fazer o build do Client (React)..."
  ( export PATH="${NODE_DIR}:${PATH}"; cd "$CLIENT_DIR" && "$NPM_BIN" install && "$NPM_BIN" run build )
else
  warn "Pasta Client não encontrada (${CLIENT_DIR}) — salto o build do frontend."
fi

log "A correr as migrations (sequelize-cli, sem npx — binário direto via node absoluto)..."
# `sequelize-cli` é dependência do projeto → existe em node_modules após o `npm install` acima.
# Chamamos o ficheiro bin diretamente com o node ABSOLUTO: contorna o npx-cli.js e a sua
# re-resolução de $PATH (que reapanharia o node v22 do nvm).
( cd "$SERVER_DIR" && "$NODE_BIN" node_modules/sequelize-cli/lib/sequelize db:migrate )

# Seeders (botões predefinidos). AO CONTRÁRIO das migrations, o sequelize-cli NÃO regista os
# seeders já corridos (sem SequelizeMeta própria) — mas o seeder em si já é idempotente desde
# 2026-07-27 (IMPROVEMENTS_CHECKLIST.md item 6: `ignoreDuplicates: true` no bulkInsert, ver
# seeders/20250506190850-seed-botoes.js), por isso corre-se sempre, sem guard manual aqui (a
# versão anterior deste script contava as linhas de `Botoes` para decidir se saltava o passo —
# já não é preciso, e um COUNT a zero não distinguia "nunca semeado" de "alguém apagou tudo").
# Tem de correr ANTES do serviço arrancar: `seedDefaults()` do `main.js` usa os botões existentes
# para construir o template "Predefinida" só uma vez — se arrancar com a tabela vazia, o
# template fica vazio para sempre.
log "A popular os botões predefinidos (seeders)..."
( cd "$SERVER_DIR" && "$NODE_BIN" node_modules/sequelize-cli/lib/sequelize db:seed:all )

# node_modules / dist foram criados como root; devolve a posse ao utilizador do serviço.
chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"

### -------- 5) Caddy + TLS (só se ENABLE_TLS=true / já ativado numa execução anterior) --------
if [ "$TLS_ACTIVE" = "true" ]; then
  if ! command -v caddy >/dev/null 2>&1; then
    log "A instalar o Caddy (repositório oficial apt)..."
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      -o /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
  else
    log "Caddy já instalado — salto a instalação do pacote."
  fi

  log "A instalar ${APP_DIR}/Caddyfile em /etc/caddy/Caddyfile..."
  cp "${APP_DIR}/Caddyfile" /etc/caddy/Caddyfile
  systemctl enable --now caddy
  systemctl reload caddy || systemctl restart caddy
  log "Caddy pronto (HTTPS em :443, cert self-signed — ver nota no Caddyfile)."
else
  log "TLS desativado (ENABLE_TLS!=true) — a saltar a instalação do Caddy. HTTP puro em :${port:-3000}."
fi

### -------- 6) Serviço systemd --------
log "A instalar o serviço systemd '${SERVICE_NAME}'..."
# Com TLS ativo, o Express só ouve em 127.0.0.1 (HOST=127.0.0.1) — só alcançável
# através do Caddy (:443, HTTPS); sem TLS, mantém-se o comportamento de sempre
# (todas as interfaces, alcançável diretamente em :3000).
HOST_ENV_LINE=""
[ "$TLS_ACTIVE" = "true" ] && HOST_ENV_LINE="Environment=HOST=127.0.0.1"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=InovLAR (Express + Socket.io + MariaDB)
After=network.target mariadb.service
Requires=mariadb.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${SERVER_DIR}
ExecStart=${NODE_BIN} ${SERVER_DIR}/main.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
${HOST_ENV_LINE}

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

log "Estado do serviço:"
systemctl --no-pager --lines=10 status "${SERVICE_NAME}" || true

PI_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ "$TLS_ACTIVE" = "true" ]; then
  APP_URL_LINE="  App:      https://${PI_IP:-<ip-da-pi>}  (ou https://localhost)"
  TLS_NOTE="
  TLS:      Caddy em :443, certificado self-signed (CA local do Caddy).
            1ª visita em cada tablet mostra \"ligação não segura\" — aceitar uma
            vez chega (não instala nada). Os URLs dos tablets mudam de
            http://<ip>:3000/board/<token> para https://<ip>/board/<token> —
            reabre cada um a partir da consola de staff.
            Logs do Caddy: journalctl -u caddy -f"
else
  APP_URL_LINE="  App:      http://${PI_IP:-localhost}:3000  (HTTP puro — ver item 2 do IMPROVEMENTS_CHECKLIST.md)"
  TLS_NOTE=""
fi

cat <<DONE

------------------------------------------------------------
InovLAR instalado.
${APP_URL_LINE}
  Serviço:  systemctl status ${SERVICE_NAME}
  Logs:     journalctl -u ${SERVICE_NAME} -f
  MariaDB:  ${MARIADB_VER}
  BD:       ${DB_NAME} (user ${DB_USER}; credenciais em ${ENV_FILE})${TLS_NOTE}
------------------------------------------------------------
DONE
