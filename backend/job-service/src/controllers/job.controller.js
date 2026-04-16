'use strict';

const { query } = require('../config/db');
const logger = require('../config/logger');

const VALID_JOB_TYPES = ['full-time', 'part-time', 'internship', 'contract', 'remote'];
const VALID_STATUSES = ['active', 'draft', 'closed'];

/**
 * POST /api/jobs
 * Create a new job posting. Recruiter only.
 */
const createJob = async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const {
      title,
      description,
      requirements,
      skills_required,
      location,
      job_type,
      salary_min,
      salary_max,
      deadline,
      status = 'draft',
    } = req.body;

    if (!title || !description || !job_type) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'title, description, and job_type are required',
      });
    }

    if (!VALID_JOB_TYPES.includes(job_type)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `job_type must be one of: ${VALID_JOB_TYPES.join(', ')}`,
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    if (salary_min !== undefined && salary_max !== undefined) {
      if (Number(salary_min) > Number(salary_max)) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'salary_min cannot be greater than salary_max',
        });
      }
    }

    const skillsArray =
      Array.isArray(skills_required) ? skills_required : [];

    const result = await query(
      `INSERT INTO jobs
         (recruiter_id, title, description, requirements, skills_required,
          location, job_type, salary_min, salary_max, deadline, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
       RETURNING *`,
      [
        recruiterId,
        title,
        description,
        requirements || null,
        skillsArray,
        location || null,
        job_type,
        salary_min || null,
        salary_max || null,
        deadline || null,
        status,
      ]
    );

    const job = result.rows[0];
    logger.info('Job created', { jobId: job.id, recruiterId });

    return res.status(201).json({
      success: true,
      data: { job },
      message: 'Job created successfully',
    });
  } catch (err) {
    logger.error('Error creating job', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to create job',
    });
  }
};

/**
 * GET /api/jobs
 * Public endpoint. Returns active jobs with optional filters and pagination.
 */
const getAllJobs = async (req, res) => {
  try {
    const {
      job_type,
      location,
      skills,
      search,
      salary_min,
      salary_max,
      page = 1,
      limit = 12,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ["j.status = 'active'"];
    const params = [];
    let paramIndex = 1;

    if (job_type) {
      conditions.push(`j.job_type = $${paramIndex++}`);
      params.push(job_type);
    }

    if (location) {
      conditions.push(`j.location ILIKE $${paramIndex++}`);
      params.push(`%${location}%`);
    }

    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      conditions.push(`j.skills_required && $${paramIndex++}::text[]`);
      params.push(skillsArray);
    }

    if (search) {
      conditions.push(
        `(j.title ILIKE $${paramIndex} OR j.description ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (salary_min) {
      conditions.push(`j.salary_max >= $${paramIndex++}`);
      params.push(Number(salary_min));
    }

    if (salary_max) {
      conditions.push(`j.salary_min <= $${paramIndex++}`);
      params.push(Number(salary_max));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseQuery = `
      FROM jobs j
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users u ON j.recruiter_id = u.id
      ${whereClause}
    `;

    const countResult = await query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limitNum, offset];
    const jobsResult = await query(
      `SELECT
         j.id, j.title, j.description, j.requirements, j.skills_required,
         j.location, j.job_type, j.salary_min, j.salary_max, j.deadline,
         j.status, j.created_at,
         rp.company_name, rp.industry,
         rp.first_name AS recruiter_first_name,
         rp.last_name  AS recruiter_last_name
       ${baseQuery}
       ORDER BY j.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      dataParams
    );

    const jobs = jobsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      requirements: row.requirements,
      skills_required: row.skills_required,
      location: row.location,
      job_type: row.job_type,
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      deadline: row.deadline,
      status: row.status,
      created_at: row.created_at,
      recruiter: {
        company_name: row.company_name,
        industry: row.industry,
        first_name: row.recruiter_first_name,
        last_name: row.recruiter_last_name,
      },
    }));

    return res.status(200).json({
      success: true,
      data: {
        jobs,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
      message: 'Jobs retrieved successfully',
    });
  } catch (err) {
    logger.error('Error fetching jobs', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve jobs',
    });
  }
};

/**
 * GET /api/jobs/:id
 * Public. Returns single job with recruiter info, application count,
 * and (if student is authenticated) whether they have applied.
 */
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
         j.id, j.title, j.description, j.requirements, j.skills_required,
         j.location, j.job_type, j.salary_min, j.salary_max, j.deadline,
         j.status, j.created_at, j.updated_at, j.recruiter_id,
         rp.company_name, rp.industry,
         rp.first_name AS recruiter_first_name,
         rp.last_name  AS recruiter_last_name,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
       FROM jobs j
       LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
       LEFT JOIN users u ON j.recruiter_id = u.id
       WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Job not found',
      });
    }

    const row = result.rows[0];
    const job = {
      id: row.id,
      title: row.title,
      description: row.description,
      requirements: row.requirements,
      skills_required: row.skills_required,
      location: row.location,
      job_type: row.job_type,
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      deadline: row.deadline,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      application_count: parseInt(row.application_count, 10),
      recruiter: {
        company_name: row.company_name,
        industry: row.industry,
        first_name: row.recruiter_first_name,
        last_name: row.recruiter_last_name,
      },
    };

    // If a student is authenticated, check whether they have already applied
    if (req.user && req.user.role === 'student') {
      const appCheck = await query(
        'SELECT id FROM applications WHERE student_id = $1 AND job_id = $2',
        [req.user.id, id]
      );
      job.has_applied = appCheck.rows.length > 0;
    }

    return res.status(200).json({
      success: true,
      data: { job },
      message: 'Job retrieved successfully',
    });
  } catch (err) {
    logger.error('Error fetching job', { jobId: req.params.id, error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve job',
    });
  }
};

