/*
  # Add metadata fields to content table

  1. New Columns
    - `mime_type` (varchar 100) - MIME type of the file
    - `checksum` (varchar 128) - SHA-256 checksum for integrity
    - `duration_seconds` (int) - Duration for videos (extracted via ffprobe)
  
  2. Purpose
    - Enable content integrity verification
    - Support proper video duration handling
    - Improve content type detection
*/

ALTER TABLE content 
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS checksum VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS duration_seconds INT NULL;