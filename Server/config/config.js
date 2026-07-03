require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'inovlar_app',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'inovlar_dev',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  dialect: 'mariadb',
  dialectOptions: { charset: 'utf8mb4' },
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  logging: false,
};

module.exports = { development: base, test: base, production: base };
