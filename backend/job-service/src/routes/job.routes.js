'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const jobController = require('../controllers/job.controller');
const applicationController = require('../controllers/application.controller');

const router = Router();

const VALID_JOB_TYPES = ['full-time', 'part-time', 'internship', 'contract', 'remote'];

// Validation chains
const createJobValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 255 })
    .withMessage('title must be 255 characters or fewer'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('description is required'),
  body('job_type')
    .trim()
    .notEmpty()
    .withMessage('job_type is required')
    .isIn(VALID_JOB_TYPES)
    .withMessage(`job_type must be one of: ${VALID_JOB_TYPES.join(', ')}`),
  body('salary_min')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('salary_min must be a non-negative number'),
  body('salary_max')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('salary_max must be a non-negative number'),
  body('skills_required')
    .optional()
    .isArray()
    .withMessage('skills_required must be an array'),
  body('deadline')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('deadline must be a valid ISO 8601 date'),
  body('status')
    .optional()
    .isIn(['active', 'draft'])
    .withMessage('status must be active or draft'),
];

// ---------- Public routes ----------
// GET /api/jobs  – list active jobs (no auth)
router.get('/', getAllJobsHandler);

// ---------- Authenticated recruiter routes (specific, before :id param) ----------
// GET /api/jobs/my  – recruiter's own listings
router.get('/my', authenticate, authorize('recruiter'), jobController.getMyJobs);

// GET /api/jobs/stats  – recruiter dashboard stats
router.get('/stats', authenticate, authorize('recruiter'), jobController.getJobStats);

// POST /api/jobs  – create a job
router.post(
  '/',
  authenticate,
  authorize('recruiter'),
  createJobValidation,
  validate,
  jobController.createJob
);

// ---------- Parameterised routes ----------
// GET /api/jobs/:id  – single job (optional auth for has_applied)
router.get('/:id', optionalAuth, jobController.getJobById);

// PUT /api/jobs/:id  – update job
router.put('/:id', authenticate, authorize('recruiter', 'admin'), jobController.updateJob);

// DELETE /api/jobs/:id  – delete job
router.delete('/:id', authenticate, authorize('recruiter', 'admin'), jobController.deleteJob);

// GET /api/jobs/:id/applications  – job applications for recruiter
router.get(
  '/:id/applications',
  authenticate,
  authorize('recruiter', 'admin'),
  applicationController.getJobApplications
);

// PUT /api/jobs/:jobId/applications/:appId  – update application status
router.put(
  '/:jobId/applications/:appId',
  authenticate,
  authorize('recruiter'),
  applicationController.updateApplicationStatus
);

// Wrap to satisfy linter – function used before definition is fine in Node
function getAllJobsHandler(req, res) {
  return jobController.getAllJobs(req, res);
}

module.exports = router;
