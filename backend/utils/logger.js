const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Create the format for console logs
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Create the format for file logs
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: level(),
    format: consoleFormat
  }),
  
  // Error log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    handleExceptions: true
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 10
  })
];

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format: fileFormat,
  transports,
  exitOnError: false
});

// Add request ID to log context
logger.child = (meta = {}) => {
  const childLogger = Object.create(logger);
  childLogger.defaultMeta = { ...logger.defaultMeta, ...meta };
  return childLogger;
};

// Helper methods for common logging patterns
logger.logRequest = (req, res, responseTime) => {
  const { method, url, ip, headers } = req;
  logger.http(`${method} ${url} - ${res.statusCode} - ${responseTime}ms - ${ip}`, {
    method,
    url,
    statusCode: res.statusCode,
    responseTime,
    ip,
    userAgent: headers['user-agent'],
    contentLength: res.get('Content-Length') || 0,
    requestId: req.id
  });
};

logger.logError = (error, req = null, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    ...context
  };
  
  if (req) {
    errorInfo.requestId = req.id;
    errorInfo.method = req.method;
    errorInfo.url = req.url;
    errorInfo.ip = req.ip;
  }
  
  logger.error('Application Error', errorInfo);
};

logger.logBookingEvent = (action, booking, user = null, context = {}) => {
  logger.info(`Booking ${action}`, {
    action,
    bookingId: booking._id || booking.id,
    providerId: booking.provider,
    patientId: booking.patient,
    startTime: booking.start,
    endTime: booking.end,
    status: booking.status,
    userId: user?._id,
    ...context
  });
};

logger.logSlotGeneration = (providerId, dateRange, slotCount, generationTime) => {
  logger.info('Slot generation completed', {
    providerId,
    dateRange,
    slotCount,
    generationTimeMs: generationTime,
    performance: {
      slotsPerSecond: Math.round(slotCount / (generationTime / 1000))
    }
  });
};

logger.logDatabaseOperation = (operation, collection, duration, recordCount = null) => {
  logger.debug(`Database ${operation}`, {
    operation,
    collection,
    durationMs: duration,
    recordCount
  });
};

// Ensure logs directory exists
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;
