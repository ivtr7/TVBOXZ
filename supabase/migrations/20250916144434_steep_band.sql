/*
  # Create playlists table for device-content mapping

  1. New Tables
    - `playlists`
      - `id` (bigint, primary key)
      - `tenant_id` (bigint, not null)
      - `device_id` (bigint, not null, foreign key)
      - `content_id` (bigint, not null, foreign key)
      - `order_index` (int, default 0)
      - `duration_seconds` (int, nullable - for image duration override)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Indexes
    - Foreign keys for device_id and content_id
    - Composite index on (device_id, order_index)
  
  3. Constraints
    - Cascade delete when device or content is deleted
*/

CREATE TABLE IF NOT EXISTS playlists (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  device_id BIGINT NOT NULL,
  content_id BIGINT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  duration_seconds INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
  INDEX idx_device_order (device_id, order_index),
  INDEX idx_tenant_device (tenant_id, device_id)
);