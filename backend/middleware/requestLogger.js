const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const logger = require('../utils/logger');

// Add request ID to all requests
const requestIdMiddleware = (req, res, next) => {
  req.id = uuidv4();
  req._requestStartTime = process.hrtime(); // Use custom property to avoid Morgan conflicts
  res.setHeader('X-Request-ID', req.id);
  next();
};

// Custom token for request ID in morgan
morgan.token('id', (req) => req.id);

// Custom token for response time in ms
morgan.token('response-time-ms', (req, res) => {
  if (!req._requestStartTime || !Array.isArray(req._requestStartTime)) {
    return '-';
  }
  try {
    const diff = process.hrtime(req._requestStartTime);
    return (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
  } catch (error) {
    return '-';
  }
});

// Custom morgan format for structured logging
const morganFormat = ':id :method :url :status :response-time-ms ms - :res[content-length] bytes';

// Morgan middleware with Winston integration
const morganMiddleware = morgan(morganFormat, {
  stream: {
    write: (message) => {
      // Parse morgan output and log with structured data
      const parts = message.trim().split(' ');
      if (parts.length >= 5) {
        const [requestId, method, url, status, responseTime] = parts;
        
        logger.http(`${method} ${url} - ${status} - ${responseTime}`, {
          requestId,
          method,
          url,
          statusCode: parseInt(status),
          responseTime: parseFloat(responseTime),
          timestamp: new Date().toISOString()
        });
      } else {
        // Fallback for malformed log entries
        logger.http(message.trim());
      }
    }
  }
});

// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  // Override res.end to capture performance metrics
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log performance if request takes longer than threshold
    if (duration > 1000) { // Log slow requests (>1s)
      logger.warn('Slow request detected', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode
      });
    }
    
    // Add performance headers
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Database query logging middleware
const dbQueryLogger = {
  logQuery: (collection, operation, query = {}, options = {}) => {
    const startTime = Date.now();
    
    return {
      end: (resultCount = null, error = null) => {
        const duration = Date.now() - startTime;
        
        if (error) {
          logger.error('Database query error', {
            collection,
            operation,
            query,
            options,
            duration,
            error: error.message,
            stack: error.stack
          });
        } else {
          logger.debug('Database query', {
            collection,
            operation,
            query,
            options,
            duration,
            resultCount
          });
          
          // Warn about slow queries
          if (duration > 1000) {
            logger.warn('Slow database query', {
              collection,
              operation,
              duration,
              query
            });
          }
        }
      }
    };
  }
};

// API endpoint monitoring
const apiMetrics = {
  requests: new Map(),
  errors: new Map(),
  
  incrementRequest: (endpoint, method) => {
    const key = `${method} ${endpoint}`;
    const count = apiMetrics.requests.get(key) || 0;
    apiMetrics.requests.set(key, count + 1);
  },
  
  incrementError: (endpoint, method, statusCode) => {
    const key = `${method} ${endpoint}`;
    const errors = apiMetrics.errors.get(key) || {};
    errors[statusCode] = (errors[statusCode] || 0) + 1;
    apiMetrics.errors.set(key, errors);
  },
  
  getMetrics: () => ({
    requests: Object.fromEntries(apiMetrics.requests),
    errors: Object.fromEntries(apiMetrics.errors)
  })
};

// Endpoint metrics middleware
const metricsMiddleware = (req, res, next) => {
  const endpoint = req.route ? req.route.path : req.path;
  
  apiMetrics.incrementRequest(endpoint, req.method);
  
  // Track response status
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode >= 400) {
      apiMetrics.incrementError(endpoint, req.method, res.statusCode);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Health check endpoint with metrics
const healthCheck = (req, res) => {
  const metrics = apiMetrics.getMetrics();
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptime / 60)} minutes`,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
    },
    apiMetrics: metrics
  };
  
  logger.info('Health check accessed', {
    requestId: req.id,
    uptime,
    memoryUsage
  });
  
  res.json(healthData);
};

module.exports = {
  requestIdMiddleware,
  morganMiddleware,
  performanceMiddleware,
  dbQueryLogger,
  metricsMiddleware,
  healthCheck,
  apiMetrics
};
