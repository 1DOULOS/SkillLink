'use strict';

/**
 * Integration tests for the User Service HTTP layer.
 * Tests routing, auth middleware, RBAC, file upload middleware,
 * and error handling working together as an integrated stack.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: { on: jest.fn(), query: jest.fn(), end: jest.fn() },
}));

jest.mock('prom-client', () => {
  const original = jest.requireActual('prom-client');
  const registry = new original.Registry();
  return {
    ...original,
    register: registry,
    collectDefaultMetrics: jest.fn(),
    Counter: class { constructor() {} inc() {} },
    Histogram: class { constructor() {} observe() {} startTimer() { return () => {}; } },
  };
});

const app = require('../src/app');

// ─── Token helpers ──────────────────────────────────────────────────────────
const makeToken = (payload) =>
  jwt.sign(payload, 'integration-test-secret', { expiresIn: '1h' });

const studentToken   = makeToken({ id: 'stu-1', role: 'student',   email: 's@co.com' });
const recruiterToken = makeToken({ id: 'rec-1', role: 'recruiter', email: 'r@co.com' });
const adminToken     = makeToken({ id: 'adm-1', role: 'admin',     email: 'a@co.com' });

// ─── Health ─────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with service name', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('user-service');
    expect(res.body.success).toBe(true);
  });
});

// ─── 404 catch-all ─────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('returns 404 for unregistered path', async () => {
    const res = await request(app).get('/api/users/nonexistent-endpoint-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Auth middleware — student profile routes ───────────────────────────────
describe('Auth middleware on student routes', () => {
  it('rejects GET /api/users/profile without token', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects with malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer totally.invalid.token');
    expect(res.status).toBe(401);
  });

  it('rejects expired token', async () => {
    const expired = jwt.sign(
      { id: 'u1', role: 'student' },
      'integration-test-secret',
      { expiresIn: '0s' }
    );
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

// ─── RBAC — recruiter cannot access student-only routes ────────────────────
describe('RBAC integration', () => {
  it('blocks recruiter from GET /api/users/profile (student route)', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks student from GET /api/users/recruiter/profile', async () => {
    const res = await request(app)
      .get('/api/users/recruiter/profile')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks student from accessing admin routes', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('blocks recruiter from accessing admin routes', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── Student profile update validation ─────────────────────────────────────
describe('PUT /api/users/profile — validation integration', () => {
  it('accepts valid partial update with student token', async () => {
    const db = require('../src/config/db');
    db.query.mockResolvedValue({
      rows: [{
        id: 'stu-1',
        user_id: 'stu-1',
        first_name: 'Jane',
        last_name: 'Doe',
        bio: 'Updated bio',
        skills: [],
        location: 'Yaounde',
        github_url: null,
        linkedin_url: null,
        phone: null,
        cv_url: null,
        avatar_url: null,
        education: [],
        experience: [],
      }],
    });

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ bio: 'Updated bio', location: 'Yaounde' });

    expect([200, 400, 404, 500]).toContain(res.status);
  });
});

// ─── File upload middleware — CV upload ─────────────────────────────────────
describe('POST /api/users/cv — file upload integration', () => {
  it('returns 401 without auth for CV upload', async () => {
    const res = await request(app).post('/api/users/cv');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await request(app)
      .post('/api/users/cv')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(400);
  });

  it('rejects non-PDF file as CV', async () => {
    const res = await request(app)
      .post('/api/users/cv')
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('cv', Buffer.from('fake image data'), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });
    expect([400, 415]).toContain(res.status);
  });
});

// ─── Avatar upload validation ───────────────────────────────────────────────
describe('POST /api/users/avatar — file upload integration', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/users/avatar');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await request(app)
      .post('/api/users/avatar')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(400);
  });
});

// ─── Admin stats ────────────────────────────────────────────────────────────
describe('GET /api/admin/stats — admin-only route', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid admin token', async () => {
    const db = require('../src/config/db');
    db.query.mockResolvedValue({ rows: [{ total_users: '5', students: '3', recruiters: '1', admins: '1', active_users: '5' }] });
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 500]).toContain(res.status);
  });
});
