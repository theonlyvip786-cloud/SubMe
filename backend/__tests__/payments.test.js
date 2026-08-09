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

// ── Mock rate limiter ─────────────────────────────────────────────────────────
jest.mock('../src/middleware/rateLimit', () => ({
  apiLimiter: (_req, _res, next) => next(),
}));

// ── Mock Supabase ─────────────────────────────────────────────────────────────
jest.mock('../src/lib/supabase', () => ({
  from: jest.fn(),
}));

const supabase = require('../src/lib/supabase');
const paymentsRouter = require('../src/routes/payments');

const app = express();
app.use(express.json());
app.use('/api/payments', paymentsRouter);

// ── Helper: build a fully-chainable Supabase mock returning a final value ────
function buildChain(finalData = null, finalError = null) {
  const resolved = { data: finalData, error: finalError };
  const chain = {};
  ['select','eq','in','not','limit','order','single','maybeSingle','insert','update','upsert','delete'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.maybeSingle.mockResolvedValue(resolved);
  chain.single.mockResolvedValue(resolved);
  // Allow terminal awaiting of the chain itself (for insert, update)
  chain.then = jest.fn((resolve) => Promise.resolve(resolved).then(resolve));
  return chain;
}

describe('Payment Routes Unit Tests (/api/payments)', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── POST /manual ──────────────────────────────────────────────────────────
  describe('POST /api/payments/manual', () => {
    it('returns 400 if amount is below minimum (< 50)', async () => {
      const res = await request(app)
        .post('/api/payments/manual')
        .set('Authorization', 'Bearer user_token')
        .send({ utr_number: 'UTR123', screenshot: 'https://example.com/shot.jpg', amount: 10 });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Minimum payment/i);
    });

    it('returns 400 if utr_number is missing', async () => {
      const res = await request(app)
        .post('/api/payments/manual')
        .set('Authorization', 'Bearer user_token')
        .send({ amount: 100, screenshot: 'https://example.com/shot.jpg' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/UTR/i);
    });

    it('returns 400 if screenshot is missing', async () => {
      const res = await request(app)
        .post('/api/payments/manual')
        .set('Authorization', 'Bearer user_token')
        .send({ amount: 100, utr_number: 'UTR123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/screenshot/i);
    });

    it('returns 400 if UTR is already submitted (duplicate)', async () => {
      supabase.from.mockImplementation(() => {
        return buildChain({ id: 'existing-payment', status: 'pending' });
      });

      const res = await request(app)
        .post('/api/payments/manual')
        .set('Authorization', 'Bearer user_token')
        .send({ amount: 100, utr_number: 'UTR_DUPE', screenshot: 'https://example.com/shot.jpg' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/already been submitted/i);
    });

    it('accepts a valid payment and creates a pending request', async () => {
      // First call: duplicate check → null (no duplicate)
      // Second call: insert → success
      // Third call: logs insert → success
      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        const chain = buildChain(null);
        if (table === 'payment_requests') {
          callCount++;
          if (callCount === 1) {
            // duplicate check: no existing record
            chain.maybeSingle.mockResolvedValue({ data: null, error: null });
          } else {
            // insert: success
            chain.then = jest.fn((resolve) => Promise.resolve({ data: [{ id: 'new-pay' }], error: null }).then(resolve));
          }
        }
        if (table === 'logs') {
          chain.then = jest.fn((resolve) => Promise.resolve({ error: null }).then(resolve));
        }
        return chain;
      });

      const res = await request(app)
        .post('/api/payments/manual')
        .set('Authorization', 'Bearer user_token')
        .send({ amount: 100, utr_number: 'UTR_FRESH', screenshot: 'https://example.com/shot.jpg' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toMatch(/Admin will verify/i);
    });
  });

  // ── POST /auto-verify ─────────────────────────────────────────────────────
  describe('POST /api/payments/auto-verify', () => {
    it('always returns pending:true and auto_approved:false — no instant credit', async () => {
      // Simulate: no duplicate UTR
      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        const chain = buildChain(null);
        if (table === 'payment_requests') {
          callCount++;
          if (callCount === 1) {
            chain.maybeSingle.mockResolvedValue({ data: null, error: null }); // no duplicate
          } else {
            chain.then = jest.fn((resolve) => Promise.resolve({ error: null }).then(resolve));
          }
        }
        if (table === 'logs') {
          chain.then = jest.fn((resolve) => Promise.resolve({ error: null }).then(resolve));
        }
        return chain;
      });

      const res = await request(app)
        .post('/api/payments/auto-verify')
        .set('Authorization', 'Bearer user_token')
        .send({ utr_number: 'UTR_SMS', amount: 500 });

      expect(res.statusCode).toBe(202);
      expect(res.body.auto_approved).toBe(false);
      expect(res.body.pending).toBe(true);
      // Critically — credit_points must NOT have been called
      // (supabase.rpc is not defined in this mock, so if it were called it would throw)
    });

    it('returns 400 for a duplicate UTR via auto-verify', async () => {
      supabase.from.mockImplementation((table) => {
        const chain = buildChain(null);
        if (table === 'payment_requests') {
          chain.maybeSingle.mockResolvedValue({ data: { id: 'dup-pay', status: 'pending' }, error: null });
        }
        if (table === 'logs') {
          chain.then = jest.fn((resolve) => Promise.resolve({ error: null }).then(resolve));
        }
        return chain;
      });

      const res = await request(app)
        .post('/api/payments/auto-verify')
        .set('Authorization', 'Bearer user_token')
        .send({ utr_number: 'UTR_DUPE', amount: 200 });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/already been submitted/i);
    });

    it('returns 400 if amount is below minimum', async () => {
      const res = await request(app)
        .post('/api/payments/auto-verify')
        .set('Authorization', 'Bearer user_token')
        .send({ utr_number: 'UTR123', amount: 10 });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/Minimum/i);
    });
  });

  // ── POST /verify-utr ──────────────────────────────────────────────────────
  describe('POST /api/payments/verify-utr', () => {
    it('returns valid:true for a fresh UTR', async () => {
      supabase.from.mockImplementation(() => buildChain(null));

      const res = await request(app)
        .post('/api/payments/verify-utr')
        .set('Authorization', 'Bearer user_token')
        .send({ utr_number: 'FRESH_UTR_123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.duplicate).toBe(false);
    });

    it('returns duplicate:true for an existing UTR', async () => {
      supabase.from.mockImplementation(() =>
        buildChain({ id: 'existing-id', status: 'approved' })
      );

      const res = await request(app)
        .post('/api/payments/verify-utr')
        .set('Authorization', 'Bearer user_token')
        .send({ utr_number: 'EXISTING_UTR' });

      expect(res.statusCode).toBe(200);
      expect(res.body.duplicate).toBe(true);
      expect(res.body.valid).toBe(false);
      expect(res.body.status).toBe('approved');
    });

    it('returns 400 if utr_number is missing', async () => {
      const res = await request(app)
        .post('/api/payments/verify-utr')
        .set('Authorization', 'Bearer user_token')
        .send({});

      expect(res.statusCode).toBe(400);
    });
  });
});
