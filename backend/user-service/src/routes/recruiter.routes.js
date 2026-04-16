'use strict';

const express = require('express');
const { body, query: queryValidator, param } = require('express-validator');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  uploadLogo,
  getRecruiterById,
  getRecruiterStats,
} = require('../controllers/recruiter.controller');

const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadAvatarMiddleware } = require('../config/upload');

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

// GET /api/users/recruiter/profile - Get own recruiter profile
router.get('/profile', authenticate, authorize('recruiter'), getProfile);

// PUT /api/users/recruiter/profile - Update own recruiter profile
router.put(
  '/profile',
  authenticate,
  authorize('recruiter'),
  [
    body('first_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('First name must be 1-100 characters'),
    body('last_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Last name must be 1-100 characters'),
    body('company_name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Company name must be 1-200 characters'),
    body('company_website').optional({ nullable: true }).trim().isURL().withMessage('Company website must be a valid URL'),
    body('company_description').optional().trim().isLength({ max: 5000 }).withMessage('Company description cannot exceed 5000 characters'),
    body('industry').optional().trim().isLength({ max: 100 }).withMessage('Industry cannot exceed 100 characters'),
    body('position').optional().trim().isLength({ max: 200 }).withMessage('Position cannot exceed 200 characters'),
    body('phone').optional().trim().matches(/^[+\d\s\-()]{7,20}$/).withMessage('Invalid phone number format'),
    validate,
  ],
  updateProfile
);

// POST /api/users/recruiter/logo - Upload company logo
router.post('/logo', authenticate, authorize('recruiter'), uploadAvatarMiddleware, uploadLogo);

// GET /api/users/recruiter/stats - Get recruiter dashboard stats
router.get('/stats', authenticate, authorize('recruiter'), getRecruiterStats);

// GET /api/users/recruiter/:id - Get recruiter by ID (public, any authenticated user)
router.get(
  '/:id',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid recruiter ID format'),
    validate,
  ],
  getRecruiterById
);

module.exports = router;
