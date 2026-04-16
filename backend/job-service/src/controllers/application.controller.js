'use strict';

const { query } = require('../config/db');
const logger = require('../config/logger');

const VALID_APP_STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'accepted'];

/**
 * POST /api/applications/jobs/:jobId
 * Student applies to a job.
 */
const applyToJob = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { jobId } = req.params;
    const { cover_letter } = req.body;

    // Check the job exists and is active
    const jobResult = await query(
      'SELECT id, status, deadline FROM jobs WHERE id = $1',
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Job not found',
      });
    }

    const job = jobResult.rows[0];

    if (job.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'This job is not currently accepting applications',
      });
    }

    // Check deadline
    if (job.deadline && new Date(job.deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'The application deadline for this job has passed',
      });
    }

    // Check for duplicate application
    const dupCheck = await query(
      'SELECT id FROM applications WHERE student_id = $1 AND job_id = $2',
      [studentId, jobId]
    );

    if (dupCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'You have already applied to this job',
      });
    }

    const result = await query(
      `INSERT INTO applications (student_id, job_id, cover_letter, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       RETURNING *`,
      [studentId, jobId, cover_letter || null]
    );

    const application = result.rows[0];
    logger.info('Application submitted', { applicationId: application.id, studentId, jobId });

    return res.status(201).json({
      success: true,
      data: { application },
      message: 'Application submitted successfully',
    });
  } catch (err) {
    // Handle unique constraint violation from database
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'You have already applied to this job',
      });
    }
    logger.error('Error applying to job', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to submit application',
    });
  }
};

/**
 * GET /api/jobs/:id/applications
 * Recruiter: list all applications for a job they own.
 */
const getJobApplications = async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const jobId = req.params.id;
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Verify job exists and belongs to this recruiter
    const jobCheck = await query(
      'SELECT id FROM jobs WHERE id = $1 AND recruiter_id = $2',
      [jobId, recruiterId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Job not found or you do not own this job',
      });
    }

    const conditions = ['a.job_id = $1'];
    const params = [jobId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`a.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM applications a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limitNum, offset];
    const appsResult = await query(
      `SELECT
         a.id, a.status, a.cover_letter, a.created_at, a.updated_at,
         u.email AS student_email,
         sp.first_name, sp.last_name, sp.skills, sp.cv_url, sp.bio, sp.location
       FROM applications a
       JOIN users u ON a.student_id = u.id
       LEFT JOIN student_profiles sp ON a.student_id = sp.user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      dataParams
    );

    const applications = appsResult.rows.map((row) => ({
      id: row.id,
      status: row.status,
      cover_letter: row.cover_letter,
      created_at: row.created_at,
      updated_at: row.updated_at,
      student: {
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        email: row.student_email,
        skills: row.skills,
        cv_url: row.cv_url,
        bio: row.bio,
        location: row.location,
      },
    }));

    return res.status(200).json({
      success: true,
      data: { applications, total },
      message: 'Applications retrieved successfully',
    });
  } catch (err) {
    logger.error('Error fetching job applications', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve applications',
    });
  }
};

/**
 * PUT /api/jobs/:jobId/applications/:appId
 * Recruiter: update the status of an application for their job.
 */
