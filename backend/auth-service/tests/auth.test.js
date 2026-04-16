'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Mock the database module BEFORE requiring app
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: {
    on: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  },
}));

const app = require('../src/app');
const { query } = require('../src/config/db');

// Helper to generate test tokens
const generateTestAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    'test-jwt-secret',
    { expiresIn: '15m' }
  );
};

const generateTestRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    'test-refresh-secret',
    { expiresIn: '7d' }
  );
};

describe('Auth Service', () => {
  const testUserId = uuidv4();
  const testUser = {
    id: testUserId,
    email: 'test@example.com',
    password_hash: null, // will be set in beforeAll
    role: 'student',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeAll(async () => {
    testUser.password_hash = await bcrypt.hash('Password123', 10);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== REGISTER ====================
  describe('POST /api/auth/register', () => {
    it('should register a new student successfully', async () => {
      // Email check - no existing user
      query.mockResolvedValueOnce({ rows: [] });
      // Insert user
      query.mockResolvedValueOnce({
        rows: [{
          id: testUserId,
          email: 'newuser@example.com',
          role: 'student',
          is_active: true,
          created_at: new Date().toISOString(),
        }],
      });
      // Insert student_profile
      query.mockResolvedValueOnce({ rows: [] });
      // Insert refresh token
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'Password123',
          role: 'student',
          first_name: 'John',
          last_name: 'Doe',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe('newuser@example.com');
      expect(res.body.data.user.role).toBe('student');
      expect(res.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should register a new recruiter successfully', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({
        rows: [{
          id: testUserId,
          email: 'recruiter@company.com',
          role: 'recruiter',
          is_active: true,
          created_at: new Date().toISOString(),
        }],
      });
      query.mockResolvedValueOnce({ rows: [] }); // recruiter_profile
      query.mockResolvedValueOnce({ rows: [] }); // refresh_token

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'recruiter@company.com',
          password: 'Password123',
          role: 'recruiter',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('recruiter');
    });

    it('should return 409 if email already exists', async () => {
      // Email check - existing user found
      query.mockResolvedValueOnce({ rows: [{ id: testUserId }] });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'Password123',
          role: 'student',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ConflictError');
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'Password123',
          role: 'student',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 400 for password without uppercase', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          role: 'student',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return 400 for password without number', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'PasswordABC',
          role: 'student',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for password too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'P1a',
          role: 'student',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          role: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 on database error', async () => {
      query.mockRejectedValueOnce(new Error('DB connection failed'));

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
          role: 'student',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('InternalServerError');
    });
  });

  // ==================== LOGIN ====================
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      query.mockResolvedValueOnce({ rows: [testUser] });
      // Delete old refresh tokens
      query.mockResolvedValueOnce({ rows: [] });
      // Insert new refresh token
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should return 401 for non-existent email', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('InvalidCredentials');
    });

    it('should return 401 for wrong password', async () => {
      query.mockResolvedValueOnce({ rows: [testUser] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('InvalidCredentials');
    });

    it('should return 403 for inactive user', async () => {
      const inactiveUser = { ...testUser, is_active: false };
      query.mockResolvedValueOnce({ rows: [inactiveUser] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('AccountDisabled');
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'Password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 on database error', async () => {
      query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== REFRESH TOKEN ====================
  describe('POST /api/auth/refresh', () => {
    it('should return new access token with valid refresh token', async () => {
      const validRefreshToken = generateTestRefreshToken(testUser);
      const tokenHash = await bcrypt.hash(validRefreshToken, 10);

      query.mockResolvedValueOnce({
        rows: [{
          id: uuidv4(),
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          user_id: testUser.id,
          email: testUser.email,
          role: testUser.role,
          is_active: true,
        }],
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('should return 401 for invalid/expired refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('InvalidToken');
    });

    it('should return 401 when refresh token not found in DB', async () => {
      const validRefreshToken = generateTestRefreshToken(testUser);

      // DB returns empty - token not stored or expired
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('InvalidToken');
    });

    it('should return 401 when token hash does not match any stored token', async () => {
      const validRefreshToken = generateTestRefreshToken(testUser);
      const differentHash = await bcrypt.hash('different_token', 10);

      query.mockResolvedValueOnce({
        rows: [{
          id: uuidv4(),
          token_hash: differentHash,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          user_id: testUser.id,
          email: testUser.email,
          role: testUser.role,
          is_active: true,
        }],
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('InvalidToken');
    });

    it('should return 400 when refreshToken is missing', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== LOGOUT ====================
  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const accessToken = generateTestAccessToken(testUser);
      const refreshToken = generateTestRefreshToken(testUser);
      const tokenHash = await bcrypt.hash(refreshToken, 10);

      // Query for refresh tokens to find and delete
      query.mockResolvedValueOnce({
        rows: [{ id: uuidv4(), token_hash: tokenHash }],
      });
      // Delete the matched token
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
    });

    it('should logout and delete all tokens when no refreshToken provided', async () => {
      const accessToken = generateTestAccessToken(testUser);

      query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 on database error during logout', async () => {
      const accessToken = generateTestAccessToken(testUser);
      const refreshToken = generateTestRefreshToken(testUser);

      query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== GET ME ====================
  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token (student)', async () => {
      const accessToken = generateTestAccessToken(testUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: testUser.id,
          email: testUser.email,
          role: testUser.role,
          is_active: true,
          created_at: testUser.created_at,
          updated_at: testUser.updated_at,
          first_name: 'John',
          last_name: 'Doe',
          phone: null,
          bio: null,
          location: null,
          github_url: null,
          linkedin_url: null,
          skills: ['JavaScript', 'Node.js'],
          cv_url: null,
          avatar_url: null,
        }],
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(testUser.id);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should return recruiter profile with valid token', async () => {
      const recruiterUser = { ...testUser, role: 'recruiter' };
      const accessToken = generateTestAccessToken(recruiterUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: recruiterUser.id,
          email: recruiterUser.email,
          role: 'recruiter',
          is_active: true,
          created_at: recruiterUser.created_at,
          updated_at: recruiterUser.updated_at,
          first_name: 'Jane',
          last_name: 'Smith',
          company_name: 'Tech Corp',
          company_website: 'https://techcorp.com',
          company_description: null,
          industry: 'Technology',
          position: 'HR Manager',
          phone: null,
          company_logo_url: null,
        }],
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('recruiter');
    });

    it('should return admin profile with valid token', async () => {
      const adminUser = { ...testUser, role: 'admin' };
      const accessToken = generateTestAccessToken(adminUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: adminUser.id,
          email: adminUser.email,
          role: 'admin',
          is_active: true,
          created_at: adminUser.created_at,
          updated_at: adminUser.updated_at,
        }],
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when user not found in DB', async () => {
      const accessToken = generateTestAccessToken(testUser);

      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NotFound');
    });

    it('should return 500 on database error', async () => {
      const accessToken = generateTestAccessToken(testUser);

      query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== CHANGE PASSWORD ====================
  describe('PUT /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      const accessToken = generateTestAccessToken(testUser);

      // Get user record
      query.mockResolvedValueOnce({
        rows: [{ id: testUser.id, password_hash: testUser.password_hash }],
      });
      // Update password
      query.mockResolvedValueOnce({ rows: [] });
      // Delete refresh tokens
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password changed successfully');
    });

    it('should return 401 for wrong current password', async () => {
      const accessToken = generateTestAccessToken(testUser);

      query.mockResolvedValueOnce({
        rows: [{ id: testUser.id, password_hash: testUser.password_hash }],
      });

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'NewPassword456',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('InvalidCredentials');
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .send({
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for weak new password', async () => {
      const accessToken = generateTestAccessToken(testUser);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123',
          newPassword: 'weakpass',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 when currentPassword is missing', async () => {
      const accessToken = generateTestAccessToken(testUser);

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'NewPassword456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 when user not found', async () => {
      const accessToken = generateTestAccessToken(testUser);

      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NotFound');
    });

    it('should return 500 on database error', async () => {
      const accessToken = generateTestAccessToken(testUser);

      query.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123',
          newPassword: 'NewPassword456',
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== HEALTH CHECK ====================
  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('auth-service');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  // ==================== 404 HANDLER ====================
  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown-route');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('NotFound');
    });
  });
});
