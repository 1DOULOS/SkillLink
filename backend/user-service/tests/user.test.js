'use strict';

const request = require('supertest');
const app = require('../src/app');

// Mock the db module
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
}));

// Mock multer to avoid file system operations in tests
jest.mock('../src/config/upload', () => ({
  uploadCVMiddleware: (req, res, next) => {
    req.file = { filename: 'test-cv.pdf', path: '/uploads/test-cv.pdf' };
    next();
  },
  uploadAvatarMiddleware: (req, res, next) => {
    req.file = { filename: 'test-avatar.jpg', path: '/uploads/test-avatar.jpg' };
    next();
  },
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn((token, secret, callback) => {
    if (token === 'valid-student-token') {
      if (callback) callback(null, { id: 'student-uuid', email: 'student@test.com', role: 'student' });
      else return { id: 'student-uuid', email: 'student@test.com', role: 'student' };
    } else if (token === 'valid-recruiter-token') {
      if (callback) callback(null, { id: 'recruiter-uuid', email: 'recruiter@test.com', role: 'recruiter' });
      else return { id: 'recruiter-uuid', email: 'recruiter@test.com', role: 'recruiter' };
    } else if (token === 'valid-admin-token') {
      if (callback) callback(null, { id: 'admin-uuid', email: 'admin@test.com', role: 'admin' });
      else return { id: 'admin-uuid', email: 'admin@test.com', role: 'admin' };
    } else {
      if (callback) callback(new Error('Invalid token'));
      else throw new Error('Invalid token');
    }
  }),
  sign: jest.fn(() => 'mock-token'),
}));

const db = require('../src/config/db');

describe('User Service — Student Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/profile', () => {
    it('should return student profile for authenticated student', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'student-uuid',
          email: 'student@test.com',
          role: 'student',
          first_name: 'John',
          last_name: 'Doe',
          skills: ['JavaScript', 'React'],
          bio: 'Test bio',
          location: 'Yaoundé',
          cv_url: null,
          avatar_url: null,
          education: [],
          experience: [],
          github_url: null,
          linkedin_url: null,
          created_at: new Date(),
        }],
      });

      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-student-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 for recruiter accessing student profile endpoint', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer valid-recruiter-token');
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update student profile successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'student-uuid',
          first_name: 'Jane',
          last_name: 'Doe',
          bio: 'Updated bio',
          location: 'Douala',
          skills: ['React'],
          phone: '+237 6XX XXX XXX',
          updated_at: new Date(),
        }],
      });

      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer valid-student-token')
        .send({ first_name: 'Jane', last_name: 'Doe', bio: 'Updated bio', location: 'Douala' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid github URL', async () => {
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer valid-student-token')
        .send({ github_url: 'not-a-url' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/users/skills', () => {
    it('should update skills successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ user_id: 'student-uuid', skills: ['React', 'Node.js', 'Python'] }],
      });

      const res = await request(app)
        .put('/api/users/skills')
        .set('Authorization', 'Bearer valid-student-token')
        .send({ skills: ['React', 'Node.js', 'Python'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject non-array skills', async () => {
      const res = await request(app)
        .put('/api/users/skills')
        .set('Authorization', 'Bearer valid-student-token')
        .send({ skills: 'not-an-array' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/users/stats', () => {
    it('should return student stats', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '5', pending: '2', shortlisted: '1', accepted: '0', rejected: '2' }] })
        .mockResolvedValueOnce({ rows: [{ first_name: 'John', last_name: 'Doe', bio: 'bio', location: 'loc', skills: ['React'], cv_url: 'url', education: [], experience: [] }] });

      const res = await request(app)
        .get('/api/users/stats')
        .set('Authorization', 'Bearer valid-student-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalApplications');
    });
  });

  describe('GET /api/users/students', () => {
    it('should allow recruiter to list students', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total: '10' }],
      }).mockResolvedValueOnce({
        rows: [{
          id: 'student-uuid',
          email: 'student@test.com',
          first_name: 'John',
          last_name: 'Doe',
          skills: ['React'],
          location: 'Yaoundé',
        }],
      });

      const res = await request(app)
        .get('/api/users/students')
        .set('Authorization', 'Bearer valid-recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should not allow students to list other students', async () => {
      const res = await request(app)
        .get('/api/users/students')
        .set('Authorization', 'Bearer valid-student-token');

      expect(res.status).toBe(403);
    });
  });
});

describe('User Service — Admin Endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/admin/users', () => {
    it('should allow admin to get all users', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total: '50' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 'uuid', email: 'test@test.com', role: 'student', is_active: true, created_at: new Date() }],
        });

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should deny non-admin access', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer valid-student-token');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/admin/users/:id/status', () => {
    it('should update user status', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'user-uuid', is_active: false, email: 'test@test.com' }],
      });

      const res = await request(app)
        .put('/api/admin/users/user-uuid/status')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('should return platform stats', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // students
        .mockResolvedValueOnce({ rows: [{ count: '20' }] })  // recruiters
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })  // jobs
        .mockResolvedValueOnce({ rows: [{ count: '200' }] }) // applications
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // recent
        .mockResolvedValueOnce({ rows: [] });                 // by day

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalStudents');
    });
  });
});

describe('Health Check', () => {
  it('should return 200 from /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('user-service');
  });
});
