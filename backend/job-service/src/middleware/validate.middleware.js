'use strict';

const { validationResult } = require('express-validator');

/**
 * Runs express-validator checks and returns a 422 if any fail.
 * Place this after the validation chain in the route definition.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'ValidationError',
      message: 'Validation failed',
      details: errors.array().map((e) => ({
        field: e.path || e.param,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = { validate };
