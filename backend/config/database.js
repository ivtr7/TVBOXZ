import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do pool de conexões com o banco de dados
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tvbox_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 15,       // Aumentado para mais resiliência
  queueLimit: 0,
  multipleStatements: true,
  timezone: '+00:00',
  connectTimeout: 20000,     // Aumentado o tempo de espera para conexão
  enableKeepAlive: true,       // Mantém as conexões ativas
  keepAliveInitialDelay: 10000 // Envia o primeiro "keep-alive" ping após 10s
});

// Função para inicializar o banco de dados (cria se não existir)
export async function initializeDatabase() {
  let connection;
  try {
    // Conexão inicial sem especificar o banco para poder criá-lo
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'tvbox_db'}\`;`);
    console.log('✅ Banco de dados verificado/criado com sucesso!');
    
    // Agora que o DB existe, o pool pode se conectar e criar as tabelas
    await createTables();
    console.log('✅ Tabelas verificadas/criadas com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error; // Propaga o erro para que o servidor não inicie
  } finally {
    if (connection) await connection.end();
  }
}

// Função interna para criar as tabelas
async function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'user') DEFAULT 'user',
      tenant_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      status ENUM('online', 'offline', 'maintenance') DEFAULT 'offline',
      last_seen TIMESTAMP NULL,
      tenant_id VARCHAR(255),
      ip_address VARCHAR(45),
      mac_address VARCHAR(17),
      device_info JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS content (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type ENUM('video', 'image', 'audio', 'text') NOT NULL,
      file_path VARCHAR(500),
      file_size BIGINT,
      duration INT,
      active BOOLEAN DEFAULT true,
      tenant_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS playlists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      content_ids JSON,
      active BOOLEAN DEFAULT true,
      tenant_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS device_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255),
      event_type VARCHAR(100),
      message TEXT,
      data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_device_id (device_id)
    )`
  ];

  for (const table of tables) {
    await pool.query(table);
  }
}

// Exporta o pool para ser usado em outros módulos
export const db = pool;

// Função para testar a conexão (pode ser usada para diagnóstico)
export async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexão com o banco de dados estabelecida com sucesso.');
    return { success: true, message: 'Conexão com MySQL estabelecida' };
  } catch (error) {
    console.error('❌ Falha na conexão com o banco de dados:', error);
    return { success: false, message: error.message };
  }
}

// Exporta o pool como padrão também, se necessário
export default pool;