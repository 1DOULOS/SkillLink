'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'skilllink-jwt-secret-2026-production';

/**
 * Authenticate middleware - verifies JWT token and attaches user to req.
 * Returns 401 if token is missing or invalid.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Authentication failed', { error: err.message });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token has expired',
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }
};

/**
 * Optional authentication - tries to verify token but does not fail if absent.
 * Attaches user to req if token is valid, otherwise req.user remains undefined.
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

/**
 * Authorize middleware factory - checks that authenticated user has one of the allowed roles.
 * Must be used after authenticate.
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to perform this action',
      });
    }

    next();
  };
};

module.exports = { authenticate, optionalAuth, authorize };
