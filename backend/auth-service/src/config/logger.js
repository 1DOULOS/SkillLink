'use strict';

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, json, simple, errors } = format;

const isProduction = process.env.NODE_ENV === 'production';

const logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? combine(errors({ stack: true }), timestamp(), json())
    : combine(errors({ stack: true }), timestamp(), simple()),
  transports: [
    new transports.Console({
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

module.exports = logger;
