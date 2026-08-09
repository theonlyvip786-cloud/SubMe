const request = require('supertest');
const express = require('express');

// ── Mock auth ────────────────────────────────────────────────────────────────
jest.mock('../src/middleware/auth', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'test-user-id', email: 'user@example.com' };
    req.isAdmin = false;
    next();
  },
  adminMiddleware: (_req, res) => res.status(403).json({ error: 'Admin only' }),
}));

// ── Mock rate limiter (pass-through) ─────────────────────────────────────────
jest.mock('../src/middleware/rateLimit', () => ({
  apiLimiter: (_req, _res, next) => next(),
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────
jest.mock('../src/lib/supabase', () => ({
  from: jest.fn(),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

const supabase = require('../src/lib/supabase');
const tasksRouter = require('../src/routes/tasks');

const app = express();
app.use(express.json());
app.use('/api/tasks', tasksRouter);

// Error handler to format thrown errors as JSON
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

// ── Helper: build a chain of chainable Supabase query mocks ──────────────────
function makeChain(resolvedValue) {
  const chain = {};
  const methods = ['select', 'eq', 'not', 'in', 'order', 'gte', 'lt', 'limit', 'single', 'maybeSingle', 'upsert', 'update', 'insert', 'delete'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.then = (resolve) => resolve(resolvedValue || { data: null, error: null });
  // Terminal call returns the resolved value
  chain.single.mockResolvedValue(resolvedValue);
  chain.maybeSingle.mockResolvedValue(resolvedValue);
  chain.mockResolvedValue = (val) => { chain.single.mockResolvedValue(val); chain.maybeSingle.mockResolvedValue(val); return chain; };
  return chain;
}

// ── Active task fixture ───────────────────────────────────────────────────────
const ACTIVE_TASK = {
  id: 'task-123',
  title: 'Watch My Video',
  is_active: true,
  created_at: new Date().toISOString(), // fresh — not expired
  required_watch_time: 5,              // 5 seconds (short for tests)
  mcq_question: 'What color was the shirt?',
  mcq_answer: 'Blue',
  reward_points: 10,
  platform: 'youtube',
};

describe('Task Routes Unit Tests (/api/tasks)', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── GET / ──────────────────────────────────────────────────────────────────
  describe('GET /api/tasks', () => {
    it('returns active tasks the user has not submitted', async () => {
      const submissionsChain = makeChain({ data: [], error: null });
      submissionsChain.eq.mockReturnValue(submissionsChain); // handle .eq('user_id',...).eq('status','approved')
      const tasksChain = makeChain({ data: [ACTIVE_TASK], error: null });
      tasksChain.order.mockResolvedValue({ data: [ACTIVE_TASK], error: null });

      supabase.from.mockImplementation((table) => {
        if (table === 'submissions') return submissionsChain;
        if (table === 'tasks') return tasksChain;
        return makeChain({ data: null, error: null });
      });

      const res = await request(app).get('/api/tasks').set('Authorization', 'Bearer user_token');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── POST /:id/start ────────────────────────────────────────────────────────
  describe('POST /api/tasks/:id/start', () => {
    it('creates a new session and returns 200', async () => {
      const session = { id: 'sess-1', user_id: 'test-user-id', task_id: 'task-123', status: 'active', started_at: new Date().toISOString() };

      supabase.from.mockImplementation((table) => {
        const chain = makeChain(null);
        if (table === 'tasks') {
          chain.single.mockResolvedValue({ data: ACTIVE_TASK, error: null });
        } else if (table === 'users') {
          chain.upsert.mockResolvedValue({ error: null });
        } else if (table === 'task_sessions') {
          // update (expire stale) → no-op
          chain.update.mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ lt: jest.fn().mockResolvedValue({ error: null }) }) }) });
          // delete (old abandoned) → no-op
          chain.delete.mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ error: null }) }) }) });
          // upsert + select + single/maybeSingle → new session
          chain.single.mockResolvedValue({ data: session, error: null });
          chain.maybeSingle.mockResolvedValue({ data: session, error: null });
        } else if (table === 'logs') {
          chain.insert.mockResolvedValue({ error: null });
        }
        return chain;
      });

      const res = await request(app)
        .post('/api/tasks/task-123/start')
        .set('Authorization', 'Bearer user_token');

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/Task session/i);
    });

    it('returns 500 for an expired task', async () => {
      const expiredTask = {
        ...ACTIVE_TASK,
        // created 25 hours ago — past the 24h cutoff
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      };

      supabase.from.mockImplementation((table) => {
        const chain = makeChain(null);
        if (table === 'tasks') chain.single.mockResolvedValue({ data: expiredTask, error: null });
        return chain;
      });

      const res = await request(app)
        .post('/api/tasks/task-123/start')
        .set('Authorization', 'Bearer user_token');

      expect(res.statusCode).toBe(500);
    });
  });

  // ── POST /:id/submit ───────────────────────────────────────────────────────
  describe('POST /api/tasks/:id/submit', () => {
    const VALID_BODY = {
      screenshot_url: 'https://supabase.co/storage/proof.jpg',
      image_hash: 'abc123def456',
      mcq_answer: 'Blue',
    };

    // Setup a session that started enough seconds ago to satisfy required_watch_time=5
    const SESSION_OLD_ENOUGH = {
      started_at: new Date(Date.now() - 10_000).toISOString(), // 10s ago > 5s required
    };

    function mockSubmitSupabase({ session = SESSION_OLD_ENOUGH, dupHash = null, submissionError = null } = {}) {
      supabase.from.mockImplementation((table) => {
        const chain = makeChain(null);
        if (table === 'tasks') chain.single.mockResolvedValue({ data: ACTIVE_TASK, error: null });
        if (table === 'users') chain.upsert.mockResolvedValue({ error: null });
        if (table === 'task_sessions') {
          chain.maybeSingle.mockResolvedValue({ data: session, error: null });
          // update (mark completed)
          chain.update.mockReturnValue({
            eq: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }),
          });
        }
        if (table === 'submissions') {
          // duplicate hash check
          chain.maybeSingle.mockResolvedValue({ data: dupHash, error: null });
          // insert (it just chains to .select().single())
          chain.single.mockResolvedValue({ data: { id: 'sub-1' }, error: submissionError });
        }
        if (table === 'logs') chain.insert.mockResolvedValue({ error: null });
        return chain;
      });
    }

    it('returns 400 if screenshot_url is missing', async () => {
      const res = await request(app)
        .post('/api/tasks/task-123/submit')
        .set('Authorization', 'Bearer user_token')
        .send({ mcq_answer: 'Blue', image_hash: 'abc' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/screenshot/i);
    });

    it('returns 500 if no active session exists', async () => {
      supabase.from.mockImplementation((table) => {
        const chain = makeChain(null);
        if (table === 'tasks') chain.single.mockResolvedValue({ data: ACTIVE_TASK, error: null });
        if (table === 'task_sessions') chain.maybeSingle.mockResolvedValue({ data: null, error: null });
        return chain;
      });

      const res = await request(app)
        .post('/api/tasks/task-123/submit')
        .set('Authorization', 'Bearer user_token')
        .send(VALID_BODY);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/No active session/i);
    });

    it('returns 500 if watch time not met', async () => {
      const tooRecentSession = {
        started_at: new Date(Date.now() - 1_000).toISOString(), // 1s ago < 5s required
      };

      supabase.from.mockImplementation((table) => {
        const chain = makeChain(null);
        if (table === 'tasks') chain.single.mockResolvedValue({ data: ACTIVE_TASK, error: null });
        if (table === 'task_sessions') chain.maybeSingle.mockResolvedValue({ data: tooRecentSession, error: null });
        return chain;
      });

      const res = await request(app)
        .post('/api/tasks/task-123/submit')
        .set('Authorization', 'Bearer user_token')
        .send(VALID_BODY);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/Watch time not met/i);
    });

    it('returns 500 for an incorrect MCQ answer', async () => {
      supabase.from.mockImplementation((table) => {
        const chain = makeChain(null);
        if (table === 'tasks') chain.single.mockResolvedValue({ data: ACTIVE_TASK, error: null });
        if (table === 'task_sessions') chain.maybeSingle.mockResolvedValue({ data: SESSION_OLD_ENOUGH, error: null });
        return chain;
      });

      const res = await request(app)
        .post('/api/tasks/task-123/submit')
        .set('Authorization', 'Bearer user_token')
        .send({ ...VALID_BODY, mcq_answer: 'Red' }); // wrong answer

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/Incorrect answer/i);
    });

    it('returns 500 when duplicate image hash detected', async () => {
      mockSubmitSupabase({ dupHash: { id: 'sub-existing', user_id: 'other-user' } });

      const res = await request(app)
        .post('/api/tasks/task-123/submit')
        .set('Authorization', 'Bearer user_token')
        .send(VALID_BODY);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toMatch(/already been submitted by another account/i);
    });

    it('returns 200 for a valid submission', async () => {
      mockSubmitSupabase();

      const res = await request(app)
        .post('/api/tasks/task-123/submit')
        .set('Authorization', 'Bearer user_token')
        .send(VALID_BODY);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/credited|completed|submitted/i);
    });
  });
});
