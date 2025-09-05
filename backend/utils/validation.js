const { DateTime } = require('luxon');
const { createValidationError } = require('../middleware/errorHandler');

// Basic validation functions
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

const isValidTimezone = (timezone) => {
  try {
    DateTime.now().setZone(timezone);
    return true;
  } catch {
    return false;
  }
};

const isValidTimeString = (timeStr) => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
};

const isValidDateString = (dateStr) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  const date = DateTime.fromISO(dateStr);
  return date.isValid;
};

// Validation middleware factory
const validateBody = (schema) => (req, res, next) => {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = req.body[field];
    
    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    // Skip other validations if field is not required and empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Type validation
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${field} must be of type ${rules.type}`);
      continue;
    }
    
    // Custom validators
    if (rules.validator && !rules.validator(value)) {
      errors.push(rules.message || `${field} is invalid`);
    }
    
    // String length validation
    if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      errors.push(`${field} must be at least ${rules.minLength} characters long`);
    }
    
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${field} must be no more than ${rules.maxLength} characters long`);
    }
    
    // Number range validation
    if (rules.min && typeof value === 'number' && value < rules.min) {
      errors.push(`${field} must be at least ${rules.min}`);
    }
    
    if (rules.max && typeof value === 'number' && value > rules.max) {
      errors.push(`${field} must be no more than ${rules.max}`);
    }
    
    // Array validation
    if (rules.isArray && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
    }
  }
  
  if (errors.length > 0) {
    return next(createValidationError(errors.join('. ')));
  }
  
  next();
};

// Common validation schemas
const providerSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 100
  },
  email: {
    required: true,
    type: 'string',
    validator: isValidEmail,
    message: 'Invalid email format'
  }
};

const scheduleConfigSchema = {
  timezone: {
    required: false,
    type: 'string',
    validator: isValidTimezone,
    message: 'Invalid timezone'
  },
  minNoticeMinutes: {
    required: false,
    type: 'number',
    min: 0,
    max: 10080 // 1 week
  },
  maxDaysAhead: {
    required: false,
    type: 'number',
    min: 1,
    max: 365
  },
  recurringRules: {
    required: false,
    isArray: true
  },
  exceptions: {
    required: false,
    isArray: true
  }
};

const patientSchema = {
  first_name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50
  },
  last_name: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50
  },
  email: {
    required: true,
    type: 'string',
    validator: isValidEmail,
    message: 'Invalid email format'
  }
};

const bookingSchema = {
  providerId: {
    required: true,
    type: 'string',
    validator: isValidObjectId,
    message: 'Invalid provider ID'
  },
  patientId: {
    required: true,
    type: 'string',
    validator: isValidObjectId,
    message: 'Invalid patient ID'
  },
  start: {
    required: true,
    type: 'string',
    validator: (value) => DateTime.fromISO(value).isValid,
    message: 'Invalid start time format (ISO string required)'
  },
  end: {
    required: true,
    type: 'string',
    validator: (value) => DateTime.fromISO(value).isValid,
    message: 'Invalid end time format (ISO string required)'
  }
};

module.exports = {
  isValidEmail,
  isValidObjectId,
  isValidTimezone,
  isValidTimeString,
  isValidDateString,
  validateBody,
  providerSchema,
  scheduleConfigSchema,
  patientSchema,
  bookingSchema
};
