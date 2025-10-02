import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface DeviceStatusUpdate {
  device_id: string;
  status: 'online' | 'offline';
  timestamp: string;
  last_seen?: string;
}

interface DeviceConnectionEvent {
  device_id: string;
  device_uuid?: string;
  last_seen: string;
}

export const useAdminWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Connect to admin namespace
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
    const socket = io(`${wsUrl}/admin`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Admin WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Admin WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Admin WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Listen for device status updates
    socket.on('device:status', (data: DeviceStatusUpdate) => {
      console.log('Device status update:', data);
      
      // Update devices query cache
      queryClient.setQueryData(['devices'], (oldData: any) => {
        if (!oldData) return oldData;
        
        const devices = Array.isArray(oldData) ? oldData : oldData.data || [];
        return devices.map((device: any) => {
          if (device.id === data.device_id) {
            return {
              ...device,
              status: data.status,
              ultima_atividade: data.timestamp,
              last_seen: data.last_seen || data.timestamp
            };
          }
          return device;
        });
      });
    });

    // Listen for device connections
    socket.on('device:connected', (data: DeviceConnectionEvent) => {
      console.log('Device connected:', data);
      
      // Update devices query cache
      queryClient.setQueryData(['devices'], (oldData: any) => {
        if (!oldData) return oldData;
        
        const devices = Array.isArray(oldData) ? oldData : oldData.data || [];
        return devices.map((device: any) => {
          if (device.id === data.device_id) {
            return {
              ...device,
              status: 'online',
              ultima_atividade: data.last_seen,
              last_seen: data.last_seen
            };
          }
          return device;
        });
      });
      
      toast.success(`Dispositivo ${data.device_id} conectado`);
    });

    // Listen for device disconnections
    socket.on('device:disconnected', (data: { device_id: string; reason: string; timestamp: string }) => {
      console.log('Device disconnected:', data);
      
      // Update devices query cache
      queryClient.setQueryData(['devices'], (oldData: any) => {
        if (!oldData) return oldData;
        
        const devices = Array.isArray(oldData) ? oldData : oldData.data || [];
        return devices.map((device: any) => {
          if (device.id === data.device_id) {
            return {
              ...device,
              status: 'offline',
              ultima_atividade: data.timestamp,
              last_seen: data.timestamp
            };
          }
          return device;
        });
      });
      
      toast.error(`Dispositivo ${data.device_id} desconectado`);
    });

    // Listen for device errors
    socket.on('device:error', (data: { device_id: string; error: string; timestamp: string }) => {
      console.error('Device error:', data);
      
      // Update devices query cache
      queryClient.setQueryData(['devices'], (oldData: any) => {
        if (!oldData) return oldData;
        
        const devices = Array.isArray(oldData) ? oldData : oldData.data || [];
        return devices.map((device: any) => {
          if (device.id === data.device_id) {
            return {
              ...device,
              status: 'erro',
              ultima_atividade: data.timestamp,
              last_seen: data.timestamp
            };
          }
          return device;
        });
      });
      
      toast.error(`Erro no dispositivo ${data.device_id}: ${data.error}`);
    });

    // Listen for playback events
    socket.on('device:playback', (data: any) => {
      console.log('Device playback event:', data);
      // Could be used for real-time playback monitoring
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [queryClient]);

  const sendCommand = (deviceId: string, command: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('device:command', {
        device_id: deviceId,
        command
      });
    }
  };

  return {
    isConnected,
    sendCommand
  };
};