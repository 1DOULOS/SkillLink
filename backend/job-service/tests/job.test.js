'use strict';

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database module BEFORE requiring the app
jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
}));

// Mock prom-client to avoid duplicate metric registration errors across test runs
jest.mock('prom-client', () => {
  const original = jest.requireActual('prom-client');
  const registry = new original.Registry();
  return {
    ...original,
    register: registry,
    collectDefaultMetrics: jest.fn(),
    Counter: class MockCounter {
      constructor() {}
      inc() {}
    },
  };
});

const app = require('../src/app');
const db = require('../src/config/db');

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
const makeToken = (payload) =>
  jwt.sign(payload, 'test-secret', { expiresIn: '1h' });

const recruiterToken = makeToken({ id: 'recruiter-1', role: 'recruiter', email: 'r@test.com' });
const studentToken = makeToken({ id: 'student-1', role: 'student', email: 's@test.com' });
const adminToken = makeToken({ id: 'admin-1', role: 'admin', email: 'a@test.com' });
const otherRecruiterToken = makeToken({ id: 'recruiter-2', role: 'recruiter', email: 'r2@test.com' });

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const sampleJob = {
  id: 'job-uuid-1',
  recruiter_id: 'recruiter-1',
  title: 'Software Engineer Intern',
  description: 'Build great things.',
  requirements: 'Node.js experience',
  skills_required: ['JavaScript', 'Node.js'],
  location: 'Remote',
  job_type: 'internship',
  salary_min: 30000,
  salary_max: 50000,
  deadline: '2026-12-31',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const sampleApplication = {
  id: 'app-uuid-1',
  student_id: 'student-1',
  job_id: 'job-uuid-1',
  cover_letter: 'I am very interested.',
  status: 'pending',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Helper to reset mocks
beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// Health check
// ===========================================================================
describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('job-service');
  });
});

// ===========================================================================
// GET /api/jobs
// ===========================================================================
describe('GET /api/jobs', () => {
  it('returns paginated list of active jobs', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
      .mockResolvedValueOnce({
        rows: [
          {
            ...sampleJob,
            company_name: 'Acme Corp',
            industry: 'Tech',
            recruiter_first_name: 'Alice',
            recruiter_last_name: 'Smith',
          },
          {
            ...sampleJob,
            id: 'job-uuid-2',
            title: 'Frontend Dev',
            company_name: 'Acme Corp',
            industry: 'Tech',
            recruiter_first_name: 'Alice',
            recruiter_last_name: 'Smith',
          },
        ],
      });

    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobs).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pages).toBe(1);
  });

  it('applies job_type filter', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...sampleJob,
            company_name: 'Acme',
            industry: 'Tech',
            recruiter_first_name: 'Bob',
            recruiter_last_name: 'Jones',
          },
        ],
      });

    const res = await request(app).get('/api/jobs?job_type=internship');
    expect(res.status).toBe(200);
    expect(res.body.data.jobs[0].job_type).toBe('internship');
    // Confirm the second call includes the job_type param
    const secondCallArgs = db.query.mock.calls[1];
    expect(secondCallArgs[1]).toContain('internship');
  });

  it('applies search filter', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            ...sampleJob,
            company_name: 'Acme',
            industry: 'Tech',
            recruiter_first_name: 'Bob',
            recruiter_last_name: 'Jones',
          },
        ],
      });

    const res = await request(app).get('/api/jobs?search=Engineer');
    expect(res.status).toBe(200);
    expect(res.body.data.jobs).toHaveLength(1);
  });

  it('handles location filter', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/jobs?location=London');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection failed'));
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('InternalServerError');
  });
});

// ===========================================================================
// POST /api/jobs
// ===========================================================================
describe('POST /api/jobs', () => {
  const newJob = {
    title: 'Backend Engineer',
    description: 'Build APIs',
    job_type: 'full-time',
    location: 'New York',
    skills_required: ['Node.js', 'PostgreSQL'],
    salary_min: 60000,
    salary_max: 90000,
    status: 'active',
  };

  it('creates a job as recruiter', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...sampleJob, ...newJob, id: 'new-job-id' }] });

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send(newJob);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.job).toBeDefined();
    expect(res.body.message).toBe('Job created successfully');
  });

  it('returns 403 when student tries to create a job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(newJob);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when no token provided', async () => {
    const res = await request(app).post('/api/jobs').send(newJob);
    expect(res.status).toBe(401);
  });

  it('returns 422 when title is missing', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ description: 'Some job', job_type: 'full-time' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ValidationError');
    expect(res.body.details.some((d) => d.field === 'title')).toBe(true);
  });

  it('returns 422 when job_type is invalid', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ title: 'Dev', description: 'desc', job_type: 'invalid-type' });

    expect(res.status).toBe(422);
    expect(res.body.details.some((d) => d.field === 'job_type')).toBe(true);
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send(newJob);

    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// GET /api/jobs/my
