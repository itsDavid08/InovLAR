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
# Uso:  sudo bash install.sh
#
set -euo pipefail

### -------- Configuração (ajustável no topo) --------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="${SCRIPT_DIR}"                 # convenção: /opt/inov-lar (mas adapta-se a onde o script estiver)
SERVER_DIR="${APP_DIR}/Server"
CLIENT_DIR="${APP_DIR}/Client"
SERVICE_NAME="inov-lar"
SERVICE_USER="${SUDO_USER:-pi}"         # utilizador que corre o serviço (quem chamou o sudo)

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
ENV
chown "${SERVICE_USER}:${SERVICE_USER}" "$ENV_FILE" 2>/dev/null || true
log "Escrito ${ENV_FILE} (permissões 600)."

### -------- 4) Dependências + build + migrations --------
log "A instalar dependências do Server..."
( cd "$SERVER_DIR" && "$NPM_BIN" install )

if [ -d "$CLIENT_DIR" ]; then
  log "A instalar dependências e a fazer o build do Client (React)..."
  ( cd "$CLIENT_DIR" && "$NPM_BIN" install && "$NPM_BIN" run build )
else
  warn "Pasta Client não encontrada (${CLIENT_DIR}) — salto o build do frontend."
fi

log "A correr as migrations (sequelize-cli, sem npx — binário direto via node absoluto)..."
# `sequelize-cli` é dependência do projeto → existe em node_modules após o `npm install` acima.
# Chamamos o ficheiro bin diretamente com o node ABSOLUTO: contorna o npx-cli.js e a sua
# re-resolução de $PATH (que reapanharia o node v22 do nvm).
( cd "$SERVER_DIR" && "$NODE_BIN" node_modules/sequelize-cli/lib/sequelize db:migrate )

# node_modules / dist foram criados como root; devolve a posse ao utilizador do serviço.
chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"

### -------- 5) Serviço systemd --------
log "A instalar o serviço systemd '${SERVICE_NAME}'..."
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

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

log "Estado do serviço:"
systemctl --no-pager --lines=10 status "${SERVICE_NAME}" || true

cat <<DONE

------------------------------------------------------------
InovLAR instalado.
  App:      http://localhost:3000
  Serviço:  systemctl status ${SERVICE_NAME}
  Logs:     journalctl -u ${SERVICE_NAME} -f
  MariaDB:  ${MARIADB_VER}
  BD:       ${DB_NAME} (user ${DB_USER}; credenciais em ${ENV_FILE})
------------------------------------------------------------
DONE
