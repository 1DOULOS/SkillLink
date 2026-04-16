'use strict';

const { query } = require('../config/db');
const logger = require('../config/logger');

/**
 * Calculate profile completion percentage for a student.
 */
const calculateProfileCompletion = (profile) => {
  const fields = [
    'first_name',
    'last_name',
    'phone',
    'bio',
    'location',
    'github_url',
    'linkedin_url',
    'cv_url',
    'avatar_url',
  ];

  const skillsScore = profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0 ? 1 : 0;
  const totalFields = fields.length + 1; // +1 for skills
  let filledFields = skillsScore;

  for (const field of fields) {
    if (profile[field] !== null && profile[field] !== undefined && profile[field] !== '') {
      filledFields++;
    }
  }

  return Math.round((filledFields / totalFields) * 100);
};

/**
 * GET /api/users/profile
 * Get the student profile for the authenticated user.
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at,
              sp.id as profile_id, sp.first_name, sp.last_name, sp.phone, sp.bio,
              sp.location, sp.github_url, sp.linkedin_url, sp.skills, sp.cv_url, sp.avatar_url,
              sp.created_at as profile_created_at, sp.updated_at as profile_updated_at
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'student'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Student profile not found',
      });
    }

    const profile = result.rows[0];
    const profileCompletion = calculateProfileCompletion(profile);

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          ...profile,
          profileCompletion,
        },
      },
    });
  } catch (err) {
    logger.error('Get student profile error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving the profile',
    });
  }
};

/**
 * PUT /api/users/profile
 * Update student profile for the authenticated user.
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      phone,
      bio,
      location,
      github_url,
      linkedin_url,
      skills,
    } = req.body;

    // Validate skills if provided
    if (skills !== undefined && !Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Skills must be an array',
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (first_name !== undefined) { updates.push(`first_name = $${paramIndex++}`); values.push(first_name); }
    if (last_name !== undefined) { updates.push(`last_name = $${paramIndex++}`); values.push(last_name); }
    if (phone !== undefined) { updates.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (bio !== undefined) { updates.push(`bio = $${paramIndex++}`); values.push(bio); }
    if (location !== undefined) { updates.push(`location = $${paramIndex++}`); values.push(location); }
    if (github_url !== undefined) { updates.push(`github_url = $${paramIndex++}`); values.push(github_url); }
    if (linkedin_url !== undefined) { updates.push(`linkedin_url = $${paramIndex++}`); values.push(linkedin_url); }
    if (skills !== undefined) { updates.push(`skills = $${paramIndex++}`); values.push(JSON.stringify(skills)); }

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
      `UPDATE student_profiles SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Student profile not found',
      });
    }

    const updatedProfile = updateResult.rows[0];
    const profileCompletion = calculateProfileCompletion(updatedProfile);

    logger.info('Student profile updated', { userId });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile: {
          ...updatedProfile,
          profileCompletion,
        },
      },
    });
  } catch (err) {
    logger.error('Update student profile error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while updating the profile',
    });
  }
};

/**
 * POST /api/users/cv
 * Upload CV file and update cv_url in student_profiles.
 */
const uploadCV = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'No CV file uploaded. Please upload a PDF file.',
      });
    }

    const cvUrl = `/uploads/${req.file.filename}`;

    const updateResult = await query(
      'UPDATE student_profiles SET cv_url = $1, updated_at = NOW() WHERE user_id = $2 RETURNING cv_url',
      [cvUrl, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Student profile not found',
      });
    }

    logger.info('CV uploaded successfully', { userId, filename: req.file.filename });

    return res.status(200).json({
      success: true,
      message: 'CV uploaded successfully',
      data: {
        cv_url: cvUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (err) {
    logger.error('Upload CV error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while uploading the CV',
    });
  }
};

/**
 * POST /api/users/avatar
 * Upload avatar image and update avatar_url in student_profiles.
 */
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'No avatar file uploaded. Please upload a JPG or PNG image.',
      });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    const updateResult = await query(
      'UPDATE student_profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2 RETURNING avatar_url',
      [avatarUrl, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Student profile not found',
      });
    }

    logger.info('Avatar uploaded successfully', { userId, filename: req.file.filename });

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar_url: avatarUrl,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (err) {
    logger.error('Upload avatar error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while uploading the avatar',
    });
  }
};

