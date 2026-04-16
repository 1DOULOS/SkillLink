'use strict';

const { validationResult } = require('express-validator');

/**
 * validate - Express middleware that runs validationResult and returns 400
 * with errors array if validation fails.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }

  next();
};

module.exports = { validate };
