import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import DeviceService from '../services/deviceService.js';
import { validate, schemas } from '../middleware/validation.js';


const router = express.Router();

// Device registration endpoint (public - no auth required)
router.post('/register', validate(schemas.deviceRegister), async (req, res) => {
  try {
    console.log('📝 Device registration request body:', req.body);
    const { device_uuid, name, model, tenant_id } = req.body;

    const result = await DeviceService.registerDevice({
      device_uuid,
      name,
      model,
      tenant_id
    });

    // Notify admins if new device
    if (result.isNew && req.app.get('io')) {
      req.app.get('io').broadcastToAdmins('device:registered', {
        device: result.device
      });
    }

    res.status(result.isNew ? 201 : 200).json({
      success: true,
      device: result.device,
      token: result.token
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rotas públicas para dispositivos (sem autenticação)
router.post('/legacy-register', async (req, res) => {
  try {
    const { name, location, mac_address } = req.body;
    const tenantId = 1; // Default tenant for device registration

    if (!name || !location) {
      return res.status(400).json({ error: 'Nome e localização são obrigatórios' });
    }

    // Generate unique device ID
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if device with same MAC address already exists
    if (mac_address) {
      const [existing] = await db.execute(
        'SELECT device_id FROM devices WHERE mac_address = ? AND tenant_id = ?',
        [mac_address, tenantId]
      );
      
      if (existing.length > 0) {
        return res.json({
          success: true,
          message: 'Dispositivo já registrado',
          device_id: existing[0].device_id
        });
      }
    }

    // Create new device
    const [result] = await db.execute(
      `INSERT INTO devices (device_id, name, location, mac_address, tenant_id, status, created_at, last_seen) 
       VALUES (?, ?, ?, ?, ?, 'online', NOW(), NOW())`,
      [deviceId, name, location, mac_address, tenantId]
    );

    res.status(201).json({
      success: true,
      message: 'Dispositivo registrado com sucesso',
      device_id: deviceId
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Device registration endpoint (alternative route for compatibility)
router.post('/device/register', async (req, res) => {
  try {
    const { deviceId, name, location, mac_address } = req.body;
    const tenantId = 1; // Default tenant for device registration

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID é obrigatório' });
    }

    // Check if device already exists
    const [existing] = await db.execute(
      'SELECT device_id FROM devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );
    
    if (existing.length > 0) {
      // Update existing device
      await db.execute(
        'UPDATE devices SET name = ?, location = ?, last_seen = NOW() WHERE device_id = ? AND tenant_id = ?',
        [name || 'Dispositivo', location || 'Não especificado', deviceId, tenantId]
      );
      
      return res.json({
        success: true,
        message: 'Dispositivo atualizado com sucesso',
        device_id: deviceId
      });
    }

    // Create new device
    const [result] = await db.execute(
      `INSERT INTO devices (device_id, name, location, mac_address, tenant_id, status, created_at, last_seen) 
       VALUES (?, ?, ?, ?, ?, 'online', NOW(), NOW())`,
      [deviceId, name || 'Dispositivo', location || 'Não especificado', mac_address || null, tenantId]
    );

    res.status(201).json({
      success: true,
      message: 'Dispositivo registrado com sucesso',
      device: {
        id: result.insertId,
        device_id: deviceId,
        name: name || 'Dispositivo',
        location: location || 'Não especificado',
        status: 'online',
        tenant_id: tenantId
      }
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get device status (public route)
router.get('/:deviceId/status', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const [devices] = await db.execute(
      'SELECT status, name, location FROM devices WHERE device_id = ?',
      [deviceId]
    );
    
    if (devices.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }
    
    res.json({
      status: devices[0].status,
      name: devices[0].name,
      location: devices[0].location
    });
  } catch (error) {
    console.error('Device status error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get device playlist (PUBLIC - for TVBoxes)
router.get('/:deviceId/playlist', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Verify device exists
    const [devices] = await db.execute(
      'SELECT status FROM devices WHERE device_id = ?',
      [deviceId]
    );

    if (devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo não encontrado'
      });
    }

    if (devices[0].status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Dispositivo bloqueado'
      });
    }

    // Get playlist items using DeviceService
    const manifest = await DeviceService.getDeviceManifest(deviceId);

    res.json({
      success: true,
      deviceId: deviceId,
      items: manifest,
      version: manifest.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Get device info (for client app) - Public route
router.get('/:deviceId/info', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const [devices] = await db.execute(
      'SELECT device_id, name, location, status, last_seen, created_at FROM devices WHERE device_id = ?',
      [deviceId]
    );

    if (devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo não encontrado'
      });
    }

    const device = devices[0];
    res.json({
      success: true,
      device: {
        deviceId: device.device_id,
        name: device.name,
        location: device.location,
        status: device.status,
        lastSeen: device.last_seen,
        createdAt: device.created_at
      }
    });

  } catch (error) {
    console.error('Get device info error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Aplicar middleware de autenticação nas demais rotas
router.use(authenticateToken);

// Get all devices
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || 1;
    const [devices] = await db.execute(
      'SELECT device_id, name, location, status, last_seen, created_at FROM devices WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );

    res.json(devices.map(device => ({
      id: device.device_id,
      nome: device.name,
      localizacao: device.location || 'N/A',
      tipo: 'TV Box',
      status: device.status === 'online' ? 'online' : 'offline',
      ultima_atividade: device.last_seen,
      created_at: device.created_at
    })));
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Update device status
router.put('/:deviceId/status', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status } = req.body;
    const tenantId = req.user?.tenant_id || 1;

    await db.execute(
      'UPDATE devices SET status = ?, last_seen = NOW() WHERE device_id = ? AND tenant_id = ?',
      [status, deviceId, tenantId]
    );

    res.json({ success: true, message: 'Status atualizado com sucesso' });
  } catch (error) {
    console.error('Update device status error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get device details
router.get('/:deviceId', validate(schemas.deviceId, 'params'), async (req, res) => {
  try {
    const { deviceId } = req.params;

    const tenantId = req.user?.tenant_id || 1;
    const [devices] = await db.execute(
      'SELECT device_id, name, status, last_seen FROM devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );

    if (devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo não encontrado'
      });
    }

    const device = devices[0];
    res.json({
      success: true,
      deviceId: device.device_id,
      name: device.name,
      status: device.status,
      lastSeen: device.last_seen
    });

  } catch (error) {
    console.error('Get device status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});



// Get device playlist (AUTHENTICATED - for admin)
router.get('/:deviceId/playlist/admin', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const tenantId = req.user?.tenant_id || 'default';

    // Verify device exists and belongs to tenant
    const [devices] = await db.execute(
      'SELECT status FROM devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );

    if (devices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo não encontrado'
      });
    }

    // Get playlist items using DeviceService
    const manifest = await DeviceService.getDeviceManifest(deviceId);

    res.json({
      success: true,
      deviceId: deviceId,
      items: manifest,
      version: manifest.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get playlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Log device events (heartbeat, playback, errors)
router.post('/:deviceId/events', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { type, data } = req.body;

    if (!['heartbeat', 'playback', 'error'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de evento inválido'
      });
    }

    // Log event
    await db.execute(
      'INSERT INTO device_logs (device_id, event_type, data) VALUES (?, ?, ?)',
      [deviceId, type, JSON.stringify(data)]
    );

    // Update device last seen for heartbeat
    if (type === 'heartbeat') {
      await db.execute(
        'UPDATE devices SET last_seen = CURRENT_TIMESTAMP WHERE device_id = ?',
        [deviceId]
      );
    }

    res.json({
      success: true,
      message: 'Evento registrado com sucesso'
    });

  } catch (error) {
    console.error('Log event error:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Update device
router.put('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { name, location } = req.body;
    const tenantId = req.user?.tenant_id || 1;

    if (!name || !location) {
      return res.status(400).json({ error: 'Nome e localização são obrigatórios' });
    }

    // Check if device exists
    const [existing] = await db.execute(
      'SELECT id FROM devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    // Update device
    await db.execute(
      'UPDATE devices SET name = ?, location = ?, updated_at = NOW() WHERE device_id = ? AND tenant_id = ?',
      [name, location, deviceId, tenantId]
    );

    res.json({
      success: true,
      message: 'Dispositivo atualizado com sucesso'
    });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Delete device
router.delete('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const tenantId = req.user?.tenant_id || 1;

    // Check if device exists
    const [existing] = await db.execute(
      'SELECT id FROM devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    // Delete device logs first (foreign key constraint)
    await db.execute(
      'DELETE FROM device_logs WHERE device_id = ?',
      [deviceId]
    );

    // Delete device
    await db.execute(
      'DELETE FROM devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );

    res.json({
      success: true,
      message: 'Dispositivo removido com sucesso'
    });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Device power control
router.post('/:deviceId/power', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action } = req.body;
    const tenantId = req.user?.tenant_id || 1;

    if (!['restart', 'shutdown'].includes(action)) {
      return res.status(400).json({ error: 'Ação inválida. Use: restart ou shutdown' });
    }

    // Check if device exists
    const [devices] = await db.execute(
      'SELECT device_id, name, status FROM devices WHERE device_id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );
    
    if (devices.length === 0) {
      return res.status(404).json({ error: 'Dispositivo não encontrado' });
    }

    const device = devices[0];

    // Log the power action
    await db.execute(
      'INSERT INTO device_logs (device_id, event_type, message, data) VALUES (?, ?, ?, ?)',
      [
        deviceId, 
        'power_control', 
        `Comando ${action} enviado para ${device.name}`,
        JSON.stringify({ action, timestamp: new Date().toISOString() })
      ]
    );

    // Update device status based on action
    const newStatus = action === 'shutdown' ? 'offline' : 'online';
    await db.execute(
      'UPDATE devices SET status = ?, updated_at = NOW() WHERE device_id = ? AND tenant_id = ?',
      [newStatus, deviceId, tenantId]
    );

    // Broadcast power command to device via WebSocket if available
    try {
      const { broadcastToDevice } = await import('../websocket/socketHandler.js');
      broadcastToDevice(deviceId, {
        type: 'power_control',
        action: action,
        timestamp: new Date().toISOString()
      });
    } catch (wsError) {
      console.log('WebSocket not available for power control:', wsError.message);
    }

    res.json({
      success: true,
      message: `Comando ${action} enviado com sucesso`,
      device_id: deviceId,
      action: action,
      new_status: newStatus
    });
  } catch (error) {
    console.error('Power control error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;