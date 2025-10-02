-- Criar tabela para anúncios de texto
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  background_color VARCHAR(7) DEFAULT '#000000',
  text_color VARCHAR(7) DEFAULT '#FFFFFF',
  font_size INTEGER DEFAULT 24,
  display_duration INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_announcements_device_id ON announcements(device_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_order ON announcements(order_index);