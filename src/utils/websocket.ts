import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

// Função de conveniência para conectar ao WebSocket
export const connectWebSocket = () => {
  const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
  
  const socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  return socket;
};