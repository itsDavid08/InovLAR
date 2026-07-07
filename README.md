# InovLAR

Repository of Arditi´s partnership with the APCM´s project.

Sistema de comunicação e assistência para utentes de lares de idosos (parceria APCM). Duas
interfaces: o tabuleiro do utente (tablet, botões de pedidos) e a consola de staff (gestão de
utentes, botões, tabelas e monitorização de pedidos).

**Stack:** React (Vite) no `Client/` × Express + Sequelize (MariaDB) + Socket.io no `Server/`.

---

## Pré-requisitos

- **Node.js** ≥ 20 (exigido pelo conector `mariadb` — confirma com `node -v`)
- **MariaDB** instalado e a correr localmente ([mariadb.org/download](https://mariadb.org/download/))
- `npm`

---

## Primeira vez (setup local)

> **Atalho:** os passos 1–3 abaixo (criar BD/utilizador, `.env`, `npm install`, migrations+seeders)
> podem ser feitos de uma vez com `./install.ps1` (Windows/PowerShell), a partir da raiz do
> repositório. É idempotente — correr outra vez não parte nada. Ver `Get-Help ./install.ps1 -Full`
> para os parâmetros (nome da BD, utilizador, password de root, etc.).

### 1. Criar a base de dados e o utilizador no MariaDB

Numa consola com acesso ao `mysql`/`mariadb` (ajusta a password):

```powershell
mysql -u root -p -e "CREATE DATABASE inovlar_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'inovlar_app'@'localhost' IDENTIFIED BY 'a_tua_password'; GRANT ALL ON inovlar_dev.* TO 'inovlar_app'@'localhost'; FLUSH PRIVILEGES;"
```

> No Windows, se o `mysql`/`mariadb` não estiver no PATH, usa o caminho completo, por exemplo:
> `"C:\Program Files\MariaDB 12.3\bin\mysql.exe"`.

### 2. Configurar as credenciais do Server

```powershell
cd Server
copy .env.example .env
```

Edita o `Server\.env` com os valores que usaste no passo 1:

```
DB_NAME=inovlar_dev
DB_USER=inovlar_app
DB_PASS=a_tua_password
DB_HOST=127.0.0.1
DB_PORT=3306
```

> O `.env` está no `.gitignore` — nunca commitar credenciais reais.

### 3. Instalar dependências, migrar e semear a base

```powershell
npm i
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Isto cria as tabelas (`Utentes`, `Botoes`, `pedidos`, `UtenteBotoes`, …) e semeia os 43 botões
predefinidos. Ao arrancar o servidor pela primeira vez, o template de tabuleiro "Predefinida" é
criado automaticamente a partir desses botões.

### 4. Arrancar o Server

```powershell
node main.js
```

Corre em `http://localhost:3000`.

### 5. Client (noutra consola)

```powershell
cd Client
npm i
npm run dev
```

Corre em `http://localhost:5173` (Vite, com hot-reload), a falar com a API em `:3000`.

---

## Depois da primeira vez

**Server:**
```powershell
cd Server
node main.js
```

**Client:**
```powershell
cd Client
npm run dev
```

(Não é preciso repetir `db:migrate`/`db:seed:all` — só correm de novo se houver migrations/seeders
novos ainda não aplicados a essa base.)

---

## Notas

- Se mudares de máquina/base de dados, repete os passos 1–3 (criar BD, copiar `.env`, migrar+semear)
  — ou corre `install.ps1` outra vez, que faz tudo isso de uma vez e é seguro repetir.
- `install.ps1` (Windows) é só para **desenvolvimento local** — não instala o MariaDB (assume que já
  o tens) nem arranca nenhum serviço em background.
- Para produção/deploy numa Raspberry Pi, ver `install.sh` na raiz do repositório (automatiza a
  instalação do MariaDB, criação da BD/utilizador, migrations, seeders e o serviço systemd) e o
  histórico de decisões em `DEVELOPMENT_LOG.md`.
