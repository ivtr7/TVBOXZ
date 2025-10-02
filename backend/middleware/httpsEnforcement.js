import helmet from 'helmet';

// Configuração avançada de segurança com Helmet
export const advancedSecurityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      mediaSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // Para desenvolvimento React
      connectSrc: ["'self'", "ws:", "wss:"], // Para WebSockets
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    },
    reportOnly: process.env.NODE_ENV === 'development'
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000, // 1 ano
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Permissions Policy
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    magnetometer: [],
    gyroscope: [],
    accelerometer: []
  },
  
  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false, // Desabilitado para compatibilidade
  
  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  }
});

// Middleware para forçar HTTPS em produção
export const enforceHTTPS = (req, res, next) => {
  // Apenas em produção
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Verificar se a requisição já é HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }
  
  // Redirecionar para HTTPS
  const httpsUrl = `https://${req.get('host')}${req.originalUrl}`;
  return res.redirect(301, httpsUrl);
};

// Middleware para adicionar headers de segurança customizados
export const customSecurityHeaders = (req, res, next) => {
  // X-Powered-By (remover informações do servidor)
  res.removeHeader('X-Powered-By');
  
  // Server header customizado
  res.setHeader('Server', 'TVBox-RPA');
  
  // X-Request-ID para rastreamento
  const requestId = req.headers['x-request-id'] || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', requestId);
  req.requestId = requestId;
  
  // Cache-Control para APIs
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Headers específicos para uploads
  if (req.path.includes('/upload')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  }
  
  // Headers para WebSocket
  if (req.headers.upgrade === 'websocket') {
    res.setHeader('X-WebSocket-Security', 'enabled');
  }
  
  next();
};

// Middleware para validar origem das requisições
export const validateOrigin = (req, res, next) => {
  const origin = req.get('Origin') || req.get('Referer');
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : 
    ['http://localhost:5174', 'http://localhost:3000'];
  
  // Permitir requisições sem origem (Postman, curl, etc.) apenas em desenvolvimento
  if (!origin && process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // Verificar se a origem está na lista permitida
  if (origin) {
    const originUrl = new URL(origin);
    const isAllowed = allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed);
        return originUrl.hostname === allowedUrl.hostname && 
               originUrl.port === allowedUrl.port;
      } catch {
        return false;
      }
    });
    
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Origem não permitida',
        request_id: req.requestId
      });
    }
  }
  
  next();
};

// Middleware para detectar e bloquear requisições suspeitas
export const detectSuspiciousRequests = (req, res, next) => {
  const suspiciousPatterns = [
    // SQL Injection patterns
    /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
    // XSS patterns
    /(<script[^>]*>.*?<\/script>)|(<iframe[^>]*>.*?<\/iframe>)/i,
    // Path traversal
    /(\.\.[\/\\])|(\.\.\.)/,
    // Command injection
    /(\||&|;|\$|`|>|<)/,
    // Common attack tools
    /(sqlmap|nikto|nmap|masscan|burp|owasp)/i
  ];
  
  // Verificar URL, query parameters e body
  const checkString = `${req.originalUrl} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(checkString));
  
  if (isSuspicious) {
    console.warn(`🚨 Requisição suspeita detectada:`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      requestId: req.requestId
    });
    
    return res.status(400).json({
      success: false,
      error: 'Requisição inválida',
      request_id: req.requestId
    });
  }
  
  next();
};

// Middleware para logging de segurança
export const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log da requisição
  const logData = {
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    referer: req.get('Referer')
  };
  
  // Interceptar resposta para log
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log apenas em caso de erro ou requisições suspeitas
    if (res.statusCode >= 400 || duration > 5000) {
      console.log('🔒 Security Log:', {
        ...logData,
        statusCode: res.statusCode,
        duration,
        responseSize: data ? data.length : 0
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

export default {
  advancedSecurityHeaders,
  enforceHTTPS,
  customSecurityHeaders,
  validateOrigin,
  detectSuspiciousRequests,
  securityLogger
};