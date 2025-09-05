const { ValidationError } = require('mongoose').Error;

// Error factory functions
const createAppError = (message, statusCode = 500, code = 'INTERNAL_ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
};

const createValidationError = (message, field = null) => {
  const error = createAppError(message, 400, 'VALIDATION_ERROR');
  error.field = field;
  return error;
};

const createNotFoundError = (resource = 'Resource') => {
  return createAppError(`${resource} not found`, 404, 'NOT_FOUND');
};

const createConflictError = (message) => {
  return createAppError(message, 409, 'CONFLICT');
};

// Async wrapper to catch promise rejections
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  const logger = require('../utils/logger');
  
  let error = { ...err };
  error.message = err.message;

  // Log error with structured data
  logger.logError(err, req, {
    statusCode: error.statusCode || 500,
    code: error.code || 'INTERNAL_ERROR',
    operationalError: error.isOperational || false
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = createValidationError('Invalid resource ID format');
  }

  // Mongoose validation error
  if (err instanceof ValidationError) {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = createValidationError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = createConflictError(message);
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Server Error',
      code: error.code || 'INTERNAL_ERROR',
      ...(error.field && { field: error.field }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = createNotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

module.exports = {
  createAppError,
  createValidationError,
  createNotFoundError,
  createConflictError,
  asyncHandler,
  errorHandler,
  notFoundHandler
};
