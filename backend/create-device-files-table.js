import db from './config/database.js';

const createTable = `
CREATE TABLE IF NOT EXISTS device_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  size BIGINT,
  file_path VARCHAR(500),
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
)`;

try {
  await db.execute(createTable);
  console.log('Table device_files created successfully');
  process.exit(0);
} catch (error) {
  console.error('Error creating table:', error);
  process.exit(1);
}