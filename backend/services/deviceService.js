import { db } from '../config/database.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

class DeviceService {
  // In-memory device socket mapping (use Redis in production for multi-instance)
  static deviceSockets = new Map();

  /**
   * Register device (one-time registration)
   */
  static async registerDevice(deviceData) {
    const { device_uuid, name, model, tenant_id } = deviceData;

    if (!device_uuid || !tenant_id) {
      throw new Error('device_uuid and tenant_id are required');
    }

    try {
      // Check if device already exists
      const [existingDevices] = await db.execute(
        'SELECT id, device_id, name, tenant_id FROM devices WHERE device_id = ? AND tenant_id = ?',
        [device_uuid, tenant_id]
      );

      let device;
      let isNew = false;

      if (existingDevices.length > 0) {
        // Device exists, return existing
        device = existingDevices[0];
        
        // Update last_seen and name if provided
        await db.execute(
          'UPDATE devices SET last_seen = NOW(), name = COALESCE(?, name) WHERE id = ?',
          [name, device.id]
        );
      } else {
        // Create new device
        const [result] = await db.execute(
          `INSERT INTO devices (device_id, name, location, status, tenant_id, created_at, last_seen) 
           VALUES (?, ?, ?, 'online', ?, NOW(), NOW())`,
          [device_uuid, name || `Device ${device_uuid.slice(-8)}`, model || 'Unknown', tenant_id]
        );

        device = {
          id: result.insertId,
          device_id: device_uuid,
          name: name || `Device ${device_uuid.slice(-8)}`,
          tenant_id
        };
        isNew = true;
      }

      // Generate device JWT token
      const token = jwt.sign(
        {
          device_id: device.id,
          device_uuid: device.device_uuid,
          tenant_id: device.tenant_id,
          role: 'device'
        },
        process.env.JWT_SECRET_DEVICE || process.env.JWT_SECRET,
        { expiresIn: '30d' } // Long-lived for devices
      );

      return { device, token, isNew };
    } catch (error) {
      console.error('Device registration error:', error);
      throw error;
    }
  }

  /**
   * Get device playlist/manifest
   */
  static async getDeviceManifest(deviceId) {
    try {
      const [playlist] = await db.execute(`
        SELECT 
          p.id as playlist_id,
          p.content_id,
          p.order_index,
          p.duration_seconds as playlist_duration,
          c.title,
          c.type,
          c.file_path,
          c.mime_type,
          c.checksum,
          c.duration_seconds as content_duration
        FROM playlists p
        JOIN content c ON p.content_id = c.id
        WHERE p.device_id = ? AND c.active = true
        ORDER BY p.order_index ASC
      `, [deviceId]);

      const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
      
      return playlist.map(item => ({
        id: item.content_id,
        playlist_id: item.playlist_id,
        title: item.title,
        type: item.type,
        mime_type: item.mime_type,
        checksum: item.checksum,
        duration_seconds: item.type === 'image' 
          ? (item.playlist_duration || 10) // Default 10s for images
          : item.content_duration, // Use video duration
        url: item.file_path ? `${baseUrl}/${item.file_path}` : null,
        file_path: item.file_path
      }));
    } catch (error) {
      console.error('Get device manifest error:', error);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Update playlist order and durations
   */
  static async updatePlaylistOrder(deviceId, playlistData, tenantId) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Update each playlist item
      for (const item of playlistData.playlist) {
        await connection.execute(
          `UPDATE playlists 
           SET order_index = ?, duration_seconds = ?, updated_at = NOW()
           WHERE id = ? AND device_id = ? AND tenant_id = ?`,
          [
            item.order_index,
            item.duration_seconds,
            item.playlist_id,
            deviceId,
            tenantId
          ]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Add content to device playlist
   */
  static async addContentToPlaylist(deviceId, contentId, tenantId, duration = null) {
    try {
      // Get next order index
      const [maxOrder] = await db.execute(
        'SELECT COALESCE(MAX(order_index), -1) + 1 as next_order FROM playlists WHERE device_id = ?',
        [deviceId]
      );

      const [result] = await db.execute(
        `INSERT INTO playlists (tenant_id, device_id, content_id, order_index, duration_seconds)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, deviceId, contentId, maxOrder[0].next_order, duration]
      );

      return {
        id: result.insertId,
        order_index: maxOrder[0].next_order
      };
    } catch (error) {
      console.error('Add content to playlist error:', error);
      throw error;
    }
  }

  /**
   * Socket management
   */
  static markConnected(deviceId, socketId) {
    this.deviceSockets.set(deviceId, socketId);
    
    // Update last_seen in database
    db.execute('UPDATE devices SET last_seen = NOW() WHERE id = ?', [deviceId])
      .catch(console.error);
  }

  static markDisconnected(deviceId) {
    this.deviceSockets.delete(deviceId);
  }

  static getDeviceSocket(deviceId) {
    return this.deviceSockets.get(deviceId);
  }

  static updateLastSeen(deviceId) {
    return db.execute('UPDATE devices SET last_seen = NOW() WHERE id = ?', [deviceId]);
  }
}

export default DeviceService;