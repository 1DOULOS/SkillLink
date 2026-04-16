'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const authRoutes = require('./routes/auth.routes');
const { metricsRouter, requestCounterMiddleware } = require('./routes/metrics.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use(limiter);

// Prometheus counter middleware
app.use(requestCounterMiddleware);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'auth-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/metrics', metricsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Auth service running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
  });
}

module.exports = app;
