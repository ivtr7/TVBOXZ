import { db } from '../config/database.js';

// Configurações de proteção
const BRUTE_FORCE_CONFIG = {
  // Tentativas de login
  LOGIN_ATTEMPTS: {
    MAX_ATTEMPTS: 5,
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    BLOCK_DURATION_MS: 30 * 60 * 1000, // 30 minutos
  },
  
  // Tentativas por IP
  IP_ATTEMPTS: {
    MAX_ATTEMPTS: 20,
    WINDOW_MS: 60 * 60 * 1000, // 1 hora
    BLOCK_DURATION_MS: 2 * 60 * 60 * 1000, // 2 horas
  },
  
  // Tentativas de registro
  REGISTER_ATTEMPTS: {
    MAX_ATTEMPTS: 3,
    WINDOW_MS: 60 * 60 * 1000, // 1 hora
    BLOCK_DURATION_MS: 24 * 60 * 60 * 1000, // 24 horas
  }
};

// Criar tabela de tentativas se não existir
export const initBruteForceProtection = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS brute_force_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        attempt_type ENUM('login', 'register', 'ip') NOT NULL,
        attempts INT NOT NULL DEFAULT 1,
        first_attempt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_attempt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        blocked_until DATETIME NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        INDEX idx_identifier_type (identifier, attempt_type),
        INDEX idx_blocked_until (blocked_until),
        INDEX idx_last_attempt (last_attempt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('Tabela de proteção contra força bruta inicializada');
  } catch (error) {
    console.error('Erro ao inicializar proteção contra força bruta:', error);
  }
};

// Registrar tentativa
export const recordAttempt = async (identifier, attemptType, ipAddress, userAgent) => {
  try {
    const config = BRUTE_FORCE_CONFIG[attemptType.toUpperCase() + '_ATTEMPTS'] || BRUTE_FORCE_CONFIG.LOGIN_ATTEMPTS;
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.WINDOW_MS);
    
    // Verificar tentativas existentes na janela de tempo
    const [existing] = await db.execute(
      'SELECT * FROM brute_force_attempts WHERE identifier = ? AND attempt_type = ? AND last_attempt > ?',
      [identifier, attemptType, windowStart]
    );
    
    if (existing.length > 0) {
      const record = existing[0];
      const newAttempts = record.attempts + 1;
      
      // Calcular tempo de bloqueio se exceder limite
      let blockedUntil = null;
      if (newAttempts >= config.MAX_ATTEMPTS) {
        blockedUntil = new Date(now.getTime() + config.BLOCK_DURATION_MS);
      }
      
      // Atualizar registro existente
      await db.execute(
        'UPDATE brute_force_attempts SET attempts = ?, last_attempt = ?, blocked_until = ?, ip_address = ?, user_agent = ? WHERE id = ?',
        [newAttempts, now, blockedUntil, ipAddress, userAgent, record.id]
      );
      
      return {
        attempts: newAttempts,
        blocked: newAttempts >= config.MAX_ATTEMPTS,
        blockedUntil,
        remainingAttempts: Math.max(0, config.MAX_ATTEMPTS - newAttempts)
      };
    } else {
      // Criar novo registro
      await db.execute(
        'INSERT INTO brute_force_attempts (identifier, attempt_type, attempts, first_attempt, last_attempt, ip_address, user_agent) VALUES (?, ?, 1, ?, ?, ?, ?)',
        [identifier, attemptType, now, now, ipAddress, userAgent]
      );
      
      return {
        attempts: 1,
        blocked: false,
        blockedUntil: null,
        remainingAttempts: config.MAX_ATTEMPTS - 1
      };
    }
  } catch (error) {
    console.error('Erro ao registrar tentativa:', error);
    return { attempts: 0, blocked: false, blockedUntil: null, remainingAttempts: 0 };
  }
};

// Verificar se está bloqueado
export const isBlocked = async (identifier, attemptType) => {
  try {
    const now = new Date();
    
    const [records] = await db.execute(
      'SELECT * FROM brute_force_attempts WHERE identifier = ? AND attempt_type = ? AND blocked_until > ?',
      [identifier, attemptType, now]
    );
    
    if (records.length > 0) {
      const record = records[0];
      return {
        blocked: true,
        blockedUntil: record.blocked_until,
        attempts: record.attempts,
        remainingTime: record.blocked_until.getTime() - now.getTime()
      };
    }
    
    return { blocked: false, blockedUntil: null, attempts: 0, remainingTime: 0 };
  } catch (error) {
    console.error('Erro ao verificar bloqueio:', error);
    return { blocked: false, blockedUntil: null, attempts: 0, remainingTime: 0 };
  }
};

