const dotenv = require("dotenv");

dotenv.config();

const config = {
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  server: process.env.DATABASE_SERVER,
  database: process.env.DATABASE_NAME,
  options: {
    encrypt: false, // Sesuai dengan konfigurasi SQL Server
    trustServerCertificate: true, // Jika menggunakan self-signed certificate
    enabledArithAbort: true, // Sesuai dengan konfigurasi SQL Server
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 50000,
  },
  requestTimeout: 60000,
};

module.exports = config;
