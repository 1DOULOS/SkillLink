'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
});

/**
 * Execute a parameterized query against the database pool.
 * @param {string} text - SQL query string with $1, $2... placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { query: text, duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('Database query error', { query: text, error: err.message });
    throw err;
  }
};

module.exports = { pool, query };
