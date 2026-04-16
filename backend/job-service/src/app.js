'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const client = require('prom-client');

const logger = require('./config/logger');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const metricsRoutes = require('./routes/metrics.routes');

// ---------------------------------------------------------------------------
// Prometheus setup
// ---------------------------------------------------------------------------
client.collectDefaultMetrics({ prefix: 'job_service_' });

const httpRequestCounter = new client.Counter({
  name: 'job_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// ---------------------------------------------------------------------------
// App initialisation
// ---------------------------------------------------------------------------
const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting – jobs are read heavily so a generous limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many requests, please try again later',
  },
});
app.use(limiter);

// Request logging middleware
app.use((req, _res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Prometheus request counter middleware
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });
  });
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'job-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/metrics', metricsRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: 'The requested resource was not found',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT, 10) || 3003;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Job service running on port ${PORT}`, { port: PORT });
  });
}

module.exports = app;
