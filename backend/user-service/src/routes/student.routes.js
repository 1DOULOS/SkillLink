'use strict';

const express = require('express');
const { body, query: queryValidator, param } = require('express-validator');
const router = express.Router();

const {
  getProfile,
  updateProfile,
  uploadCV,
  uploadAvatar,
  getStudentById,
  getAllStudents,
  updateSkills,
  getStudentStats,
} = require('../controllers/student.controller');

const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadCVMiddleware, uploadAvatarMiddleware } = require('../config/upload');

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

// GET /api/users/profile - Get own student profile
router.get('/profile', authenticate, authorize('student'), getProfile);

// PUT /api/users/profile - Update own student profile
router.put(
  '/profile',
  authenticate,
  authorize('student'),
  [
    body('first_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('First name must be 1-100 characters'),
    body('last_name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Last name must be 1-100 characters'),
    body('phone').optional().trim().matches(/^[+\d\s\-()]{7,20}$/).withMessage('Invalid phone number format'),
    body('bio').optional().trim().isLength({ max: 2000 }).withMessage('Bio cannot exceed 2000 characters'),
    body('location').optional().trim().isLength({ max: 200 }).withMessage('Location cannot exceed 200 characters'),
    body('github_url').optional({ nullable: true }).trim().isURL().withMessage('GitHub URL must be a valid URL'),
    body('linkedin_url').optional({ nullable: true }).trim().isURL().withMessage('LinkedIn URL must be a valid URL'),
    body('skills').optional().isArray().withMessage('Skills must be an array'),
    body('skills.*').optional().isString().trim().withMessage('Each skill must be a string'),
    validate,
  ],
  updateProfile
);

// POST /api/users/cv - Upload CV
router.post('/cv', authenticate, authorize('student'), uploadCVMiddleware, uploadCV);

// POST /api/users/avatar - Upload avatar
router.post('/avatar', authenticate, authorize('student'), uploadAvatarMiddleware, uploadAvatar);

// PUT /api/users/skills - Update skills
router.put(
  '/skills',
  authenticate,
  authorize('student'),
  [
    body('skills').isArray().withMessage('Skills must be an array'),
    body('skills.*').isString().trim().withMessage('Each skill must be a string'),
    validate,
  ],
  updateSkills
);

// GET /api/users/stats - Get student dashboard stats
router.get('/stats', authenticate, authorize('student'), getStudentStats);

// GET /api/users/students - Get all students (recruiter/admin only)
router.get(
  '/students',
  authenticate,
  authorize('recruiter', 'admin'),
  [
    queryValidator('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    queryValidator('search').optional().trim().isLength({ max: 100 }).withMessage('Search term too long'),
    validate,
  ],
  getAllStudents
);

// GET /api/users/students/:id - Get student by ID (recruiter/admin only)
router.get(
  '/students/:id',
  authenticate,
  authorize('recruiter', 'admin'),
  [
    param('id').isUUID().withMessage('Invalid student ID format'),
    validate,
  ],
  getStudentById
);

module.exports = router;