// ===========================================================================
describe('GET /api/jobs/my', () => {
  it('returns recruiter own jobs with application counts', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [{ ...sampleJob, application_count: '3' }],
      });

    const res = await request(app)
      .get('/api/jobs/my')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobs[0].application_count).toBe(3);
  });

  it('returns 403 for student', async () => {
    const res = await request(app)
      .get('/api/jobs/my')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('filters by status', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ ...sampleJob, status: 'draft', application_count: '0' }] });

    const res = await request(app)
      .get('/api/jobs/my?status=draft')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][1]).toContain('draft');
  });
});

// ===========================================================================
// GET /api/jobs/stats
// ===========================================================================
describe('GET /api/jobs/stats', () => {
  it('returns stats for recruiter', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ total_jobs: '5', active_jobs: '3', draft_jobs: '1', closed_jobs: '1' }],
      })
      .mockResolvedValueOnce({ rows: [{ total_applications: '12' }] });

    const res = await request(app)
      .get('/api/jobs/stats')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stats.totalJobs).toBe(5);
    expect(res.body.data.stats.activeJobs).toBe(3);
    expect(res.body.data.stats.totalApplicationsReceived).toBe(12);
  });

  it('returns 403 for student', async () => {
    const res = await request(app)
      .get('/api/jobs/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// GET /api/jobs/:id
// ===========================================================================
describe('GET /api/jobs/:id', () => {
  it('returns a job by id (public)', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          ...sampleJob,
          updated_at: new Date().toISOString(),
          application_count: '5',
          company_name: 'Acme',
          industry: 'Tech',
          recruiter_first_name: 'Alice',
          recruiter_last_name: 'Smith',
        },
      ],
    });

    const res = await request(app).get('/api/jobs/job-uuid-1');
    expect(res.status).toBe(200);
    expect(res.body.data.job.id).toBe('job-uuid-1');
    expect(res.body.data.job.application_count).toBe(5);
  });

  it('includes has_applied flag for authenticated student', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          {
            ...sampleJob,
            updated_at: new Date().toISOString(),
            application_count: '2',
            company_name: 'Acme',
            industry: 'Tech',
            recruiter_first_name: 'Alice',
            recruiter_last_name: 'Smith',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'app-uuid-1' }] }); // student has applied

    const res = await request(app)
      .get('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.job.has_applied).toBe(true);
  });

  it('returns 404 when job not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/jobs/non-existent-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });

  it('returns 500 on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/jobs/job-uuid-1');
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// PUT /api/jobs/:id
// ===========================================================================
describe('PUT /api/jobs/:id', () => {
  it('updates a job when recruiter owns it', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sampleJob] }) // existing job
      .mockResolvedValueOnce({ rows: [{ ...sampleJob, title: 'Updated Title' }] }); // updated

    const res = await request(app)
      .put('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.job.title).toBe('Updated Title');
  });

  it('returns 403 when another recruiter tries to update', async () => {
    db.query.mockResolvedValueOnce({ rows: [sampleJob] }); // existing job owned by recruiter-1

    const res = await request(app)
      .put('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${otherRecruiterToken}`)
      .send({ title: 'Malicious Update' });

    expect(res.status).toBe(403);
  });

  it('admin can update any job', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sampleJob] })
      .mockResolvedValueOnce({ rows: [{ ...sampleJob, status: 'closed' }] });

    const res = await request(app)
      .put('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(200);
  });

  it('returns 404 when job not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/jobs/non-existent')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid job_type', async () => {
    db.query.mockResolvedValueOnce({ rows: [sampleJob] });
    const res = await request(app)
      .put('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ job_type: 'invalid' });

    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// DELETE /api/jobs/:id
// ===========================================================================
describe('DELETE /api/jobs/:id', () => {
  it('deletes job when recruiter owns it', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sampleJob] })
      .mockResolvedValueOnce({ rows: [] }); // delete

    const res = await request(app)
      .delete('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Job deleted successfully');
  });

  it('returns 403 when another recruiter tries to delete', async () => {
    db.query.mockResolvedValueOnce({ rows: [sampleJob] });
    const res = await request(app)
      .delete('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${otherRecruiterToken}`);
    expect(res.status).toBe(403);
  });

  it('admin can delete any job', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sampleJob] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 when job not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete('/api/jobs/non-existent')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// GET /api/jobs/:id/applications
// ===========================================================================
describe('GET /api/jobs/:id/applications', () => {
  it('returns applications for recruiter who owns the job', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'job-uuid-1' }] }) // ownership check
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'app-uuid-1',
            status: 'pending',
            cover_letter: 'I am interested',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            student_email: 'student@test.com',
            first_name: 'John',
            last_name: 'Doe',
            skills: ['JavaScript'],
            cv_url: 'https://example.com/cv',
            bio: 'Great student',
            location: 'Remote',
          },
        ],
      });

    const res = await request(app)
      .get('/api/jobs/job-uuid-1/applications')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(1);
    expect(res.body.data.applications[0].student.name).toBe('John Doe');
    expect(res.body.data.total).toBe(1);
  });

  it('returns 404 when recruiter does not own job', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // ownership check fails

    const res = await request(app)
      .get('/api/jobs/job-uuid-1/applications')
      .set('Authorization', `Bearer ${otherRecruiterToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for students', async () => {
    const res = await request(app)
      .get('/api/jobs/job-uuid-1/applications')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// POST /api/applications/jobs/:jobId
// ===========================================================================
describe('POST /api/applications/jobs/:jobId', () => {
  it('student can apply to an active job', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'job-uuid-1', status: 'active', deadline: null }] }) // job check
      .mockResolvedValueOnce({ rows: [] }) // no duplicate
      .mockResolvedValueOnce({ rows: [sampleApplication] }); // insert

    const res = await request(app)
      .post('/api/applications/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ cover_letter: 'I am very interested.' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.application.id).toBe('app-uuid-1');
  });

  it('returns 409 on duplicate application', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'job-uuid-1', status: 'active', deadline: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 'app-uuid-1' }] }); // duplicate found

    const res = await request(app)
      .post('/api/applications/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ cover_letter: 'Applying again' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('returns 404 when job not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // no job

    const res = await request(app)
      .post('/api/applications/jobs/non-existent-job')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns 400 when job is not active', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'job-uuid-1', status: 'closed', deadline: null }],
    });

    const res = await request(app)
      .post('/api/applications/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not currently accepting/);
  });

  it('returns 400 when deadline has passed', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'job-uuid-1', status: 'active', deadline: '2020-01-01' }],
    });

    const res = await request(app)
      .post('/api/applications/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/deadline/);
  });

  it('returns 403 when recruiter tries to apply', async () => {
    const res = await request(app)
      .post('/api/applications/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('handles DB unique constraint error gracefully', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'job-uuid-1', status: 'active', deadline: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(Object.assign(new Error('unique violation'), { code: '23505' }));

    const res = await request(app)
      .post('/api/applications/jobs/job-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(409);
  });
});

// ===========================================================================
// GET /api/applications/my
// ===========================================================================
describe('GET /api/applications/my', () => {
  it('returns student applications with job details', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'app-uuid-1',
            status: 'pending',
            cover_letter: 'I am interested',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            job_id: 'job-uuid-1',
            title: 'Software Engineer Intern',
            location: 'Remote',
            job_type: 'internship',
            salary_min: 30000,
            salary_max: 50000,
            company_name: 'Acme Corp',
          },
        ],
      });

    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(1);
    expect(res.body.data.applications[0].job.title).toBe('Software Engineer Intern');
    expect(res.body.data.total).toBe(1);
  });

  it('returns 403 for recruiter', async () => {
    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(403);
  });

  it('filters by status', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'app-uuid-2',
            status: 'shortlisted',
            cover_letter: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            job_id: 'job-uuid-1',
            title: 'Dev Role',
            location: 'London',
            job_type: 'full-time',
            salary_min: null,
            salary_max: null,
            company_name: 'StartupX',
          },
        ],
      });

    const res = await request(app)
      .get('/api/applications/my?status=shortlisted')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][1]).toContain('shortlisted');
  });
});

// ===========================================================================
// PUT /api/jobs/:jobId/applications/:appId (update status)
// ===========================================================================
describe('PUT /api/jobs/:jobId/applications/:appId', () => {
  it('recruiter updates application status', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'job-uuid-1' }] }) // job ownership check
      .mockResolvedValueOnce({ rows: [{ id: 'app-uuid-1', job_id: 'job-uuid-1' }] }) // app belongs to job
      .mockResolvedValueOnce({
        rows: [{ ...sampleApplication, status: 'shortlisted' }],
      }); // updated

    const res = await request(app)
      .put('/api/jobs/job-uuid-1/applications/app-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('shortlisted');
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .put('/api/jobs/job-uuid-1/applications/app-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ status: 'invalid-status' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('returns 404 when recruiter does not own the job', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // job not found for this recruiter

    const res = await request(app)
      .put('/api/jobs/job-uuid-1/applications/app-uuid-1')
      .set('Authorization', `Bearer ${otherRecruiterToken}`)
      .send({ status: 'accepted' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when status is missing', async () => {
    const res = await request(app)
      .put('/api/jobs/job-uuid-1/applications/app-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ===========================================================================
// DELETE /api/applications/:id (withdraw)
// ===========================================================================
describe('DELETE /api/applications/:id', () => {
  it('student can withdraw a pending application', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [sampleApplication] }) // fetch application
      .mockResolvedValueOnce({ rows: [] }); // delete

    const res = await request(app)
      .delete('/api/applications/app-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Application withdrawn successfully');
  });

  it('returns 404 when application not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/applications/non-existent')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when student tries to withdraw someone else application', async () => {
    const otherStudentApp = { ...sampleApplication, student_id: 'student-other' };
    db.query.mockResolvedValueOnce({ rows: [otherStudentApp] });

    const res = await request(app)
      .delete('/api/applications/app-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 400 when application is not pending', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...sampleApplication, status: 'accepted' }],
    });

    const res = await request(app)
      .delete('/api/applications/app-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/pending/);
  });

  it('returns 403 for recruiter', async () => {
    const res = await request(app)
      .delete('/api/applications/app-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// GET /api/applications/:id
// ===========================================================================
describe('GET /api/applications/:id', () => {
  const fullAppRow = {
    id: 'app-uuid-1',
    student_id: 'student-1',
    job_id: 'job-uuid-1',
    recruiter_id: 'recruiter-1',
    status: 'pending',
    cover_letter: 'Hello',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    job_title: 'Software Engineer Intern',
    company_name: 'Acme Corp',
    student_email: 'student@test.com',
    first_name: 'John',
    last_name: 'Doe',
    skills: ['JavaScript'],
    cv_url: 'https://example.com/cv',
    bio: 'Cool student',
    location: 'Remote',
  };

  it('student can get their own application', async () => {
    db.query.mockResolvedValueOnce({ rows: [fullAppRow] });

    const res = await request(app)
      .get('/api/applications/app-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.id).toBe('app-uuid-1');
    expect(res.body.data.application.student.name).toBe('John Doe');
  });

  it('recruiter can get application for their job', async () => {
    db.query.mockResolvedValueOnce({ rows: [fullAppRow] });

    const res = await request(app)
      .get('/api/applications/app-uuid-1')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 403 when student accesses another student application', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...fullAppRow, student_id: 'student-other' }],
    });

    const res = await request(app)
      .get('/api/applications/app-uuid-1')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when application not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/applications/non-existent')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// Auth middleware edge cases
// ===========================================================================
describe('Auth middleware', () => {
  it('returns 401 with expired token', async () => {
    const expiredToken = jwt.sign(
      { id: 'student-1', role: 'student' },
      'test-secret',
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/applications/my')
      .set('Authorization', 'Bearer not.a.valid.token');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('returns 401 with missing Authorization header', async () => {
    const res = await request(app).get('/api/applications/my');
    expect(res.status).toBe(401);
  });
});

// ===========================================================================
// 404 handler
// ===========================================================================
describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFound');
  });
});
