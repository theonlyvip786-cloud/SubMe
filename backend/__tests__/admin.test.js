const request = require('supertest');
const express = require('express');

// Mock Auth Middlewares
jest.mock('../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || authHeader === 'Bearer invalid') {
      return res.status(401).json({ error: 'Access Denied' });
    }
    req.user = { id: 'admin-user-id', email: 'admin@subme.app' };
    req.isAdmin = authHeader === 'Bearer admin_token';
    next();
  },
  adminMiddleware: (req, res, next) => {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  },
}));

// Mock Supabase Singleton
jest.mock('../src/lib/supabase', () => ({
  rpc: jest.fn(),
  from: jest.fn(),
}));

const supabase = require('../src/lib/supabase');
const adminRouter = require('../src/routes/admin');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

describe('Admin Routes Unit Tests (/api/admin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization Guard', () => {
    it('should return 403 when non-admin user requests admin endpoints', async () => {
      const res = await request(app)
        .get('/api/admin/submissions/pending')
        .set('Authorization', 'Bearer user_token');

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: 'Admin only' });
    });
  });

  describe('POST /api/admin/submissions/:id/approve', () => {
    it('should approve submission via atomic RPC and return result', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: { approved: true, reward: 10, referrer_bonus: 5 },
        error: null,
      });

      const res = await request(app)
        .post('/api/admin/submissions/sub-123/approve')
        .set('Authorization', 'Bearer admin_token');

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Approved and points credited');
      expect(supabase.rpc).toHaveBeenCalledWith('approve_submission', { sub_id: 'sub-123' });
    });

    it('should return 409 if submission is already approved', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Submission already approved' },
      });

      const res = await request(app)
        .post('/api/admin/submissions/sub-123/approve')
        .set('Authorization', 'Bearer admin_token');

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toMatch(/Already approved/i);
    });
  });

  describe('POST /api/admin/submissions/:id/reject', () => {
    it('should reject pending submission', async () => {
      const mockSingle = jest.fn().mockResolvedValueOnce({ data: { status: 'pending' }, error: null });
      const mockSelect = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockSingle }) });
      const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValueOnce({ error: null }) });

      supabase.from.mockImplementation((table) => {
        if (table === 'submissions') {
          return { select: mockSelect, update: mockUpdate };
        }
        return {};
      });

      const res = await request(app)
        .post('/api/admin/submissions/sub-123/reject')
        .set('Authorization', 'Bearer admin_token');

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Submission rejected');
    });
  });

  describe('POST /api/admin/tasks', () => {
    it('should return 400 if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/admin/tasks')
        .set('Authorization', 'Bearer admin_token')
        .send({ title: 'Test Task' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/i);
    });

    it('should create new task when valid payload is provided', async () => {
      const mockInsert = jest.fn().mockResolvedValueOnce({ error: null });
      supabase.from.mockReturnValueOnce({ insert: mockInsert });

      const taskPayload = {
        title: 'New Video Task',
        video_url: 'https://youtube.com/watch?v=12345',
        reward_points: 10,
        required_watch_time: 180,
        mcq_question: 'What color was the car?',
        mcq_options: ['Red', 'Blue', 'Green', 'Yellow'],
        mcq_answer: 'Red',
      };

      const res = await request(app)
        .post('/api/admin/tasks')
        .set('Authorization', 'Bearer admin_token')
        .send(taskPayload);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Task created');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ title: 'New Video Task', reward_points: 10, is_active: true }),
      ]);
    });
  });
});
