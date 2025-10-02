-- Migration: Create refresh_tokens table
-- Date: 2024-01-15
-- Description: Add refresh tokens table for enhanced JWT security

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    user_type ENUM('user', 'admin', 'device') NOT NULL DEFAULT 'user',
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at DATETIME NULL,
    last_used_at DATETIME NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    INDEX idx_token (token),
    INDEX idx_user_id_type (user_id, user_type),
    INDEX idx_expires_at (expires_at),
    INDEX idx_revoked (revoked),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes for performance
CREATE INDEX idx_refresh_tokens_cleanup ON refresh_tokens (expires_at, revoked);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens (user_id, user_type, revoked, expires_at);

-- Add trigger to update last_used_at when token is validated
DELIMITER //
CREATE TRIGGER update_refresh_token_last_used
    BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW
BEGIN
    IF NEW.revoked = FALSE AND OLD.revoked = FALSE THEN
        SET NEW.last_used_at = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

-- Insert migration record
INSERT INTO migrations (version, description, executed_at) 
VALUES ('006', 'Create refresh_tokens table', NOW())
ON DUPLICATE KEY UPDATE executed_at = NOW();