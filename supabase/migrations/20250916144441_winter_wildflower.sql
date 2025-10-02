/*
  # Add device UUID for unique device identification

  1. New Columns
    - `device_uuid` (varchar 255) - Unique identifier per device
  
  2. Constraints
    - Unique constraint on (device_uuid, tenant_id) for multi-tenant support
  
  3. Purpose
    - Enable one-time device registration
    - Support device identification across reinstalls
*/

ALTER TABLE devices 
  ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(255) NULL,
  ADD UNIQUE KEY IF NOT EXISTS ux_device_uuid_tenant (device_uuid, tenant_id);