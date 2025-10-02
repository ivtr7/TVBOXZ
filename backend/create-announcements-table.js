import db from './config/database.js';

async function createAnnouncementsTable() {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        background_color VARCHAR(7) DEFAULT '#000000',
        text_color VARCHAR(7) DEFAULT '#FFFFFF',
        font_size INT DEFAULT 24,
        display_duration INT DEFAULT 10,
        is_active BOOLEAN DEFAULT 1,
        order_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `;
    
    await db.execute(createTableSQL);
    
    // Criar índices
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_announcements_device_id ON announcements(device_id)',
      'CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_announcements_order ON announcements(order_index)'
    ];
    
    for (const indexSQL of indexes) {
      await db.execute(indexSQL);
    }
    
    console.log('Tabela de anúncios criada com sucesso!');
  } catch (error) {
    console.error('Erro ao criar tabela de anúncios:', error);
  }
}

createAnnouncementsTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });