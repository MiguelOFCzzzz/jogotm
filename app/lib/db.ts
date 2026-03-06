// lib/db.ts
import mysql from 'mysql2/promise';

// Criamos um "Pool" de conexões. 
// Isso é mais eficiente que abrir uma conexão nova toda vez.
export const db = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root', // Sua senha do MySQL aqui
  database: process.env.MYSQL_DATABASE || 'glory_dark_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Teste rápido de conexão (opcional, aparece no console do VS Code)
db.getConnection()
  .then(() => console.log("🔥 Conectado ao Reino do MySQL: glory_dark_db"))
  .catch((err) => console.error("❌ Erro ao abrir os portões do banco:", err));