const updateApplicationStatus = async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const { jobId, appId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'status is required',
      });
    }

    if (!VALID_APP_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `status must be one of: ${VALID_APP_STATUSES.join(', ')}`,
      });
    }

    // Ensure the recruiter owns the job
    const jobCheck = await query(
      'SELECT id FROM jobs WHERE id = $1 AND recruiter_id = $2',
      [jobId, recruiterId]
    );

    if (jobCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Job not found or you do not own this job',
      });
    }

    // Ensure the application belongs to this job
    const appCheck = await query(
      'SELECT id FROM applications WHERE id = $1 AND job_id = $2',
      [appId, jobId]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Application not found for this job',
      });
    }

    const result = await query(
      `UPDATE applications
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, appId]
    );

    logger.info('Application status updated', { appId, status, recruiterId });

    return res.status(200).json({
      success: true,
      data: { application: result.rows[0] },
      message: 'Application status updated successfully',
    });
  } catch (err) {
    logger.error('Error updating application status', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to update application status',
    });
  }
};

/**
 * GET /api/applications/my
 * Student: list all their applications with job details.
 */
const getMyApplications = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { status, page = 1, limit = 12 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['a.student_id = $1'];
    const params = [studentId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`a.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM applications a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limitNum, offset];
    const appsResult = await query(
      `SELECT
         a.id, a.status, a.cover_letter, a.created_at, a.updated_at,
         j.id AS job_id, j.title, j.location, j.job_type, j.salary_min, j.salary_max,
         rp.company_name
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      dataParams
    );

    const applications = appsResult.rows.map((row) => ({
      id: row.id,
      status: row.status,
      cover_letter: row.cover_letter,
      created_at: row.created_at,
      updated_at: row.updated_at,
      job: {
        id: row.job_id,
        title: row.title,
        company_name: row.company_name,
        location: row.location,
        job_type: row.job_type,
        salary_min: row.salary_min,
        salary_max: row.salary_max,
      },
    }));

    return res.status(200).json({
      success: true,
      data: { applications, total },
      message: 'Your applications retrieved successfully',
    });
  } catch (err) {
    logger.error('Error fetching student applications', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve applications',
    });
  }
};

/**
 * DELETE /api/applications/:id
 * Student: withdraw a pending application.
 */
const withdrawApplication = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { id } = req.params;

    const appResult = await query(
      'SELECT * FROM applications WHERE id = $1',
      [id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Application not found',
      });
    }

    const application = appResult.rows[0];

    if (application.student_id !== studentId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to withdraw this application',
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'Only pending applications can be withdrawn',
      });
    }

    await query('DELETE FROM applications WHERE id = $1', [id]);
    logger.info('Application withdrawn', { applicationId: id, studentId });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Application withdrawn successfully',
    });
  } catch (err) {
    logger.error('Error withdrawing application', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to withdraw application',
    });
  }
};

/**
 * GET /api/applications/:id
 * Get a single application.
 * - Students can only retrieve their own applications.
 * - Recruiters can retrieve applications for their jobs.
 */
const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await query(
      `SELECT
         a.id, a.student_id, a.job_id, a.status, a.cover_letter,
         a.created_at, a.updated_at,
         j.recruiter_id,
         j.title AS job_title,
         rp.company_name,
         u.email AS student_email,
         sp.first_name, sp.last_name, sp.skills, sp.cv_url, sp.bio, sp.location
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
       JOIN users u ON a.student_id = u.id
       LEFT JOIN student_profiles sp ON a.student_id = sp.user_id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Application not found',
      });
    }

    const row = result.rows[0];

    // Access control
    if (userRole === 'student' && row.student_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to view this application',
      });
    }

    if (userRole === 'recruiter' && row.recruiter_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to view this application',
      });
    }

    const application = {
      id: row.id,
      status: row.status,
      cover_letter: row.cover_letter,
      created_at: row.created_at,
      updated_at: row.updated_at,
      job: {
        id: row.job_id,
        title: row.job_title,
        company_name: row.company_name,
      },
      student: {
        id: row.student_id,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        email: row.student_email,
        skills: row.skills,
        cv_url: row.cv_url,
        bio: row.bio,
        location: row.location,
      },
    };

    return res.status(200).json({
      success: true,
      data: { application },
      message: 'Application retrieved successfully',
    });
  } catch (err) {
    logger.error('Error fetching application', { applicationId: req.params.id, error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve application',
    });
  }
};

module.exports = {
  applyToJob,
  getJobApplications,
  updateApplicationStatus,
  getMyApplications,
  withdrawApplication,
  getApplicationById,
};
