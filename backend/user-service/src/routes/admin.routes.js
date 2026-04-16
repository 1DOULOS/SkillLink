'use strict';

const express = require('express');
const { body, query: queryValidator, param } = require('express-validator');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
  getPlatformStats,
} = require('../controllers/admin.controller');

const { authenticate, authorize } = require('../middleware/auth.middleware');

// Validation helper
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

// GET /api/admin/users - Get all users with pagination
router.get(
  '/users',
  authenticate,
  authorize('admin'),
  [
    queryValidator('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    queryValidator('role').optional().isIn(['student', 'recruiter', 'admin']).withMessage('Invalid role filter'),
    validate,
  ],
  getAllUsers
);

// GET /api/admin/users/:id - Get full user info with profile
router.get(
  '/users/:id',
  authenticate,
  authorize('admin'),
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    validate,
  ],
  getUserById
);

// PUT /api/admin/users/:id/status - Toggle user is_active status
router.put(
  '/users/:id/status',
  authenticate,
  authorize('admin'),
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    body('is_active').isBoolean().withMessage('is_active must be a boolean'),
    validate,
  ],
  updateUserStatus
);

// DELETE /api/admin/users/:id - Soft or hard delete user
router.delete(
  '/users/:id',
  authenticate,
  authorize('admin'),
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    validate,
  ],
  deleteUser
);

// GET /api/admin/stats - Platform-wide statistics
router.get('/stats', authenticate, authorize('admin'), getPlatformStats);

module.exports = router;
