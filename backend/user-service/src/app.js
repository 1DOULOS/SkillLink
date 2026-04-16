'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const logger = require('./config/logger');
const studentRoutes = require('./routes/student.routes');
const recruiterRoutes = require('./routes/recruiter.routes');
const adminRoutes = require('./routes/admin.routes');
const { metricsRouter, requestCounterMiddleware } = require('./routes/metrics.routes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'TooManyRequests', message: 'Too many requests' },
});
app.use(limiter);

app.use(requestCounterMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
    });
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'user-service', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api/users', studentRoutes);
app.use('/api/users/recruiter', recruiterRoutes);
app.use('/api/admin', adminRoutes);
app.use('/metrics', metricsRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'NotFound', message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`User service running on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV });
  });
}

module.exports = app;
