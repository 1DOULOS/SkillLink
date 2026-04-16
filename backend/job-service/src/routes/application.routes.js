'use strict';

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const applicationController = require('../controllers/application.controller');

const router = Router();

// POST /api/applications/jobs/:jobId  – student applies to a job
router.post(
  '/jobs/:jobId',
  authenticate,
  authorize('student'),
  applicationController.applyToJob
);

// GET /api/applications/my  – student's own applications
router.get(
  '/my',
  authenticate,
  authorize('student'),
  applicationController.getMyApplications
);

// DELETE /api/applications/:id  – student withdraws application
router.delete(
  '/:id',
  authenticate,
  authorize('student'),
  applicationController.withdrawApplication
);

// GET /api/applications/:id  – get single application (student own, or recruiter for their job)
router.get(
  '/:id',
  authenticate,
  applicationController.getApplicationById
);

module.exports = router;
