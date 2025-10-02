import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import crypto from 'crypto';

// Gerar refresh token
export const generateRefreshToken = async (userId, userType = 'user') => {
  try {
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    // Salvar refresh token no banco
    await db.execute(
      `INSERT INTO refresh_tokens (user_id, token, user_type, expires_at, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, refreshToken, userType, expiresAt]
    );

    return refreshToken;
  } catch (error) {
    console.error('Erro ao gerar refresh token:', error);
    throw new Error('Erro interno do servidor');
  }
};

// Validar refresh token
export const validateRefreshToken = async (refreshToken) => {
  try {
    const [rows] = await db.execute(
      `SELECT rt.*, u.id as user_id, u.email, u.name, u.role 
       FROM refresh_tokens rt 
       JOIN users u ON rt.user_id = u.id 
       WHERE rt.token = ? AND rt.expires_at > NOW() AND rt.revoked = FALSE`,
      [refreshToken]
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  } catch (error) {
    console.error('Erro ao validar refresh token:', error);
    return null;
  }
};

// Revogar refresh token
export const revokeRefreshToken = async (refreshToken) => {
  try {
    await db.execute(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE token = ?',
      [refreshToken]
    );
    return true;
  } catch (error) {
    console.error('Erro ao revogar refresh token:', error);
    return false;
  }
};

// Revogar todos os refresh tokens de um usuário
export const revokeAllUserRefreshTokens = async (userId, userType = 'user') => {
  try {
    await db.execute(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE user_id = ? AND user_type = ?',
      [userId, userType]
    );
    return true;
  } catch (error) {
    console.error('Erro ao revogar todos os refresh tokens:', error);
    return false;
  }
};

// Limpar refresh tokens expirados
export const cleanExpiredRefreshTokens = async () => {
  try {
    const [result] = await db.execute(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE'
    );
    console.log(`Limpeza de refresh tokens: ${result.affectedRows} tokens removidos`);
    return result.affectedRows;
  } catch (error) {
    console.error('Erro ao limpar refresh tokens expirados:', error);
    return 0;
  }
};

// Middleware para refresh token
export const refreshTokenMiddleware = async (req, res, next) => {
  try {
    const refreshToken = req.body.refresh_token || req.headers['x-refresh-token'];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token é obrigatório'
      });
    }

    const tokenData = await validateRefreshToken(refreshToken);

    if (!tokenData) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token inválido ou expirado'
      });
    }

    req.refreshTokenData = tokenData;
    next();
  } catch (error) {
    console.error('Erro no middleware de refresh token:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Gerar novo access token usando refresh token
export const generateNewAccessToken = (userData) => {
  const payload = {
    id: userData.user_id,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    type: userData.user_type
  };

  const secret = userData.user_type === 'admin' ? 
    process.env.JWT_SECRET_ADMIN : 
    process.env.JWT_SECRET;

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    issuer: 'tvbox-rpa',
    audience: userData.user_type
  });
};

// Agendar limpeza automática de refresh tokens
export const scheduleRefreshTokenCleanup = () => {
  // Executar limpeza a cada 24 horas
  setInterval(async () => {
    await cleanExpiredRefreshTokens();
  }, 24 * 60 * 60 * 1000);

  // Executar limpeza inicial após 1 minuto
  setTimeout(async () => {
    await cleanExpiredRefreshTokens();
  }, 60 * 1000);
};

export default {
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  cleanExpiredRefreshTokens,
  refreshTokenMiddleware,
  generateNewAccessToken,
  scheduleRefreshTokenCleanup
};