const rateLimit = require('express-rate-limit');

// In development (NODE_ENV !== 'production'), limits are relaxed to avoid
// blocking hot-reload and local testing. Production limits are strict.
const isDev = process.env.NODE_ENV !== 'production';

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 2000 : 300, // 300 req/15 min in production
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 200 : 20, // 20 auth attempts per 15 min in production (brute-force protection)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

module.exports = { apiLimiter, authLimiter };
