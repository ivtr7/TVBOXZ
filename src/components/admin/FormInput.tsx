import React from 'react';
import { getInputErrorClass } from '../../utils/validation';

interface FormInputProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'textarea' | 'number' | 'url';
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  helpText?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  rows = 3,
  maxLength,
  className = '',
  helpText,
}) => {
  const hasError = Boolean(error);
  const inputClasses = `
    mt-1 w-full px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2
    ${getInputErrorClass(hasError)}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    ${className}
  `.trim();

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          className={inputClasses}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          className={inputClasses}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
        />
      )}
      
      {/* Character count for inputs with maxLength */}
      {maxLength && value && (
        <div className="text-xs text-gray-500 text-right">
          {String(value).length}/{maxLength}
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
      
      {/* Help text */}
      {helpText && !error && (
        <div className="text-sm text-gray-500">
          {helpText}
        </div>
      )}
    </div>
  );
};

export default FormInput;