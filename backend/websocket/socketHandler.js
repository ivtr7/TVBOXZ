import jwt from 'jsonwebtoken';
import DeviceService from '../services/deviceService.js';

export const setupSocketIO = (io) => {
  // Create namespaces
  const devicesNS = io.of('/devices');
  const adminNS = io.of('/admin');

  // Device namespace authentication
  devicesNS.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (!token) {
        return next(new Error('No token provided'));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET_DEVICE || process.env.JWT_SECRET);
      
      if (payload.role !== 'device') {
        return next(new Error('Invalid token role'));
      }

      socket.data.deviceId = payload.device_id;
      socket.data.deviceUuid = payload.device_uuid;
      socket.data.tenantId = payload.tenant_id;
      
      return next();
    } catch (err) {
      console.error('Device socket auth error:', err);
      return next(new Error('Unauthorized'));
    }
  });

  // Admin namespace authentication
  adminNS.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (!token) {
        return next(new Error('No token provided'));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET || process.env.JWT_SECRET_ADMIN);
      
      if (payload.role !== 'admin' && payload.role !== 'user') {
        return next(new Error('Invalid token role'));
      }

      socket.data.userId = payload.userId;
      socket.data.tenantId = payload.tenant_id;
      
      return next();
    } catch (err) {
      console.error('Admin socket auth error:', err);
      return next(new Error('Unauthorized'));
    }
  });

  // Device connections
  devicesNS.on('connection', async (socket) => {
    const deviceId = socket.data.deviceId;
    const deviceUuid = socket.data.deviceUuid;
    
    // Device connected
    
    // Register device socket
    DeviceService.markConnected(deviceId, socket.id);
    
    // Notify admins
    adminNS.emit('device:connected', {
      device_id: deviceId,
      device_uuid: deviceUuid,
      last_seen: new Date().toISOString()
    });

    // Handle heartbeat
    socket.on('heartbeat', async (data) => {
      try {
        await DeviceService.updateLastSeen(deviceId);
        
        // Broadcast device status to admins
        adminNS.emit('device:status', {
          device_id: deviceId,
          status: 'online',
          ...data,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    });

    // Handle playback events
    socket.on('playback:event', (data) => {
      adminNS.emit('device:playback', {
        device_id: deviceId,
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    // Handle errors
    socket.on('error:report', (data) => {
      console.error(`Device ${deviceId} error:`, data);
      adminNS.emit('device:error', {
        device_id: deviceId,
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      // Device disconnected
      DeviceService.markDisconnected(deviceId);
      
      adminNS.emit('device:disconnected', {
        device_id: deviceId,
        reason,
        timestamp: new Date().toISOString()
      });
    });
  });

  // Admin connections
  adminNS.on('connection', (socket) => {
    const userId = socket.data.userId;
    // Admin connected

    socket.emit('admin:connected', {
      message: 'Connected to admin namespace',
      timestamp: new Date().toISOString()
    });

    // Handle admin commands
    socket.on('device:command', async (data) => {
      const { device_id, command } = data;
      
      try {
        const deviceSocketId = DeviceService.getDeviceSocket(device_id);
        
        if (deviceSocketId) {
          const deviceSocket = devicesNS.sockets.get(deviceSocketId);
          if (deviceSocket) {
            deviceSocket.emit('command', command);
            socket.emit('command:sent', { device_id, success: true });
          } else {
            socket.emit('command:sent', { device_id, success: false, error: 'Device socket not found' });
          }
        } else {
          socket.emit('command:sent', { device_id, success: false, error: 'Device not connected' });
        }
      } catch (error) {
        console.error('Device command error:', error);
        socket.emit('command:sent', { device_id, success: false, error: error.message });
      }
    });

    socket.on('disconnect', (reason) => {
      // Admin disconnected
    });
  });

  // Utility functions for broadcasting
  const broadcastToDevice = (deviceId, event, data) => {
    const deviceSocketId = DeviceService.getDeviceSocket(deviceId);
    if (deviceSocketId) {
      const deviceSocket = devicesNS.sockets.get(deviceSocketId);
      if (deviceSocket) {
        deviceSocket.emit(event, data);
        return true;
      }
    }
    return false;
  };

  const broadcastToAdmins = (event, data) => {
    adminNS.emit(event, data);
  };

  // Export broadcast functions
  io.broadcastToDevice = broadcastToDevice;
  io.broadcastToAdmins = broadcastToAdmins;

  return { devicesNS, adminNS, broadcastToDevice, broadcastToAdmins };
};