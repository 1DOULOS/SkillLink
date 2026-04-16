'use strict';

const { Router } = require('express');
const client = require('prom-client');

const router = Router();

// GET /metrics  – Prometheus scrape endpoint
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end(err.message);
  }
});

module.exports = router;
