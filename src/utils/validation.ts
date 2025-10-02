// Validation utilities for forms and user input

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  url: /^https?:\/\/.+/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  deviceId: /^[a-zA-Z0-9_-]+$/,
};

// Common validation messages
export const VALIDATION_MESSAGES = {
  required: 'Este campo é obrigatório',
  email: 'Digite um email válido',
  minLength: (min: number) => `Mínimo de ${min} caracteres`,
  maxLength: (max: number) => `Máximo de ${max} caracteres`,
  pattern: 'Formato inválido',
  phone: 'Digite um telefone válido',
  url: 'Digite uma URL válida',
  deviceId: 'ID do dispositivo deve conter apenas letras, números, _ ou -',
};

// Validate a single field
export function validateField(value: any, rule: ValidationRule): string | null {
  // Required validation
  if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return VALIDATION_MESSAGES.required;
  }

  // Skip other validations if field is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  const stringValue = String(value).trim();

  // Min length validation
  if (rule.minLength && stringValue.length < rule.minLength) {
    return VALIDATION_MESSAGES.minLength(rule.minLength);
  }

  // Max length validation
  if (rule.maxLength && stringValue.length > rule.maxLength) {
    return VALIDATION_MESSAGES.maxLength(rule.maxLength);
  }

  // Pattern validation
  if (rule.pattern && !rule.pattern.test(stringValue)) {
    return VALIDATION_MESSAGES.pattern;
  }

  // Custom validation
  if (rule.custom) {
    return rule.custom(value);
  }

  return null;
}

// Validate an entire form
export function validateForm(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  for (const [field, rule] of Object.entries(schema)) {
    const error = validateField(data[field], rule);
    if (error) {
      errors[field] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
}

// Common validation schemas
export const VALIDATION_SCHEMAS = {
  device: {
    nome: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    localizacao: {
      required: true,
      minLength: 2,
      maxLength: 200,
    },
    descricao: {
      maxLength: 500,
    },
  },
  playlist: {
    nome: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    descricao: {
      maxLength: 500,
    },
  },

  content: {
    title: {
      required: true,
      minLength: 2,
      maxLength: 200,
    },
    description: {
      maxLength: 1000,
    },
  },
};

// Utility to get error class for input styling
export function getInputErrorClass(hasError: boolean): string {
  return hasError
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
}

// Utility to sanitize input values
export function sanitizeInput(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// Utility to format validation errors for display
export function formatValidationErrors(errors: Record<string, string>): string[] {
  return Object.values(errors).filter(Boolean);
}