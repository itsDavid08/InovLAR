<#
.SYNOPSIS
    Setup de desenvolvimento do InovLAR no Windows.

.DESCRIPTION
    Equivalente ao install.sh (usado na Raspberry Pi para produção), mas só para o fluxo de
    desenvolvimento local descrito no README: cria a base de dados e o utilizador no MariaDB já
    instalado, escreve Server\.env, instala as dependências do Server e do Client, e corre
    migrations + seeders. NÃO instala o MariaDB (assume que já o tens) nem arranca nenhum serviço
    em background — no fim, arrancas o Server/Client manualmente (ver instruções finais).

    Idempotente: correr duas vezes não parte nada (reutiliza a password do .env já existente,
    e só semeia os botões predefinidos se a tabela Botoes estiver vazia — os seeders do
    sequelize-cli, ao contrário das migrations, não têm registo próprio de execução).

.PARAMETER DbName
    Nome da base de dados de desenvolvimento.

.PARAMETER DbUser
    Utilizador da aplicação a criar/usar no MariaDB.

.PARAMETER RootUser
    Utilizador com permissões para criar a BD/utilizador (por omissão "root").

.PARAMETER RootPassword
    Password do RootUser. Vazio = sem password (omissão comum numa instalação local de MariaDB
    no Windows). Se o teu root tiver password, passa -RootPassword "a-tua-password".

.EXAMPLE
    .\install.ps1
    .\install.ps1 -RootPassword "password_do_root"
#>
param(
    [string]$DbName = "inovlar_dev",
    [string]$DbUser = "inovlar_app",
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 3306,
    [string]$RootUser = "root",
    [string]$RootPassword = "",
    [int]$NodeMinMajor = 20
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $RepoRoot "Server"
$ClientDir = Join-Path $RepoRoot "Client"
$EnvFile = Join-Path $ServerDir ".env"

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "[aviso] $msg" -ForegroundColor Yellow }
function Die([string]$msg) { Write-Host "[erro] $msg" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $ServerDir)) { Die "Não encontro $ServerDir. Corre o script a partir da raiz do repositório." }

### -------- 0) Node >= NodeMinMajor (exigido pelo conector `mariadb`) --------
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Die "Node não encontrado no PATH. Instala o Node >= $NodeMinMajor." }
$nodeVersionRaw = (& node -v).Trim()
$nodeMajor = [int]($nodeVersionRaw.TrimStart('v').Split('.')[0])
if ($nodeMajor -lt $NodeMinMajor) {
    Die "Node $nodeVersionRaw encontrado, mas o conector 'mariadb' exige >= $NodeMinMajor. Atualiza o Node."
}
Write-Step "Node $nodeVersionRaw OK"

### -------- 1) Encontrar o cliente mysql/mariadb --------
function Find-MysqlClient {
    $cmd = Get-Command mariadb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd = Get-Command mysql -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = Get-ChildItem "C:\Program Files\MariaDB*\bin\mysql.exe" -ErrorAction SilentlyContinue
    if ($candidates) {
        return ($candidates | Sort-Object FullName -Descending | Select-Object -First 1).FullName
    }
    return $null
}
$MysqlCli = Find-MysqlClient
if (-not $MysqlCli) {
    Die "Não encontrei o cliente mysql/mariadb. Instala o MariaDB (mariadb.org/download) ou adiciona-o ao PATH."
}
Write-Step "Cliente MariaDB: $MysqlCli"

### -------- 2) Base de dados + utilizador (idempotente) --------
# Reutiliza a password do .env se já existir — não a muda em execuções seguintes.
if ((Test-Path $EnvFile) -and (Select-String -Path $EnvFile -Pattern '^DB_PASS=' -Quiet)) {
    $DbPass = (Select-String -Path $EnvFile -Pattern '^DB_PASS=(.*)$').Matches[0].Groups[1].Value
    Write-Step "Reutilizo a password da BD já registada em $EnvFile"
} else {
    $chars = (48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ }
    $DbPass = -join $chars
    Write-Step "Gerada nova password para a BD"
}

# Reutiliza o COOKIE_SECRET do .env se já existir — não o muda em execuções seguintes.
if ((Test-Path $EnvFile) -and (Select-String -Path $EnvFile -Pattern '^COOKIE_SECRET=' -Quiet)) {
    $CookieSecret = (Select-String -Path $EnvFile -Pattern '^COOKIE_SECRET=(.*)$').Matches[0].Groups[1].Value
    Write-Step "Reutilizo o COOKIE_SECRET já registado em $EnvFile"
} else {
    $secretChars = (48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ }
    $CookieSecret = -join $secretChars
    Write-Step "Gerado novo COOKIE_SECRET"
}

$rootArgs = @("-u", $RootUser)
if ($RootPassword) { $rootArgs += "-p$RootPassword" }

