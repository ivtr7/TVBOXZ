import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

// Importar configuração do banco de dados
import { initializeDatabase } from './config/database.js';

// Importar middlewares
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { 
  initBruteForceProtection, 
  scheduleBruteForceCleanup 
} from './middleware/bruteForceProtection.js';
import { scheduleRefreshTokenCleanup } from './middleware/refreshToken.js';
import {
  advancedSecurityHeaders,
  enforceHTTPS,
  customSecurityHeaders,
  validateOrigin,
  detectSuspiciousRequests,
  securityLogger
} from './middleware/httpsEnforcement.js';

// Importar rotas
import authRoutes from './routes/auth.js';
import devicesRoutes from './routes/devices.js';
import deviceFilesRoutes from './routes/deviceFiles.js';
import playlistsRoutes from './routes/playlists.js';
import playerRoutes from './routes/player.js';
import systemRoutes from './routes/system.js';
import announcementsRoutes from './routes/announcements.js';

// Importar WebSocket
import { setupSocketIO } from './websocket/socketHandler.js';

// Configurar variáveis de ambiente
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5174",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware de segurança avançado
app.use(enforceHTTPS);
app.use(advancedSecurityHeaders);
app.use(customSecurityHeaders);
app.use(securityLogger);
app.use(detectSuspiciousRequests);

// CORS com validação de origem
app.use(validateOrigin);
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
      process.env.ALLOWED_ORIGINS.split(',') : 
      ['http://localhost:5174', 'http://localhost:3000'];
    
    // Permitir requisições sem origem em desenvolvimento
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'X-Refresh-Token',
    'X-Request-ID',
    'Cache-Control'
  ],
  exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining']
}));

// Rate limiting
app.use(rateLimiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Registrar rotas
app.use('/api/auth', authRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/device-files', deviceFilesRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/announcements', announcementsRoutes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({ 
    message: 'TVBOX Control System API',
    version: '1.0.0',
    status: 'running'
  });
});

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Inicializar WebSocket e armazenar referência
const { devicesNS, adminNS, broadcastToDevice, broadcastToAdmins } = setupSocketIO(io);

// Store io instance in app for access in routes
app.set('io', io);

// Inicializar proteções de segurança
const initSecurity = async () => {
  try {
    await initBruteForceProtection();
    scheduleBruteForceCleanup();
    scheduleRefreshTokenCleanup();
    // Proteções de segurança inicializadas
  } catch (error) {
    console.error('❌ Erro ao inicializar proteções de segurança:', error);
  }
};

// Função para inicializar o servidor
async function startServer() {
  try {
    // Iniciando servidor TVBOX

// Conectar ao banco de dados
    await initializeDatabase();
    
    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`✅ Servidor TVBOX rodando na porta ${PORT}`);
      console.log(`🌐 API: http://localhost:${PORT}`);
      
      // Inicializar segurança de forma assíncrona
      initSecurity().then(() => {
        console.log('✅ Proteções de segurança inicializadas');
      }).catch(error => {
        console.error('❌ Erro ao inicializar segurança:', error);
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Modo de desenvolvimento ativo');
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao inicializar servidor:', error);
    process.exit(1);
  }
}

// Tratamento de sinais do sistema
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado graciosamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado graciosamente');
    process.exit(0);
  });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  process.exit(1);
});

// Inicializar servidor
startServer();

export default app;