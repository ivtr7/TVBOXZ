import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import DeviceService from '../services/deviceService.js';
import db from '../config/database.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Reorder device playlist
router.post('/device/:deviceId/reorder', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { playlist } = req.body;
    const tenantId = req.user?.tenant_id || 1;

    if (!playlist || !Array.isArray(playlist)) {
      return res.status(400).json({
        success: false,
        error: 'playlist array is required'
      });
    }

    // Validate and sanitize durations for images
    const sanitizedPlaylist = playlist.map(item => ({
      ...item,
      duration_seconds: item.duration_seconds 
        ? (item.duration_seconds || 10)
        : item.duration_seconds
    }));

    await DeviceService.updatePlaylistOrder(deviceId, { playlist: sanitizedPlaylist }, tenantId);

    // Get updated manifest
    const manifest = await DeviceService.getDeviceManifest(deviceId);

    // Broadcast update to device
    if (req.app.get('io')) {
      req.app.get('io').broadcastToDevice(parseInt(deviceId), 'playlist:update', {
        device_id: parseInt(deviceId),
        manifest
      });
    }

    res.json({
      success: true,
      message: 'Playlist updated successfully'
    });
  } catch (error) {
    console.error('Reorder playlist error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get device playlist
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    // Get device content from playlists
    const [content] = await db.execute(`
      SELECT 
        c.id,
        c.title,
        c.type,
        c.file_path,
        p.order_index,
        p.duration_seconds
      FROM content c
      LEFT JOIN playlists p ON c.id = p.content_id AND p.device_id = ?
      WHERE c.active = true AND c.tenant_id = ?
      ORDER BY p.order_index ASC
    `, [deviceId, req.user.tenant_id]);

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Get device playlist error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add content to device playlist
router.post('/device/:deviceId/content', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { content_id, duration_seconds } = req.body;
    const tenantId = req.user?.tenant_id || 1;

    if (!content_id) {
      return res.status(400).json({
        success: false,
        error: 'content_id is required'
      });
    }

    // Validate duration for images
    const validatedDuration = duration_seconds 
      ? (duration_seconds || 10)
      : null;

    const playlistEntry = await DeviceService.addContentToPlaylist(
      deviceId, 
      content_id, 
      tenantId, 
      validatedDuration
    );

    // Get updated manifest
    const manifest = await DeviceService.getDeviceManifest(deviceId);

    // Broadcast update to device
    if (req.app.get('io')) {
      req.app.get('io').broadcastToDevice(parseInt(deviceId), 'playlist:update', {
        device_id: parseInt(deviceId),
        manifest
      });
    }

    res.json({
      success: true,
      playlist_entry: playlistEntry
    });
  } catch (error) {
    console.error('Add content to playlist error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove content from device playlist
router.delete('/device/:deviceId/content/:playlistId', async (req, res) => {
  try {
    const { deviceId, playlistId } = req.params;
    const tenantId = req.user?.tenant_id || 1;

    // Remove from playlist
    await db.execute(
      'DELETE FROM playlists WHERE id = ? AND device_id = ? AND tenant_id = ?',
      [playlistId, deviceId, tenantId]
    );

    // Get updated manifest
    const manifest = await DeviceService.getDeviceManifest(deviceId);

    // Broadcast update to device
    if (req.app.get('io')) {
      req.app.get('io').broadcastToDevice(parseInt(deviceId), 'playlist:update', {
        device_id: parseInt(deviceId),
        manifest
      });
    }

    res.json({
      success: true,
      message: 'Content removed from playlist'
    });
  } catch (error) {
    console.error('Remove content from playlist error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;