$sql = @"
CREATE DATABASE IF NOT EXISTS ``$DbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DbUser'@'localhost' IDENTIFIED BY '$DbPass';
CREATE USER IF NOT EXISTS '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPass';
ALTER USER '$DbUser'@'localhost' IDENTIFIED BY '$DbPass';
ALTER USER '$DbUser'@'127.0.0.1' IDENTIFIED BY '$DbPass';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'localhost';
GRANT ALL PRIVILEGES ON ``$DbName``.* TO '$DbUser'@'127.0.0.1';
FLUSH PRIVILEGES;
"@
$sql | & $MysqlCli @rootArgs
if ($LASTEXITCODE -ne 0) { Die "Falha ao criar BD/utilizador no MariaDB (confirma -RootUser/-RootPassword)." }
Write-Step "Base '$DbName' e utilizador '$DbUser' prontos"

### -------- 3) Server\.env --------
@"
DB_NAME=$DbName
DB_USER=$DbUser
DB_PASS=$DbPass
DB_HOST=$DbHost
DB_PORT=$DbPort
COOKIE_SECRET=$CookieSecret
COOKIE_SECURE=false
"@ | Set-Content -Path $EnvFile -Encoding utf8
Write-Step "Escrito $EnvFile"

### -------- 4) Dependências --------
Write-Step "A instalar dependências do Server..."
Push-Location $ServerDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) { Die "npm install falhou no Server." }
} finally { Pop-Location }

if (Test-Path $ClientDir) {
    Write-Step "A instalar dependências do Client..."
    Push-Location $ClientDir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { Die "npm install falhou no Client." }
    } finally { Pop-Location }
} else {
    Write-Warn "Pasta Client não encontrada ($ClientDir) — salto."
}

### -------- 5) Migrations --------
Write-Step "A correr as migrations..."
Push-Location $ServerDir
try {
    node node_modules/sequelize-cli/lib/sequelize db:migrate
    if ($LASTEXITCODE -ne 0) { Die "Migrations falharam." }
} finally { Pop-Location }

### -------- 6) Seeders (botões predefinidos) --------
# Ao contrário das migrations (registadas em SequelizeMeta), os seeders do sequelize-cli não têm
# tabela de controlo própria — mas o seeder em si já é idempotente desde 2026-07-27
# (IMPROVEMENTS_CHECKLIST.md item 6: ignoreDuplicates: true no bulkInsert), por isso corre-se
# sempre, sem contagem prévia (uma versão anterior deste script contava as linhas de Botoes para
# decidir se saltava o passo — já não é preciso, e um COUNT a zero não distinguia "nunca semeado"
# de "alguém apagou tudo").
Write-Step "A popular os botões predefinidos (seeders)..."
Push-Location $ServerDir
try {
    node node_modules/sequelize-cli/lib/sequelize db:seed:all
    if ($LASTEXITCODE -ne 0) { Die "Seeders falharam." }
} finally { Pop-Location }

### -------- 7) Mensagem final --------
# IP da LAN para não ser preciso ir ao `ipconfig` só para abrir a app no tablet. Filtra
# pela interface que TEM gateway por omissão e está "Up": é a que está mesmo ligada à
# rede. Sem esse filtro apanhavam-se também os adaptadores virtuais (Hyper-V, WSL, VPNs),
# que têm IPv4 igualmente válido e nenhum deles serve para chegar aqui de outro
# dispositivo. Se falhar, mostra-se um placeholder em vez de partir o script.
$LanIp = $null
try {
    $LanIp = (Get-NetIPConfiguration -ErrorAction Stop |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
        Select-Object -First 1).IPv4Address.IPAddress
} catch { }
if (-not $LanIp) { $LanIp = "<ip-desta-maquina>" }

Write-Host "`n------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "InovLAR (dev) pronto." -ForegroundColor Cyan
Write-Host "  Server:  cd Server; node main.js        -> http://localhost:3000"
Write-Host "  Client:  cd Client; npm run dev          -> http://localhost:5173"
Write-Host "  BD:      $DbName (user $DbUser; credenciais em $EnvFile)"
Write-Host ""
Write-Host "  De outro dispositivo na mesma rede (tablet, telemovel):" -ForegroundColor Cyan
Write-Host "    Server:  http://${LanIp}:3000"
Write-Host "    Client:  http://${LanIp}:5173   ('npm run dev' ja escuta em toda a rede)"
Write-Host "    Este PC chama-se '$($env:COMPUTERNAME)' — a partir de outro Windows,"
Write-Host "      http://$($env:COMPUTERNAME):3000 costuma funcionar sem saber o IP."
Write-Host "      O Vite (5173) so aceita por IP: bloqueia hosts que nao conhece."
Write-Host "    Nao abre de fora? E quase sempre a firewall ou a rede estar como 'Publica':" -ForegroundColor Yellow
Write-Host "      Set-NetConnectionProfile -NetworkCategory Private"
Write-Host "      New-NetFirewallRule -DisplayName 'InovLAR dev' -Direction Inbound ``"
Write-Host "        -LocalPort 3000,5173 -Protocol TCP -Action Allow"
Write-Host "------------------------------------------------------------`n" -ForegroundColor Cyan
