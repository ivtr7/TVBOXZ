import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import db from '../config/database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para garantir que o diretório do dispositivo existe
const ensureDeviceDirectory = async (deviceId) => {
  const deviceDir = path.join(__dirname, '..', 'uploads', `device_${deviceId}`);
  try {
    await fs.mkdir(deviceDir, { recursive: true });
    return deviceDir;
  } catch (error) {
    throw error;
  }
};
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const deviceId = req.params.deviceId || req.body.deviceId;
    
    try {
      const uploadPath = await ensureDeviceDirectory(deviceId);
      cb(null, uploadPath);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${timestamp}_${name}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/mov'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado'), false);
    }
  }
});

// Listar arquivos de um dispositivo
router.get('/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const devicePath = path.join(__dirname, '..', 'uploads', `device_${deviceId}`);
    
    if (!fsSync.existsSync(devicePath)) {
      return res.json([]);
    }
    
    const files = await fs.readdir(devicePath);
    const fileList = [];
    
    for (const file of files) {
      const filePath = path.join(devicePath, file);
      const stats = await fs.stat(filePath);
      
      fileList.push({
        id: file,
        name: file,
        size: stats.size,
        type: path.extname(file).toLowerCase(),
        uploadDate: stats.birthtime,
        order: 0
      });
    }
    
    res.json(fileList);
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get files for a device
router.get('/:deviceId/files', async (req, res) => {
  console.log('GET /device-files/:deviceId/files called with deviceId:', req.params.deviceId);
  try {
    const { deviceId } = req.params;

    // Verify device exists
    const [deviceCheck] = await db.execute(
      'SELECT id FROM devices WHERE id = ?',
      [deviceId]
    );

    if (deviceCheck.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Get device files
    const [files] = await db.execute(
      `SELECT id, name, type, size, file_path, order_index as \`order\`, created_at 
       FROM device_files 
       WHERE device_id = ? 
       ORDER BY order_index ASC`,
      [deviceId]
    );

    // Add URL for each file
    const filesWithUrls = files.map(file => ({
      ...file,
      url: `/api/device-files/${deviceId}/files/${file.id}/download`
    }));

    res.json({ files: filesWithUrls });
  } catch (error) {
    console.error('Get device files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload file to device
router.post('/:deviceId/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { deviceId } = req.params;
    const tenantId = req.user.tenant_id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify device belongs to tenant
    const [deviceCheck] = await db.execute(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );

    if (deviceCheck.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Get next order index
    const [maxOrder] = await db.execute(
      'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM device_files WHERE device_id = ?',
      [deviceId]
    );

    // Determine file type
    const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';

    // Insert file record
    const [result] = await db.execute(
      `INSERT INTO device_files (device_id, tenant_id, name, type, size, file_path, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        tenantId,
        file.originalname,
        fileType,
        file.size,
        file.path,
        maxOrder[0].next_order
      ]
    );

    // Get the created file
    const [createdFile] = await db.execute(
      'SELECT * FROM device_files WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        ...createdFile[0],
        url: `/api/devices/${deviceId}/files/${result.insertId}/download`
      }
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download file
router.get('/:deviceId/files/:fileId/download', async (req, res) => {
  try {
    const { deviceId, fileId } = req.params;

    // Get file info
    const [files] = await db.execute(
      'SELECT * FROM device_files WHERE id = ? AND device_id = ?',
      [fileId, deviceId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];
    
    // Check if file exists
    try {
      await fs.access(file.file_path);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', file.type === 'video' ? 'video/mp4' : 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    
    // Send file
    res.sendFile(path.resolve(file.file_path));
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deletar arquivo
router.delete('/:deviceId/:filename', authenticateToken, async (req, res) => {
  try {
    const { deviceId, filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', `device_${deviceId}`, filename);
    
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
      res.json({ success: true, message: 'Arquivo deletado com sucesso' });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Delete file
router.delete('/:deviceId/files/:fileId', authenticateToken, async (req, res) => {
  try {
    const { deviceId, fileId } = req.params;
    const tenantId = req.user.tenant_id;

    // Get file info
    const [files] = await db.execute(
      'SELECT * FROM device_files WHERE id = ? AND device_id = ? AND tenant_id = ?',
      [fileId, deviceId, tenantId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Delete file from database
    await db.execute(
      'DELETE FROM device_files WHERE id = ? AND device_id = ? AND tenant_id = ?',
      [fileId, deviceId, tenantId]
    );

    // Delete physical file
    try {
      await fs.unlink(file.file_path);
    } catch (error) {
      console.warn('Could not delete physical file:', error.message);
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder files
router.put('/:deviceId/files/reorder', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { order } = req.body;
    const tenantId = req.user.tenant_id;

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    // Verify device belongs to tenant
    const [deviceCheck] = await db.execute(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );

    if (deviceCheck.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Update order for each file
    for (const item of order) {
      await db.execute(
        'UPDATE device_files SET order_index = ? WHERE id = ? AND device_id = ? AND tenant_id = ?',
        [item.order, item.fileId, deviceId, tenantId]
      );
    }

    res.json({ message: 'Files reordered successfully' });
  } catch (error) {
    console.error('Reorder files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download file
router.get('/:deviceId/download/:filename', async (req, res) => {
  try {
    const { deviceId, filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', `device_${deviceId}`, filename);
    
    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Force update device
router.post('/:deviceId/force-update', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const tenantId = req.user.tenant_id;

    // Verify device belongs to tenant
    const [deviceCheck] = await db.execute(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [deviceId, tenantId]
    );

    if (deviceCheck.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Here you would typically send a WebSocket message to the device
    // For now, we'll just return success
    res.json({ message: 'Force update sent to device' });
  } catch (error) {
    console.error('Force update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;