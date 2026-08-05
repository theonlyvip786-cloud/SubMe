require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const morgan = require('morgan');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// Behind a proxy (Render/Railway/Nginx)? Trust it so req.ip / rate-limit
// keys are correct. Set TRUST_PROXY=0 to disable in dev.
app.set('trust proxy', process.env.TRUST_PROXY === '0' ? false : 1);

// Logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CORS — restrict origin in production via CORS_ORIGIN
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: corsOrigin !== '*',
    optionsSuccessStatus: 204,
}));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
}));

// Global rate limiter applied to every API route. Per-route limiters
// (authLimiter on auth, apiLimiter on write paths) stack on top.
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/referrals', require('./routes/referrals'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/proofs', require('./routes/proofs'));
app.use('/api/admin', require('./routes/admin'));

// Centralized API error handler.
// Routes throw (via asyncHandler) → land here. We translate known DB /
// constraint errors into clean 4xx responses and never leak stack traces.
app.use('/api', (err, req, res, next) => {
    if (res.headersSent) return next(err);

    const code = err && err.code;
    const pgMessage = err && err.pgError && err.pgError.message;
    const message = err && err.message ? err.message : 'Internal server error';

    // Postgres unique-violation / Supabase duplicate
    if (code === '23505') {
        return res.status(409).json({ error: 'Duplicate entry — that record already exists.' });
    }
    // Postgres check-constraint violation (e.g. users_points_nonnegative,
    // payment_requests_amount_range)
    if (code === '23514') {
        return res.status(400).json({ error: 'Operation violates a data constraint.' });
    }
    // Postgres foreign-key violation
    if (code === '23503') {
        return res.status(400).json({ error: 'Referenced record not found.' });
    }
    // RAISE EXCEPTION from an RPC carries a human message — surface it.
    if (pgMessage || (err && err.pgError)) {
        return res.status(400).json({ error: pgMessage || message });
    }

    // Network errors reaching the DB (Supabase unreachable) — never leak
    // the raw fetch error; report a clean service-unavailable.
    if (message && (message.includes('fetch failed') ||
                    message.includes('ECONNREFUSED') ||
                    message.includes('ETIMEDOUT') ||
                    message.includes('ENOTFOUND'))) {
        return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
    }

    console.error('Unhandled API Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Serve static frontend build (must come AFTER /api routes).
app.use(express.static(path.join(__dirname, '../../mobile-app/dist')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../mobile-app/dist/index.html'));
});

// SPA fallback — never serve HTML for unknown API routes.
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' });
    }
    const indexPath = path.join(__dirname, '../../mobile-app/dist/index.html');
    res.sendFile(indexPath, (err) => {
        if (err) res.status(404).json({
            error: 'Frontend build not found. Run: cd mobile-app && npm run web',
        });
    });
});

const PORT = Number(process.env.PORT) || 5000;
const supabase = require('./lib/supabase');

// ─── 24-Hour Task Auto-Cleanup ────────────────────────────────────────────────
// Runs every 10 minutes. Deletes tasks older than 24 hours (including
// all tasks created by user promotions, whether YouTube or Instagram, Premium or Standard).
async function cleanupExpiredTasks() {
    try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: expiredTasks, error: fetchErr } = await supabase
            .from('tasks')
            .select('id')
            .lt('created_at', cutoff);

        if (fetchErr) { console.error('[Cleanup] Fetch expired tasks error:', fetchErr.message); return; }
        if (!expiredTasks || expiredTasks.length === 0) { return; }

        const ids = expiredTasks.map(t => t.id);

        // Delete submissions first (foreign key → tasks)
        await supabase.from('submissions').delete().in('task_id', ids);

        // Delete task_sessions (foreign key → tasks)
        await supabase.from('task_sessions').delete().in('task_id', ids);

        // Delete the expired tasks
        const { error: delErr } = await supabase.from('tasks').delete().in('id', ids);
        if (delErr) { console.error('[Cleanup] Delete error:', delErr.message); return; }

        console.log(`[Cleanup] Auto-deleted ${ids.length} expired task(s) + their sessions/submissions (older than 24h).`);
    } catch (e) {
        console.error('[Cleanup] Unexpected error:', e.message);
    }
}
// ─────────────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (accessible at http://10.65.96.229:${PORT})`);
    if (PORT !== 5000) {
        console.warn(`Warning: mobile app config.ts expects API at http://localhost:5000 — unset PORT or use 5000`);
    }
    await supabase.checkConnection();

    // Run cleanup immediately on start, then every 10 minutes
    cleanupExpiredTasks();
    setInterval(cleanupExpiredTasks, 10 * 60 * 1000);
});

// Graceful shutdown — don't drop in-flight requests on deploy.
function shutdown(signal) {
    console.log(`${signal} received, closing server...`);
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
    // Hard exit if something hangs.
    setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

