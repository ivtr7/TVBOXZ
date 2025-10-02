import express from 'express';
import bcrypt from 'bcryptjs';

import { db } from '../config/database.js';

const router = express.Router();

// Get system status
router.get('/status', async (req, res) => {
  try {
    const status = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        timestamp: new Date().toISOString()
      },
      database: {
        connected: true,
        lastChecked: new Date().toISOString()
      }
    };

    // Test database connection
    try {
      await db.execute('SELECT 1');
    } catch (error) {
      status.database.connected = false;
      status.database.error = error.message;
    }

    res.json({ status });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system logs
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 100, level, startDate, endDate } = req.query;
    
    // Demo system logs data
    const demoLogs = [
      { id: 1, level: 'info', message: 'Sistema iniciado com sucesso', created_at: new Date().toISOString() },
      { id: 2, level: 'info', message: 'Conexão com banco de dados estabelecida', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 3, level: 'warning', message: 'Dispositivo TV-003 desconectado', created_at: new Date(Date.now() - 7200000).toISOString() },

      { id: 5, level: 'error', message: 'Falha ao carregar conteúdo ID: 123', created_at: new Date(Date.now() - 14400000).toISOString() }
    ];
    
    // Filter logs based on parameters
    let filteredLogs = demoLogs;
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    const total = filteredLogs.length;
    const startIndex = (page - 1) * limit;
    const logs = filteredLogs.slice(startIndex, startIndex + limit);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get system logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit logs
router.get('/audit', async (req, res) => {
  try {
    const { page = 1, limit = 100, userId, action, startDate, endDate } = req.query;
    
    // Demo audit logs data
    const demoLogs = [
      { id: 1, user_id: 1, action: 'login', resource_type: 'user', created_at: new Date().toISOString(), user: { id: 1, email: 'admin@oricontrol.com', first_name: 'Admin', last_name: 'User' } },

      { id: 3, user_id: 2, action: 'upload_content', resource_type: 'content', created_at: new Date(Date.now() - 3600000).toISOString(), user: { id: 2, email: 'user@oricontrol.com', first_name: 'Regular', last_name: 'User' } },
      { id: 4, user_id: 1, action: 'update_device', resource_type: 'device', created_at: new Date(Date.now() - 5400000).toISOString(), user: { id: 1, email: 'admin@oricontrol.com', first_name: 'Admin', last_name: 'User' } },
      { id: 5, user_id: 2, action: 'delete_playlist', resource_type: 'playlist', created_at: new Date(Date.now() - 7200000).toISOString(), user: { id: 2, email: 'user@oricontrol.com', first_name: 'Regular', last_name: 'User' } }
    ];
    
    // Filter logs based on parameters
    let filteredLogs = demoLogs;
    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.user_id.toString() === userId);
    }
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }
    
    const total = filteredLogs.length;
    const startIndex = (page - 1) * limit;
    const logs = filteredLogs.slice(startIndex, startIndex + limit);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tenant settings
router.get('/settings', async (req, res) => {
  try {
    // Demo tenant settings
    const settings = {
      branding: {
        logo: '/assets/ori-control-logo.png',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        companyName: 'ORI.CONTROL'
      },
      features: {
        analytics: true,
        multiTenant: true,
        advancedScheduling: true,
        contentManagement: true
      },
      limits: {
        maxDevices: 50,
        maxUsers: 10,
        storageGB: 100
      },
      integrations: {
        email: true,
        sms: false,
        webhook: true
      }
    };

    res.json({ settings });
  } catch (error) {
    console.error('Get tenant settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update tenant settings
router.put('/settings', async (req, res) => {
  try {
    const { branding, features, limits, integrations } = req.body;

    // In a real implementation, this would update the database
    const settings = {
      id: 1,
      tenant_id: req.user?.tenant_id || 1,
      branding,
      features,
      limits,
      integrations,
      updated_at: new Date().toISOString()
    };

    // Demo response - settings updated successfully
    res.json({ message: 'Configurações atualizadas com sucesso', settings });
  } catch (error) {
    console.error('Update tenant settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System maintenance
router.post('/maintenance', async (req, res) => {
  try {
    const { action, parameters = {} } = req.body;

    let result;
    switch (action) {
      case 'clear_cache':
        // Demo cache clearing
        result = { message: 'Cache limpo com sucesso' };
        break;
      case 'cleanup_logs':
        // Demo log cleanup
        const daysToKeep = parameters.days || 30;
        result = { message: `Logs mais antigos que ${daysToKeep} dias foram removidos` };
        break;
      case 'rebuild_indexes':
        // Demo database maintenance
        result = { message: 'Índices do banco de dados reconstruídos com sucesso' };
        break;
      default:
        return res.status(400).json({ error: 'Ação de manutenção inválida' });
    }

    // Demo response - maintenance completed
    console.log(`Manutenção realizada: ${action}`, { parameters, performedBy: req.user?.id });

    res.json(result);
  } catch (error) {
    console.error('System maintenance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



export default router;