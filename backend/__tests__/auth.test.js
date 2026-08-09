/**
 * auth.test.js
 *
 * Tests the auth middleware logic directly (not via HTTP):
 *   - isAdminEmail()   — env-driven admin resolution
 *   - authMiddleware() — token verification, banned-user 403
 *   - adminMiddleware() — req.isAdmin guard
 */

// ── Isolate env before requiring anything ────────────────────────────────────
const ORIGINAL_ENV = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ── isAdminEmail ─────────────────────────────────────────────────────────────
describe('isAdminEmail()', () => {
  function getIsAdminEmail(envOverride = {}) {
    Object.assign(process.env, envOverride);
    // Mock supabase so the module loads without real credentials
    jest.mock('../src/lib/supabase', () => ({ auth: { getUser: jest.fn() }, from: jest.fn() }));
    return require('../src/middleware/auth').isAdminEmail;
  }

  it('returns true for the canonical admin@subme.app address', () => {
    const isAdminEmail = getIsAdminEmail();
    expect(isAdminEmail('admin@subme.app')).toBe(true);
    expect(isAdminEmail('ADMIN@SUBME.APP')).toBe(true); // case-insensitive
  });

  it('returns true for the canonical admin@subko.app address', () => {
    const isAdminEmail = getIsAdminEmail();
    expect(isAdminEmail('admin@subko.app')).toBe(true);
  });

  it('returns true for an address set in ADMIN_EMAIL env var', () => {
    const isAdminEmail = getIsAdminEmail({ ADMIN_EMAIL: 'boss@company.com' });
    expect(isAdminEmail('boss@company.com')).toBe(true);
  });

  it('returns true for addresses set in ADMIN_EMAILS (comma-separated)', () => {
    const isAdminEmail = getIsAdminEmail({ ADMIN_EMAILS: 'op1@company.com,op2@company.com' });
    expect(isAdminEmail('op1@company.com')).toBe(true);
    expect(isAdminEmail('op2@company.com')).toBe(true);
  });

  it('returns false for a regular user email', () => {
    const isAdminEmail = getIsAdminEmail();
    expect(isAdminEmail('user@example.com')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});

// ── authMiddleware via HTTP ───────────────────────────────────────────────────
describe('authMiddleware', () => {
  const request = require('supertest');
  const express = require('express');

  function buildApp() {
    jest.resetModules();
    // Provide a minimal JWT_SECRET so HS256 verification can run
    process.env.JWT_SECRET = 'test-secret';
    process.env.SUPABASE_JWT_SECRET = 'test-secret';

    jest.mock('../src/lib/supabase', () => ({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: new Error('invalid') }),
      },
      from: jest.fn(),
    }));

    const { authMiddleware } = require('../src/middleware/auth');
    const app = express();
    app.use(express.json());
    app.get('/test', authMiddleware, (req, res) => res.json({ userId: req.user.id }));
    return app;
  }

  it('returns 401 when Authorization header is missing', async () => {
    const app = buildApp();
    const res = await request(app).get('/test');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/Access Denied/i);
  });

  it('returns 401 for a malformed/invalid token', async () => {
    const app = buildApp();
    const res = await request(app).get('/test').set('Authorization', 'Bearer totally_invalid_token');
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 for a banned user with valid token', async () => {
    jest.resetModules();
    process.env.JWT_SECRET = 'test-secret';
    process.env.SUPABASE_JWT_SECRET = 'test-secret';

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'user-uuid', email: 'user@example.com' }, 'test-secret', { algorithm: 'HS256' });

    jest.mock('../src/lib/supabase', () => ({
      auth: { getUser: jest.fn() },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { status: 'banned' }, error: null }),
      }),
    }));

    const { authMiddleware } = require('../src/middleware/auth');
    const app = express();
    app.use(express.json());
    app.get('/test', authMiddleware, (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/banned/i);
  });
});

// ── adminMiddleware ───────────────────────────────────────────────────────────
describe('adminMiddleware', () => {
  const request = require('supertest');
  const express = require('express');

  function buildAdminApp(isAdmin) {
    jest.resetModules();
    jest.mock('../src/lib/supabase', () => ({ auth: { getUser: jest.fn() }, from: jest.fn() }));
    const { adminMiddleware } = require('../src/middleware/auth');
    const app = express();
    app.use(express.json());
    // Inject req.isAdmin manually (simulates what authMiddleware would set)
    app.use((req, _res, next) => { req.isAdmin = isAdmin; next(); });
    app.get('/admin-only', adminMiddleware, (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('returns 403 when req.isAdmin is false', async () => {
    const app = buildAdminApp(false);
    const res = await request(app).get('/admin-only');
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Admin only/i);
  });

  it('passes through when req.isAdmin is true', async () => {
    const app = buildAdminApp(true);
    const res = await request(app).get('/admin-only');
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
