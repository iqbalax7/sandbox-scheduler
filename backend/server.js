/**
 * Healthcare Appointment Scheduling API
 * Environment:
 *  MONGODB_URI (default: mongodb://localhost:27017/sandbox_scheduler)
 *  PORT (default: 4000)
 *  NODE_ENV (development/production)
 */
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const providersRoute = require('./routes/providers');
const bookingsRoute = require('./routes/bookings');
const scheduleRoutes = require('./routes/schedule');
const patientsRouter = require('./routes/patients');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { 
  requestIdMiddleware,
  morganMiddleware,
  performanceMiddleware,
  metricsMiddleware,
  healthCheck
} = require('./middleware/requestLogger');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Request tracking and logging middleware
app.use(requestIdMiddleware);
app.use(morganMiddleware);
app.use(performanceMiddleware);
app.use(metricsMiddleware);

// Security and parsing middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Enhanced health check endpoint with metrics
app.get('/health', healthCheck);

// API routes
app.use('/api/providers', providersRoute);
app.use('/api/bookings', bookingsRoute);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/patients', patientsRouter);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sandbox_scheduler';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database connection with better error handling
mongoose.set('strictQuery', false);
mongoose.connect(MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => {
  logger.info('MongoDB connected successfully', {
    database: MONGODB_URI.replace(/\/\/.*@/, '//***:***@'), // Hide credentials in logs
    environment: NODE_ENV
  });
  
  const server = app.listen(PORT, () => {
    logger.info('Server started successfully', {
      port: PORT,
      environment: NODE_ENV,
      healthCheck: `http://localhost:${PORT}/health`,
      nodeVersion: process.version,
      pid: process.pid
    });
    
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
  });
  
  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`, {
      signal,
      uptime: process.uptime()
    });
    
    server.close(() => {
      logger.info('HTTP server closed');
      
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        logger.info('Application shutdown complete');
        process.exit(0);
      });
    });
    
    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
})
.catch(err => {
  logger.error('MongoDB connection failed', {
    error: err.message,
    stack: err.stack,
    database: MONGODB_URI.replace(/\/\/.*@/, '//***:***@')
  });
  
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection', {
    error: err.message,
    stack: err.stack,
    promise: promise.toString()
  });
  
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
