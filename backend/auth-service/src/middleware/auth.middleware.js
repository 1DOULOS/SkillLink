'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * authenticate - Verifies JWT Bearer token from Authorization header.
 * Sets req.user = { id, email, role }. Returns 401 if missing/invalid.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skilllink-jwt-secret-2026-production');

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    logger.warn('JWT verification failed', { error: err.message });

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'TokenExpired',
        message: 'Authentication token has expired',
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    });
  }
};

/**
 * authorize - Middleware factory that checks req.user.role is in allowed roles.
 * Returns 403 if not.
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
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * optionalAuth - Like authenticate but doesn't fail if no token (just skips).
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'skilllink-jwt-secret-2026-production');

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
  } catch (err) {
    // Token invalid or expired — silently skip
    logger.debug('Optional auth token invalid, continuing unauthenticated', { error: err.message });
  }

  next();
};

module.exports = { authenticate, authorize, optionalAuth };
