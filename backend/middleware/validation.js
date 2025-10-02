import Joi from 'joi';
import DOMPurify from 'isomorphic-dompurify';

// Schemas de validação
export const schemas = {
  // Autenticação
  login: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required()
      .max(255)
      .messages({
        'string.email': 'Email deve ter um formato válido',
        'any.required': 'Email é obrigatório',
        'string.max': 'Email deve ter no máximo 255 caracteres'
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.min': 'Senha deve ter pelo menos 8 caracteres',
        'string.max': 'Senha deve ter no máximo 128 caracteres',
        'any.required': 'Senha é obrigatória'
      })
  }),

  // Registro de usuário
  register: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .pattern(/^[a-zA-ZÀ-ÿ\s]+$/)
      .messages({
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome deve ter no máximo 100 caracteres',
        'string.pattern.base': 'Nome deve conter apenas letras e espaços',
        'any.required': 'Nome é obrigatório'
      }),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required()
      .max(255)
      .messages({
        'string.email': 'Email deve ter um formato válido',
        'any.required': 'Email é obrigatório',
        'string.max': 'Email deve ter no máximo 255 caracteres'
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&].*$/)
      .required()
      .messages({
        'string.min': 'Senha deve ter pelo menos 8 caracteres',
        'string.max': 'Senha deve ter no máximo 128 caracteres',
        'string.pattern.base': 'Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial',
        'any.required': 'Senha é obrigatória'
      }),
    role: Joi.string()
      .valid('admin', 'user')
      .default('user')
  }),

  // Registro de dispositivo
  deviceRegister: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .pattern(/^[a-zA-Z0-9\s\-_]+$/)
      .messages({
        'string.min': 'Nome do dispositivo deve ter pelo menos 2 caracteres',
        'string.max': 'Nome do dispositivo deve ter no máximo 100 caracteres',
        'string.pattern.base': 'Nome do dispositivo deve conter apenas letras, números, espaços, hífens e underscores',
        'any.required': 'Nome do dispositivo é obrigatório'
      }),
    device_uuid: Joi.string()
      .uuid({ version: 'uuidv4' })
      .optional()
      .messages({
        'string.uuid': 'UUID do dispositivo deve ser um UUID v4 válido',
        'any.required': 'UUID do dispositivo é obrigatório'
      }),
    model: Joi.string()
      .max(100)
      .optional()
      .pattern(/^[a-zA-Z0-9\s\-_x]+$/)
      .messages({
        'string.max': 'Modelo deve ter no máximo 100 caracteres',
        'string.pattern.base': 'Modelo deve conter apenas caracteres alfanuméricos, espaços, hífens, underscores e x'
      }),
    tenant_id: Joi.number()
      .integer()
      .positive()
      .default(1)
  }),

  // Upload de conteúdo
  contentUpload: Joi.object({
    title: Joi.string()
      .min(1)
      .max(255)
      .required()
      .messages({
        'string.min': 'Título é obrigatório',
        'string.max': 'Título deve ter no máximo 255 caracteres',
        'any.required': 'Título é obrigatório'
      }),
    description: Joi.string()
      .max(1000)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Descrição deve ter no máximo 1000 caracteres'
      }),
    duration_seconds: Joi.number()
      .integer()
      .min(5)
      .max(300)
      .multiple(5)
      .optional()
      .messages({
        'number.min': 'Duração deve ser pelo menos 5 segundos',
        'number.max': 'Duração deve ser no máximo 300 segundos',
        'number.multiple': 'Duração deve ser múltiplo de 5 segundos'
      })
  }),

  // Playlist
  playlistCreate: Joi.object({
    name: Joi.string()
      .min(1)
      .max(255)
      .required()
      .messages({
        'string.min': 'Nome da playlist é obrigatório',
        'string.max': 'Nome da playlist deve ter no máximo 255 caracteres',
        'any.required': 'Nome da playlist é obrigatório'
      }),
    description: Joi.string()
      .max(1000)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Descrição deve ter no máximo 1000 caracteres'
      })
  }),

  // Parâmetros de ID
  id: Joi.object({
    id: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'number.base': 'ID deve ser um número',
        'number.integer': 'ID deve ser um número inteiro',
        'number.positive': 'ID deve ser um número positivo',
        'any.required': 'ID é obrigatório'
      })
  }),

  // UUID
  uuid: Joi.object({
    uuid: Joi.string()
      .uuid({ version: 'uuidv4' })
      .required()
      .messages({
        'string.uuid': 'UUID deve ser um UUID v4 válido',
        'any.required': 'UUID é obrigatório'
      })
  }),

  // Device ID
  deviceId: Joi.object({
    deviceId: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'number.base': 'ID do dispositivo deve ser um número',
        'number.integer': 'ID do dispositivo deve ser um número inteiro',
        'number.positive': 'ID do dispositivo deve ser um número positivo',
        'any.required': 'ID do dispositivo é obrigatório'
      })
  })
};

// Middleware de validação
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'params' ? req.params : 
                 source === 'query' ? req.query : 
                 req.body;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        error: 'Dados de entrada inválidos',
        details: errors
      });
    }

    // Sanitizar dados
    if (source === 'body') {
      req.body = sanitizeObject(value);
    } else if (source === 'query') {
      req.query = sanitizeObject(value);
    } else if (source === 'params') {
      req.params = sanitizeObject(value);
    }

    next();
  };
};

// Função de sanitização
export const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Sanitizar HTML/XSS
      sanitized[key] = DOMPurify.sanitize(value.trim());
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Middleware de sanitização para arquivos
export const sanitizeFileName = (req, res, next) => {
  if (req.file) {
    // Sanitizar nome do arquivo
    const originalName = req.file.originalname;
    const sanitizedName = originalName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
    
    req.file.sanitizedName = sanitizedName;
  }
  
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach(file => {
      const originalName = file.originalname;
      const sanitizedName = originalName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .toLowerCase();
      
      file.sanitizedName = sanitizedName;
    });
  }
  
  next();
};

// Middleware de validação de IP
export const validateIP = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  // Lista de IPs bloqueados (pode ser movida para banco de dados)
  const blockedIPs = process.env.BLOCKED_IPS ? process.env.BLOCKED_IPS.split(',') : [];
  
  if (blockedIPs.includes(clientIP)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado'
    });
  }
  
  req.clientIP = clientIP;
  next();
};

// Middleware de validação de User-Agent
export const validateUserAgent = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  // Bloquear User-Agents suspeitos
  const suspiciousAgents = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'python-requests',
    'curl/7.', // Bloquear curl básico
    'wget/',
    'bot',
    'crawler',
    'spider'
  ];
  
  if (!userAgent || suspiciousAgents.some(agent => 
    userAgent.toLowerCase().includes(agent.toLowerCase())
  )) {
    return res.status(403).json({
      success: false,
      error: 'User-Agent não permitido'
    });
  }
  
  next();
};

export default {
  schemas,
  validate,
  sanitizeObject,
  sanitizeFileName,
  validateIP,
  validateUserAgent
};