/**
 * PUT /api/jobs/:id
 * Update a job. Only the owning recruiter or an admin can do this.
 */
const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify the job exists
    const existing = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Job not found',
      });
    }

    const job = existing.rows[0];

    // Non-admin recruiters can only update their own jobs
    if (userRole !== 'admin' && job.recruiter_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to update this job',
      });
    }

    const {
      title,
      description,
      requirements,
      skills_required,
      location,
      job_type,
      salary_min,
      salary_max,
      deadline,
      status,
    } = req.body;

    if (job_type && !VALID_JOB_TYPES.includes(job_type)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `job_type must be one of: ${VALID_JOB_TYPES.join(', ')}`,
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const updatedTitle = title !== undefined ? title : job.title;
    const updatedDescription = description !== undefined ? description : job.description;
    const updatedRequirements = requirements !== undefined ? requirements : job.requirements;
    const updatedSkills = skills_required !== undefined
      ? (Array.isArray(skills_required) ? skills_required : job.skills_required)
      : job.skills_required;
    const updatedLocation = location !== undefined ? location : job.location;
    const updatedJobType = job_type !== undefined ? job_type : job.job_type;
    const updatedSalaryMin = salary_min !== undefined ? salary_min : job.salary_min;
    const updatedSalaryMax = salary_max !== undefined ? salary_max : job.salary_max;
    const updatedDeadline = deadline !== undefined ? deadline : job.deadline;
    const updatedStatus = status !== undefined ? status : job.status;

    if (updatedSalaryMin !== null && updatedSalaryMax !== null) {
      if (Number(updatedSalaryMin) > Number(updatedSalaryMax)) {
        return res.status(400).json({
          success: false,
          error: 'ValidationError',
          message: 'salary_min cannot be greater than salary_max',
        });
      }
    }

    const result = await query(
      `UPDATE jobs
       SET title=$1, description=$2, requirements=$3, skills_required=$4,
           location=$5, job_type=$6, salary_min=$7, salary_max=$8,
           deadline=$9, status=$10, updated_at=NOW()
       WHERE id=$11
       RETURNING *`,
      [
        updatedTitle,
        updatedDescription,
        updatedRequirements,
        updatedSkills,
        updatedLocation,
        updatedJobType,
        updatedSalaryMin,
        updatedSalaryMax,
        updatedDeadline,
        updatedStatus,
        id,
      ]
    );

    logger.info('Job updated', { jobId: id, userId });

    return res.status(200).json({
      success: true,
      data: { job: result.rows[0] },
      message: 'Job updated successfully',
    });
  } catch (err) {
    logger.error('Error updating job', { jobId: req.params.id, error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to update job',
    });
  }
};

/**
 * DELETE /api/jobs/:id
 * Delete a job. Only owning recruiter or admin. Cascades to applications.
 */
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const existing = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Job not found',
      });
    }

    const job = existing.rows[0];

    if (userRole !== 'admin' && job.recruiter_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not authorized to delete this job',
      });
    }

    await query('DELETE FROM jobs WHERE id = $1', [id]);
    logger.info('Job deleted', { jobId: id, userId });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Job deleted successfully',
    });
  } catch (err) {
    logger.error('Error deleting job', { jobId: req.params.id, error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to delete job',
    });
  }
};

/**
 * GET /api/jobs/my
 * Recruiter: list their own job postings with application counts.
 */
const getMyJobs = async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const { status, page = 1, limit = 12 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['j.recruiter_id = $1'];
    const params = [recruiterId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`j.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM jobs j ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, limitNum, offset];
    const jobsResult = await query(
      `SELECT
         j.*,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
       FROM jobs j
       ${whereClause}
       ORDER BY j.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      dataParams
    );

    const jobs = jobsResult.rows.map((row) => ({
      ...row,
      application_count: parseInt(row.application_count, 10),
    }));

    return res.status(200).json({
      success: true,
      data: {
        jobs,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
      message: 'Your jobs retrieved successfully',
    });
  } catch (err) {
    logger.error('Error fetching recruiter jobs', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve jobs',
    });
  }
};

/**
 * GET /api/jobs/stats
 * Recruiter: summary stats for their job postings.
 */
const getJobStats = async (req, res) => {
  try {
    const recruiterId = req.user.id;

    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE TRUE)                    AS total_jobs,
         COUNT(*) FILTER (WHERE status = 'active')       AS active_jobs,
         COUNT(*) FILTER (WHERE status = 'draft')        AS draft_jobs,
         COUNT(*) FILTER (WHERE status = 'closed')       AS closed_jobs
       FROM jobs
       WHERE recruiter_id = $1`,
      [recruiterId]
    );

    const appResult = await query(
      `SELECT COUNT(*) AS total_applications
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE j.recruiter_id = $1`,
      [recruiterId]
    );

    const stats = {
      totalJobs: parseInt(result.rows[0].total_jobs, 10),
      activeJobs: parseInt(result.rows[0].active_jobs, 10),
      draftJobs: parseInt(result.rows[0].draft_jobs, 10),
      closedJobs: parseInt(result.rows[0].closed_jobs, 10),
      totalApplicationsReceived: parseInt(appResult.rows[0].total_applications, 10),
    };

    return res.status(200).json({
      success: true,
      data: { stats },
      message: 'Job stats retrieved successfully',
    });
  } catch (err) {
    logger.error('Error fetching job stats', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'Failed to retrieve job stats',
    });
  }
};

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getJobStats,
};
