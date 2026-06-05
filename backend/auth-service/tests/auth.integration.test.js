'use strict';

/**
 * Integration tests for the Auth Service HTTP layer.
 * These tests exercise the full Express stack — routing, validation middleware,
 * error handling — without hitting a real database.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret';
process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const request = require('supertest');
const jwt = require('jsonwebtoken');

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

// ─── helpers ───────────────────────────────────────────────────────────────
const validStudent = {
  email: 'integration@test.com',
  password: 'Password1',
  role: 'student',
  first_name: 'Integration',
  last_name: 'Test',
};

const validRecruiter = {
  email: 'recruiter@company.com',
  password: 'Password1',
  role: 'recruiter',
  first_name: 'Acme',
  last_name: 'Corp',
};

// ─── Health check ──────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toBe('auth-service');
    expect(res.body).toHaveProperty('uptime');
  });
});

// ─── 404 catch-all ─────────────────────────────────────────────────────────
describe('Unknown route', () => {
  it('returns 404 for unregistered path', async () => {
    const res = await request(app).get('/api/auth/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NotFound');
  });
});

// ─── Registration validation (middleware integration) ──────────────────────
describe('POST /api/auth/register — input validation', () => {
  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Password1', role: 'student', first_name: 'A', last_name: 'B' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validStudent, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validStudent, password: 'Ab1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validStudent, role: 'superadmin' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing first_name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validStudent, first_name: undefined });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Login validation (middleware integration) ─────────────────────────────
describe('POST /api/auth/login — input validation', () => {
  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'Password1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Protected routes — auth middleware integration ─────────────────────────
describe('Auth middleware integration', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for token signed with wrong secret', async () => {
    const badToken = jwt.sign({ id: '123', role: 'student' }, 'wrong-secret');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 for expired token', async () => {
    const expired = jwt.sign(
      { id: '123', role: 'student' },
      'integration-test-secret',
      { expiresIn: '0s' }
    );
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─── Change-password validation ────────────────────────────────────────────
describe('PUT /api/auth/change-password — validation', () => {
  const token = jwt.sign(
    { id: 'user-1', email: 'u@test.com', role: 'student' },
    'integration-test-secret',
    { expiresIn: '15m' }
  );

  it('rejects when currentPassword is missing', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'NewPass1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects when newPassword is too short', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'OldPass1', newPassword: 'ab' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Refresh token validation ──────────────────────────────────────────────
describe('POST /api/auth/refresh — validation', () => {
  it('rejects missing refreshToken field', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── Content-Type enforcement ──────────────────────────────────────────────
describe('Content-Type integration', () => {
  it('returns 400 for register with no body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send();
    expect(res.status).toBe(400);
  });
});
