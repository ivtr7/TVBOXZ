import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';
import { 
  generateRefreshToken, 
  refreshTokenMiddleware, 
  generateNewAccessToken,
  revokeRefreshToken 
} from '../middleware/refreshToken.js';
import { 
  protectLogin, 
  recordFailedLogin, 
  protectRegister 
} from '../middleware/bruteForceProtection.js';

const router = express.Router();

// Login
router.post('/login', protectLogin, recordFailedLogin, validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuário no banco
    const [users] = await db.execute(
      'SELECT id, email, password, name, role, tenant_id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = users[0];

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar tokens JWT
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      user.role === 'admin' ? process.env.JWT_SECRET_ADMIN : process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        issuer: 'tvbox-rpa',
        audience: user.role
      }
    );

    // Gerar refresh token
    const refreshToken = await generateRefreshToken(user.id, user.role);

    res.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: process.env.JWT_EXPIRES_IN || '15m',
      token_type: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Refresh token - gerar novo access token
router.post('/refresh', refreshTokenMiddleware, async (req, res) => {
  try {
    const tokenData = req.refreshTokenData;
    
    // Gerar novo access token
    const newAccessToken = generateNewAccessToken(tokenData);
    
    res.json({
      success: true,
      access_token: newAccessToken,
      expires_in: process.env.JWT_EXPIRES_IN || '15m',
      token_type: 'Bearer'
    });
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Logout - revogar refresh token
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.body.refresh_token || req.headers['x-refresh-token'];
    
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Verificar token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      tenant_id: req.user.tenant_id
    }
  });
});

export default router;