'use strict';

const { query } = require('../config/db');
const logger = require('../config/logger');

/**
 * GET /api/admin/users
 * Get all users with pagination and optional role filter.
 */
const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const roleFilter = req.query.role;

    const validRoles = ['student', 'recruiter', 'admin'];

    let whereClause = '';
    const queryParams = [];
    let paramIndex = 1;

    if (roleFilter && validRoles.includes(roleFilter)) {
      whereClause = `WHERE u.role = $${paramIndex++}`;
      queryParams.push(roleFilter);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total, 10);

    queryParams.push(limit, offset);

    const usersResult = await query(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: usersResult.rows,
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (err) {
    logger.error('Get all users error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving users',
    });
  }
};

/**
 * GET /api/admin/users/:id
 * Get full user info with profile.
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // First get user basics
    const userResult = await query(
      'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];
    let profile = null;

    if (user.role === 'student') {
      const profileResult = await query(
        `SELECT id, first_name, last_name, phone, bio, location,
                github_url, linkedin_url, skills, cv_url, avatar_url,
                created_at, updated_at
         FROM student_profiles WHERE user_id = $1`,
        [id]
      );
      profile = profileResult.rows[0] || null;
    } else if (user.role === 'recruiter') {
      const profileResult = await query(
        `SELECT id, first_name, last_name, company_name, company_website,
                company_description, industry, position, phone, company_logo_url,
                created_at, updated_at
         FROM recruiter_profiles WHERE user_id = $1`,
        [id]
      );
      profile = profileResult.rows[0] || null;
    }

    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user: {
          ...user,
          profile,
        },
      },
    });
  } catch (err) {
    logger.error('Get user by ID error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving the user',
    });
  }
};

/**
 * PUT /api/admin/users/:id/status
 * Toggle user is_active status.
 */
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'is_active must be a boolean value',
      });
    }

    // Prevent admin from deactivating themselves
    if (req.user.id === id && !is_active) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'You cannot deactivate your own account',
      });
    }

    const updateResult = await query(
      `UPDATE users SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, role, is_active, updated_at`,
      [is_active, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found',
      });
    }

    const action = is_active ? 'activated' : 'deactivated';
    logger.info(`User ${action}`, { targetUserId: id, adminId: req.user.id });

    return res.status(200).json({
      success: true,
      message: `User ${action} successfully`,
      data: {
        user: updateResult.rows[0],
      },
    });
  } catch (err) {
    logger.error('Update user status error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while updating user status',
    });
  }
};

/**
 * DELETE /api/admin/users/:id
 * Soft-delete a user (set is_active = false). Can hard-delete with ?hard=true.
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const hardDelete = req.query.hard === 'true';

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        error: 'BadRequest',
        message: 'You cannot delete your own account',
      });
    }

    // Check user exists
    const existsResult = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found',
      });
    }

    if (hardDelete) {
      // Hard delete: remove profile first (FK constraint), then user
      const userRole = existsResult.rows[0].role;
      if (userRole === 'student') {
        await query('DELETE FROM student_profiles WHERE user_id = $1', [id]);
      } else if (userRole === 'recruiter') {
        await query('DELETE FROM recruiter_profiles WHERE user_id = $1', [id]);
      }
      await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
      await query('DELETE FROM users WHERE id = $1', [id]);

      logger.info('User hard-deleted', { targetUserId: id, adminId: req.user.id });

      return res.status(200).json({
        success: true,
        message: 'User permanently deleted',
        data: null,
      });
    } else {
      // Soft delete: just set is_active = false
      await query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      logger.info('User soft-deleted', { targetUserId: id, adminId: req.user.id });

      return res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: null,
      });
    }
  } catch (err) {
    logger.error('Delete user error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while deleting the user',
    });
  }
};

/**
 * GET /api/admin/stats
 * Get platform-wide statistics.
 */
const getPlatformStats = async (req, res) => {
  try {
    // Total counts
    const countsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'student') as total_students,
         COUNT(*) FILTER (WHERE role = 'recruiter') as total_recruiters
       FROM users WHERE is_active = true`
    );

    const jobsResult = await query('SELECT COUNT(*) as total_jobs FROM jobs');
    const applicationsResult = await query('SELECT COUNT(*) as total_applications FROM applications');

    // Recent registrations (last 7 days)
    const recentResult = await query(
      `SELECT COUNT(*) as recent_registrations
       FROM users
       WHERE created_at >= NOW() - INTERVAL '7 days'`
    );

    // Registrations by day (last 7 days)
    const byDayResult = await query(
      `SELECT
         DATE(created_at) as date,
         COUNT(*) as count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    const counts = countsResult.rows[0] || {};
    const jobs = jobsResult.rows[0] || {};
    const applications = applicationsResult.rows[0] || {};
    const recent = recentResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Platform stats retrieved successfully',
      data: {
        totalStudents: parseInt(counts.total_students, 10) || 0,
        totalRecruiters: parseInt(counts.total_recruiters, 10) || 0,
        totalJobs: parseInt(jobs.total_jobs, 10) || 0,
        totalApplications: parseInt(applications.total_applications, 10) || 0,
        recentRegistrations: parseInt(recent.recent_registrations, 10) || 0,
        registrationsByDay: byDayResult.rows.map((row) => ({
          date: row.date,
          count: parseInt(row.count, 10),
        })),
      },
    });
  } catch (err) {
    logger.error('Get platform stats error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving platform stats',
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
  getPlatformStats,
};