/**
 * GET /api/users/students/:id
 * Get student profile by ID (for recruiters/admin).
 */
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
              sp.first_name, sp.last_name, sp.bio, sp.location,
              sp.github_url, sp.linkedin_url, sp.skills, sp.avatar_url, sp.cv_url
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'student' AND u.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Student not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Student profile retrieved successfully',
      data: {
        student: result.rows[0],
      },
    });
  } catch (err) {
    logger.error('Get student by ID error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving the student profile',
    });
  }
};

/**
 * GET /api/users/students
 * Get all students with pagination and search (for recruiters/admin).
 */
const getAllStudents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : null;

    let whereClause = "WHERE u.role = 'student' AND u.is_active = true";
    const queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (
        LOWER(sp.first_name) LIKE $${paramIndex} OR
        LOWER(sp.last_name) LIKE $${paramIndex} OR
        LOWER(u.email) LIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN sp.skills IS NULL THEN '[]'::jsonb
                 WHEN jsonb_typeof(sp.skills::jsonb) = 'array' THEN sp.skills::jsonb
                 ELSE '[]'::jsonb END
          ) skill WHERE LOWER(skill) LIKE $${paramIndex}
        )
      )`;
      queryParams.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total, 10);

    queryParams.push(limit, offset);

    const studentsResult = await query(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
              sp.first_name, sp.last_name, sp.bio, sp.location,
              sp.github_url, sp.linkedin_url, sp.skills, sp.avatar_url, sp.cv_url
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    return res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      data: {
        students: studentsResult.rows,
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (err) {
    logger.error('Get all students error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving students',
    });
  }
};

/**
 * PUT /api/users/skills
 * Update skills array for a student.
 */
const updateSkills = async (req, res) => {
  try {
    const userId = req.user.id;
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Skills must be an array',
      });
    }

    // Validate each skill is a non-empty string
    const validSkills = skills
      .filter((skill) => typeof skill === 'string' && skill.trim().length > 0)
      .map((skill) => skill.trim());

    const updateResult = await query(
      `UPDATE student_profiles
       SET skills = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING skills`,
      [JSON.stringify(validSkills), userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'Student profile not found',
      });
    }

    logger.info('Skills updated', { userId, skillCount: validSkills.length });

    return res.status(200).json({
      success: true,
      message: 'Skills updated successfully',
      data: {
        skills: updateResult.rows[0].skills,
      },
    });
  } catch (err) {
    logger.error('Update skills error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while updating skills',
    });
  }
};

/**
 * GET /api/users/stats
 * Get dashboard stats for the authenticated student.
 */
const getStudentStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get application stats
    const statsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IS NOT NULL) as total_applications,
         COUNT(*) FILTER (WHERE status = 'pending') as pending_applications,
         COUNT(*) FILTER (WHERE status = 'shortlisted') as shortlisted_applications,
         COUNT(*) FILTER (WHERE status = 'accepted') as accepted_applications,
         COUNT(*) FILTER (WHERE status = 'rejected') as rejected_applications
       FROM applications
       WHERE student_id = $1`,
      [userId]
    );

    // Get profile for completion calculation
    const profileResult = await query(
      'SELECT * FROM student_profiles WHERE user_id = $1',
      [userId]
    );

    const stats = statsResult.rows[0] || {};
    const profile = profileResult.rows[0] || {};
    const profileCompletion = calculateProfileCompletion(profile);

    return res.status(200).json({
      success: true,
      message: 'Student stats retrieved successfully',
      data: {
        totalApplications: parseInt(stats.total_applications, 10) || 0,
        pendingApplications: parseInt(stats.pending_applications, 10) || 0,
        shortlistedApplications: parseInt(stats.shortlisted_applications, 10) || 0,
        acceptedApplications: parseInt(stats.accepted_applications, 10) || 0,
        rejectedApplications: parseInt(stats.rejected_applications, 10) || 0,
        profileCompletion,
      },
    });
  } catch (err) {
    logger.error('Get student stats error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving student stats',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadCV,
  uploadAvatar,
  getStudentById,
  getAllStudents,
  updateSkills,
  getStudentStats,
};
