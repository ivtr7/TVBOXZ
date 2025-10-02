import express from 'express';
import jwt from 'jsonwebtoken';
import DeviceService from '../services/deviceService.js';

const router = express.Router();

// Middleware to authenticate device token
const authenticateDevice = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET_DEVICE || process.env.JWT_SECRET);
    
    if (payload.role !== 'device') {
      return res.status(403).json({
        success: false,
        error: 'Invalid token role'
      });
    }

    req.device = {
      id: payload.device_id,
      uuid: payload.device_uuid,
      tenant_id: payload.tenant_id
    };

    next();
  } catch (error) {
    console.error('Device auth error:', error);
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// Get device manifest/playlist
router.get('/:deviceId/manifest', authenticateDevice, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Verify device ID matches token
    if (parseInt(deviceId) !== req.device.id) {
      return res.status(403).json({
        success: false,
        error: 'Device ID mismatch'
      });
    }

    const manifest = await DeviceService.getDeviceManifest(deviceId);

    res.json({
      success: true,
      data: manifest,
      device_id: parseInt(deviceId),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get manifest error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get device manifest'
    });
  }
});

export default router;