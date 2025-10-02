import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';

// Middleware de autenticação JWT
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Primeiro decodificar sem verificar para obter o role
    const decodedUnverified = jwt.decode(token);
    if (!decodedUnverified || !decodedUnverified.role) {
      return res.status(403).json({ error: 'Invalid token format' });
    }

    // Usar o JWT_SECRET correto baseado no role
    const jwtSecret = decodedUnverified.role === 'admin' ? process.env.JWT_SECRET_ADMIN : process.env.JWT_SECRET;
    const decoded = jwt.verify(token, jwtSecret);
    
    // Buscar usuário no banco de dados
    const [users] = await db.execute(
      'SELECT id, email, name, role, tenant_id FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware para verificar se é admin
export const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// Middleware opcional de autenticação (não bloqueia se não houver token)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Primeiro decodificar sem verificar para obter o role
      const decodedUnverified = jwt.decode(token);
      if (decodedUnverified && decodedUnverified.role) {
        // Usar o JWT_SECRET correto baseado no role
        const jwtSecret = decodedUnverified.role === 'admin' ? process.env.JWT_SECRET_ADMIN : process.env.JWT_SECRET;
        const decoded = jwt.verify(token, jwtSecret);
        const [users] = await db.execute(
          'SELECT id, email, name, role, tenant_id FROM users WHERE id = ?',
          [decoded.id]
        );

        if (users.length > 0) {
          req.user = users[0];
        }
      }
    }
    
    next();
  } catch (error) {
    // Se houver erro na autenticação opcional, continua sem usuário
    next();
  }
};