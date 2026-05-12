'use strict';

/**
 * Integration tests for the Job Service HTTP layer.
 * Tests routing, validation middleware, auth middleware, and error handlers
 * working together as an integrated stack.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
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

const recruiterToken = makeToken({ id: 'rec-1', role: 'recruiter', email: 'r@co.com' });
const studentToken  = makeToken({ id: 'stu-1', role: 'student',   email: 's@co.com' });
const adminToken    = makeToken({ id: 'adm-1', role: 'admin',     email: 'a@co.com' });

// ─── Health ─────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('job-service');
    expect(res.body.status).toBe('ok');
  });
});

// ─── 404 handler ───────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('returns 404 for unregistered path', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Auth middleware — jobs requiring authentication ────────────────────────
describe('Auth middleware on job routes', () => {
  it('rejects POST /api/jobs without a token', async () => {
    const res = await request(app).post('/api/jobs').send({ title: 'Dev' });
    expect(res.status).toBe(401);
  });

  it('rejects POST /api/jobs with malformed Bearer token', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer bad.token.here')
      .send({ title: 'Dev' });
    expect(res.status).toBe(401);
  });

  it('rejects student trying to create a job (RBAC)', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Frontend Intern',
        description: 'React work',
        requirements: 'React skills needed',
        location: 'Remote',
        job_type: 'internship',
        skills_required: ['React'],
      });
    expect(res.status).toBe(403);
  });
});

// ─── Job creation validation ────────────────────────────────────────────────
describe('POST /api/jobs — field validation (recruiter token)', () => {
  it('rejects missing title', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ description: 'Desc', location: 'Yaounde', job_type: 'internship' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid job_type', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        title: 'Job',
        description: 'Desc',
        requirements: 'Skills',
        location: 'Remote',
        job_type: 'freelance',
        skills_required: ['JS'],
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects salary_min greater than salary_max', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        title: 'Job',
        description: 'Desc',
        requirements: 'Skills',
        location: 'Remote',
        job_type: 'full-time',
        skills_required: ['JS'],
        salary_min: 5000,
        salary_max: 1000,
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Public job listing — no auth required ──────────────────────────────────
describe('GET /api/jobs — public listing', () => {
  beforeEach(() => {
    const db = require('../src/config/db');
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('returns 200 without authentication', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
  });

  it('accepts valid filter query params', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .query({ job_type: 'internship', page: 1, limit: 10 });
    expect(res.status).toBe(200);
  });
});

// ─── Application routes — student only ─────────────────────────────────────
describe('POST /api/applications/jobs/:jobId — role enforcement', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/applications/jobs/some-job-id')
      .send({ cover_letter: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when recruiter tries to apply', async () => {
    const res = await request(app)
      .post('/api/applications/jobs/some-job-id')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ cover_letter: 'Hello' });
    expect(res.status).toBe(403);
  });
});

// ─── Admin stats route ──────────────────────────────────────────────────────
describe('GET /api/jobs/stats — recruiter only', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/jobs/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student', async () => {
    const res = await request(app)
      .get('/api/jobs/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});
