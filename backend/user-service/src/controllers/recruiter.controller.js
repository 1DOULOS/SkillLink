'use strict';

const { query } = require('../config/db');
const logger = require('../config/logger');

/**
 * GET /api/users/recruiter/profile
 * Get recruiter profile for the authenticated recruiter.
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at,
              rp.id as profile_id, rp.first_name, rp.last_name, rp.company_name,
              rp.company_website, rp.company_description, rp.industry, rp.position,
              rp.phone, rp.company_logo_url,
              rp.created_at as profile_created_at, rp.updated_at as profile_updated_at
       FROM users u
       LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'recruiter'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Recruiter profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recruiter profile retrieved successfully',
      data: {
        user: result.rows[0],
      },
    });
  } catch (err) {
    logger.error('Get recruiter profile error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving the recruiter profile',
    });
  }
};

/**
 * PUT /api/users/recruiter/profile
 * Update recruiter profile for the authenticated recruiter.
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      company_name,
      company_website,
      company_description,
      industry,
      position,
      phone,
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (first_name !== undefined) { updates.push(`first_name = $${paramIndex++}`); values.push(first_name); }
    if (last_name !== undefined) { updates.push(`last_name = $${paramIndex++}`); values.push(last_name); }
    if (company_name !== undefined) { updates.push(`company_name = $${paramIndex++}`); values.push(company_name); }
    if (company_website !== undefined) { updates.push(`company_website = $${paramIndex++}`); values.push(company_website); }
    if (company_description !== undefined) { updates.push(`company_description = $${paramIndex++}`); values.push(company_description); }
    if (industry !== undefined) { updates.push(`industry = $${paramIndex++}`); values.push(industry); }
    if (position !== undefined) { updates.push(`position = $${paramIndex++}`); values.push(position); }
    if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); values.push(phone); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'No fields to update provided',
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const updateResult = await query(
      `UPDATE recruiter_profiles SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Recruiter profile not found',
      });
    }

    logger.info('Recruiter profile updated', { userId });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile: updateResult.rows[0],
      },
    });
  } catch (err) {
    logger.error('Update recruiter profile error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while updating the profile',
    });
  }
};

/**
 * POST /api/users/recruiter/logo
 * Upload company logo and update company_logo_url in recruiter_profiles.
 */
const uploadLogo = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'No logo file uploaded. Please upload a JPG or PNG image.',
      });
    }

    const logoUrl = `/uploads/${req.file.filename}`;

    const updateResult = await query(
      'UPDATE recruiter_profiles SET company_logo_url = $1, updated_at = NOW() WHERE user_id = $2 RETURNING company_logo_url',
      [logoUrl, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Recruiter profile not found',
      });
    }

    logger.info('Company logo uploaded', { userId, filename: req.file.filename });

    return res.status(200).json({
      success: true,
      message: 'Company logo uploaded successfully',
      data: {
        company_logo_url: logoUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (err) {
    logger.error('Upload logo error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while uploading the logo',
    });
  }
};

/**
 * GET /api/users/recruiter/:id
 * Get recruiter profile by ID (public).
 */
const getRecruiterById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.id, u.email, u.role, u.created_at,
              rp.first_name, rp.last_name, rp.company_name, rp.company_website,
              rp.company_description, rp.industry, rp.position, rp.company_logo_url
       FROM users u
       LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'recruiter' AND u.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Recruiter not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recruiter profile retrieved successfully',
      data: {
        recruiter: result.rows[0],
      },
    });
  } catch (err) {
    logger.error('Get recruiter by ID error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving the recruiter profile',
    });
  }
};

/**
 * GET /api/admin/recruiters (accessed via admin or internal)
 * Get all recruiters with pagination (admin only).
 */
const getAllRecruiters = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const countResult = await query(
      "SELECT COUNT(*) as total FROM users WHERE role = 'recruiter'"
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const recruitersResult = await query(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
              rp.first_name, rp.last_name, rp.company_name, rp.company_website,
              rp.industry, rp.position, rp.company_logo_url
       FROM users u
       LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
       WHERE u.role = 'recruiter'
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.status(200).json({
      success: true,
      message: 'Recruiters retrieved successfully',
      data: {
        recruiters: recruitersResult.rows,
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (err) {
    logger.error('Get all recruiters error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving recruiters',
    });
  }
};

/**
 * GET /api/users/recruiter/stats
 * Get dashboard stats for the authenticated recruiter.
 */
const getRecruiterStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const statsResult = await query(
      `SELECT
         COUNT(DISTINCT j.id) as total_jobs_posted,
         COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'active') as active_jobs,
         COUNT(a.id) as total_applications_received,
         COUNT(a.id) FILTER (WHERE a.status = 'pending') as pending_applications,
         COUNT(a.id) FILTER (WHERE a.status = 'shortlisted') as shortlisted_candidates
       FROM jobs j
       LEFT JOIN applications a ON a.job_id = j.id
       WHERE j.recruiter_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Recruiter stats retrieved successfully',
      data: {
        totalJobsPosted: parseInt(stats.total_jobs_posted, 10) || 0,
        activeJobs: parseInt(stats.active_jobs, 10) || 0,
        totalApplicationsReceived: parseInt(stats.total_applications_received, 10) || 0,
        pendingApplications: parseInt(stats.pending_applications, 10) || 0,
        shortlistedCandidates: parseInt(stats.shortlisted_candidates, 10) || 0,
      },
    });
  } catch (err) {
    logger.error('Get recruiter stats error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving recruiter stats',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadLogo,
  getRecruiterById,
  getAllRecruiters,
  getRecruiterStats,
};
