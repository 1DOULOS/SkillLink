'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const logger = require('../config/logger');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'skilllink-jwt-secret-2026-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'skilllink-refresh-secret-2026-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate JWT access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
};

/**
 * Calculate refresh token expiry date
 */
const getRefreshTokenExpiry = () => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
};

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, role, first_name, last_name } = req.body;

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'ConflictError',
        message: 'An account with this email already exists',
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uuidv4();

    // Insert user record
    const insertUserResult = await query(
      `INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id, email, role, is_active, created_at`,
      [userId, email.toLowerCase(), hashedPassword, role]
    );

    const newUser = insertUserResult.rows[0];

    // Create role-specific profile
    if (role === 'student') {
      await query(
        `INSERT INTO student_profiles (id, user_id, first_name, last_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [uuidv4(), userId, first_name || null, last_name || null]
      );
    } else if (role === 'recruiter') {
      await query(
        `INSERT INTO recruiter_profiles (id, user_id, first_name, last_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [uuidv4(), userId, first_name || null, last_name || null]
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // Hash the refresh token before storing
    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    const refreshTokenId = uuidv4();
    const expiresAt = getRefreshTokenExpiry();

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [refreshTokenId, userId, hashedRefreshToken, expiresAt]
    );

    logger.info('User registered successfully', { userId, email: newUser.email, role });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          is_active: newUser.is_active,
          created_at: newUser.created_at,
        },
      },
    });
  } catch (err) {
    logger.error('Register error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while creating your account',
    });
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const userResult = await query(
      'SELECT id, email, password_hash, role, is_active, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid email or password',
      });
    }

    const user = userResult.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'AccountDisabled',
        message: 'Your account has been disabled. Please contact support.',
      });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Invalid email or password',
      });
    }

    // Delete old refresh tokens for this user
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Hash and store new refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    const refreshTokenId = uuidv4();
    const expiresAt = getRefreshTokenExpiry();

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [refreshTokenId, user.id, hashedRefreshToken, expiresAt]
    );

    logger.info('User logged in', { userId: user.id, email: user.email });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
        },
      },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred during login',
    });
  }
};

/**
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Refresh token is required',
      });
    }

    // Verify the refresh token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'InvalidToken',
        message: 'Invalid or expired refresh token',
      });
    }

    // Find matching token record in DB (check expiry in DB too)
    const tokenRecords = await query(
      `SELECT rt.id, rt.token_hash, rt.expires_at, u.id as user_id, u.email, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.user_id = $1 AND rt.expires_at > NOW()`,
      [decoded.id]
    );

    if (tokenRecords.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'InvalidToken',
        message: 'Invalid or expired refresh token',
      });
    }

    // Check which stored token matches
    let matchedRecord = null;
    for (const record of tokenRecords.rows) {
      const matches = await bcrypt.compare(token, record.token_hash);
      if (matches) {
        matchedRecord = record;
        break;
      }
    }

    if (!matchedRecord) {
      return res.status(401).json({
        success: false,
        error: 'InvalidToken',
        message: 'Invalid or expired refresh token',
      });
    }

    if (!matchedRecord.is_active) {
      return res.status(403).json({
        success: false,
        error: 'AccountDisabled',
        message: 'Your account has been disabled',
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      id: matchedRecord.user_id,
      email: matchedRecord.email,
      role: matchedRecord.role,
    });

    logger.info('Access token refreshed', { userId: matchedRecord.user_id });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (err) {
    logger.error('Refresh token error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while refreshing the token',
    });
  }
};

/**
 * POST /api/auth/logout
 * Requires authenticate middleware
 */
const logout = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      // Find and delete the specific refresh token
      const tokenRecords = await query(
        'SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1',
        [req.user.id]
      );

      for (const record of tokenRecords.rows) {
        const matches = await bcrypt.compare(token, record.token_hash);
        if (matches) {
          await query('DELETE FROM refresh_tokens WHERE id = $1', [record.id]);
          break;
        }
      }
    } else {
      // Delete all refresh tokens for this user
      await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);
    }

    logger.info('User logged out', { userId: req.user.id });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: null,
    });
  } catch (err) {
    logger.error('Logout error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred during logout',
    });
  }
};

/**
 * GET /api/auth/me
 * Requires authenticate middleware
 */
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let userResult;

    if (role === 'student') {
      userResult = await query(
        `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at,
                sp.first_name, sp.last_name, sp.phone, sp.bio, sp.location,
                sp.github_url, sp.linkedin_url, sp.skills, sp.cv_url, sp.avatar_url
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );
    } else if (role === 'recruiter') {
      userResult = await query(
        `SELECT u.id, u.email, u.role, u.is_active, u.created_at, u.updated_at,
                rp.first_name, rp.last_name, rp.company_name, rp.company_website,
                rp.company_description, rp.industry, rp.position, rp.phone, rp.company_logo_url
         FROM users u
         LEFT JOIN recruiter_profiles rp ON rp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );
    } else {
      userResult = await query(
        'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = $1',
        [userId]
      );
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        user: userResult.rows[0],
      },
    });
  } catch (err) {
    logger.error('Get me error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while retrieving user profile',
    });
  }
};

/**
 * PUT /api/auth/change-password
 * Requires authenticate middleware
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current password hash
    const userResult = await query('SELECT id, password_hash FROM users WHERE id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NotFound',
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'InvalidCredentials',
        message: 'Current password is incorrect',
      });
    }

    // Hash and update new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedNewPassword, userId]
    );

    // Invalidate all refresh tokens after password change
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

    logger.info('Password changed successfully', { userId });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
      data: null,
    });
  } catch (err) {
    logger.error('Change password error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: 'An error occurred while changing password',
    });
  }
};

module.exports = { register, login, refreshToken, logout, getMe, changePassword };
