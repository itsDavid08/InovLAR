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

### -------- 6) Seeders (botões predefinidos) — idempotente por contagem prévia --------
# Ao contrário das migrations (registadas em SequelizeMeta), os seeders do sequelize-cli não têm
# tabela de controlo própria — correr db:seed:all duas vezes rebentaria com chave duplicada
# (o seeder usa IDs fixos). Por isso só semeia se a tabela Botoes estiver vazia.
$countArgs = $rootArgs + @("-N", "-e", "SELECT COUNT(*) FROM ``$DbName``.Botoes;")
$botaoCountRaw = (& $MysqlCli @countArgs 2>$null | Select-Object -First 1)
$botaoCount = 0
if ($botaoCountRaw) { $botaoCount = [int]$botaoCountRaw }

if ($botaoCount -eq 0) {
    Write-Step "A popular os botões predefinidos (seeders)..."
    Push-Location $ServerDir
    try {
        node node_modules/sequelize-cli/lib/sequelize db:seed:all
        if ($LASTEXITCODE -ne 0) { Die "Seeders falharam." }
    } finally { Pop-Location }
} else {
    Write-Step "Tabela Botoes já tem $botaoCount linha(s) — salto os seeders (idempotência)."
}

Write-Host "`n------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "InovLAR (dev) pronto." -ForegroundColor Cyan
Write-Host "  Server:  cd Server; node main.js        -> http://localhost:3000"
Write-Host "  Client:  cd Client; npm run dev          -> http://localhost:5173"
Write-Host "  BD:      $DbName (user $DbUser; credenciais em $EnvFile)"
Write-Host "------------------------------------------------------------`n" -ForegroundColor Cyan