// Limpar tentativa (em caso de sucesso)
export const clearAttempts = async (identifier, attemptType) => {
  try {
    await db.execute(
      'DELETE FROM brute_force_attempts WHERE identifier = ? AND attempt_type = ?',
      [identifier, attemptType]
    );
    return true;
  } catch (error) {
    console.error('Erro ao limpar tentativas:', error);
    return false;
  }
};

// Middleware de proteção para login
export const protectLogin = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    if (!email) {
      return next();
    }
    
    // Verificar bloqueio por email
    const emailBlock = await isBlocked(email, 'login');
    if (emailBlock.blocked) {
      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas de login falharam. Tente novamente mais tarde.',
        blocked_until: emailBlock.blockedUntil,
        remaining_time_ms: emailBlock.remainingTime
      });
    }
    
    // Verificar bloqueio por IP
    const ipBlock = await isBlocked(ipAddress, 'ip');
    if (ipBlock.blocked) {
      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas de acesso deste IP. Tente novamente mais tarde.',
        blocked_until: ipBlock.blockedUntil,
        remaining_time_ms: ipBlock.remainingTime
      });
    }
    
    // Adicionar dados ao request para uso posterior
    req.bruteForceData = {
      email,
      ipAddress,
      userAgent
    };
    
    next();
  } catch (error) {
    console.error('Erro na proteção de login:', error);
    next();
  }
};

// Middleware para registrar tentativa falhada
export const recordFailedLogin = async (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Se o login falhou, registrar tentativa
    if (data && !data.success && req.bruteForceData) {
      const { email, ipAddress, userAgent } = req.bruteForceData;
      
      // Registrar tentativa para email e IP (não aguardar)
      recordAttempt(email, 'login', ipAddress, userAgent).catch(console.error);
      recordAttempt(ipAddress, 'ip', ipAddress, userAgent).catch(console.error);
    }
    
    // Se o login foi bem-sucedido, limpar tentativas
    if (data && data.success && req.bruteForceData) {
      const { email } = req.bruteForceData;
      clearAttempts(email, 'login').catch(console.error);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Middleware de proteção para registro
export const protectRegister = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Verificar bloqueio por IP para registro
    const ipBlock = await isBlocked(ipAddress, 'register');
    if (ipBlock.blocked) {
      return res.status(429).json({
        success: false,
        error: 'Muitas tentativas de registro deste IP. Tente novamente mais tarde.',
        blocked_until: ipBlock.blockedUntil,
        remaining_time_ms: ipBlock.remainingTime
      });
    }
    
    req.registerData = {
      ipAddress,
      userAgent
    };
    
    next();
  } catch (error) {
    console.error('Erro na proteção de registro:', error);
    next();
  }
};

// Limpeza automática de registros antigos
export const cleanupOldAttempts = async () => {
  try {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias
    
    const [result] = await db.execute(
      'DELETE FROM brute_force_attempts WHERE last_attempt < ? AND (blocked_until IS NULL OR blocked_until < NOW())',
      [cutoffDate]
    );
    
    console.log(`Limpeza de tentativas antigas: ${result.affectedRows} registros removidos`);
    return result.affectedRows;
  } catch (error) {
    console.error('Erro na limpeza de tentativas antigas:', error);
    return 0;
  }
};

// Agendar limpeza automática
export const scheduleBruteForceCleanup = () => {
  // Executar limpeza a cada 6 horas
  setInterval(async () => {
    await cleanupOldAttempts();
  }, 6 * 60 * 60 * 1000);
  
  // Executar limpeza inicial após 5 minutos
  setTimeout(async () => {
    await cleanupOldAttempts();
  }, 5 * 60 * 1000);
};

export default {
  initBruteForceProtection,
  recordAttempt,
  isBlocked,
  clearAttempts,
  protectLogin,
  recordFailedLogin,
  protectRegister,
  cleanupOldAttempts,
  scheduleBruteForceCleanup
};