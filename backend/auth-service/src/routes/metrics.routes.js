'use strict';

const express = require('express');
const client = require('prom-client');
const router = express.Router();

// Collect default Node.js metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'auth_service_' });

// Create a counter for HTTP requests
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Expose the counter so app.js can use it as middleware
const requestCounterMiddleware = (req, res, next) => {
  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });
  next();
};

// GET /metrics
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err.message);
  }
});

module.exports = { metricsRouter: router, requestCounterMiddleware };
