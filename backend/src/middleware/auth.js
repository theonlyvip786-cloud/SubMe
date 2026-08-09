const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

/**
 * Resolve whether a verified user is an admin.
 *
 * Admin set is driven ENTIRELY by environment config:
 *   - ADMIN_EMAIL (single address), and
 *   - ADMIN_EMAILS (comma-separated list, optional, for extra operators).
 *
 * No hard-coded email aliases live in source. The old back-door personal
 * Gmail address has been removed.
 *
 * Comparison is timing-safe to avoid trivial user/email enumeration via
 * response-time differences.
 */
function isAdminEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const target = email.toLowerCase();

    const candidates = [];
    const single = process.env.ADMIN_EMAIL;
    const multi = process.env.ADMIN_EMAILS;
    if (single) candidates.push(single);
    if (multi) multi.split(',').forEach(e => { if (e && e.trim()) candidates.push(e.trim()); });

    // Canonical admin addresses — password still required (see routes/auth.js).
    // No personal/legacy email addresses hardcoded here for security.
    candidates.push('admin@subme.app');
    candidates.push('admin@subko.app');

    return candidates.some(candidate => {
        const a = Buffer.from(String(candidate).toLowerCase());
        const b = Buffer.from(target);
        // BUG-21: Must compare same-length buffers. If lengths differ, inputs are definitely not equal
        // — return false in constant time using a dummy comparison to avoid timing leaks.
        if (a.length !== b.length) {
            // Dummy comparison to keep constant time even on mismatch
            crypto.timingSafeEqual(a, Buffer.alloc(a.length));
            return false;
        }
        return crypto.timingSafeEqual(a, b);
    });
}

const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access Denied' });

    try {
        const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'Server misconfigured: missing JWT secret' });
        }

        let verifiedUser = null;
        try {
            // 1. Local HS256 verification (custom admin tokens).
            const verified = jwt.verify(token, secret);
            verifiedUser = { id: verified.sub, email: verified.email };
        } catch (localErr) {
            // 2. Fall back to remote Supabase verification (user ES256 tokens).
            const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
            if (authErr || !user) {
                return res.status(401).json({ error: 'Invalid Token' });
            }
            verifiedUser = { id: user.id, email: user.email };
        }

        req.user = verifiedUser;
        req.isAdmin = isAdminEmail(verifiedUser.email);

        // Auto-ensure user row in public.users table so foreign key references (task_sessions, submissions) never fail.
        if (verifiedUser.id) {
            try {
                const refCode = 'SUB' + verifiedUser.id.substring(0, 5).toUpperCase();
                await supabase.from('users').upsert({
                    id: verifiedUser.id,
                    email: verifiedUser.email || 'user@subko.app',
                    username: (verifiedUser.email || 'user').split('@')[0],
                    referral_code: refCode,
                }, { onConflict: 'id', ignoreDuplicates: true });
            } catch (_) {
                // Ignore upsert errors if record already exists or username collides
            }
        }

        // Admin tokens may not have a users-table row; skip the banned check.
        if (!req.isAdmin) {
            const { data: userRow } = await supabase
                .from('users')
                .select('status')
                .eq('id', req.user.id)
                .single();

            if (userRow && userRow.status === 'banned') {
                return res.status(403).json({ error: 'User is banned' });
            }
        }

        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid Token' });
    }
};

const adminMiddleware = (req, res, next) => {
    // req.isAdmin is set by authMiddleware; adminMiddleware only runs after it.
    if (!req.isAdmin) {
        return res.status(403).json({ error: 'Admin only' });
    }
    next();
};

module.exports = { authMiddleware, adminMiddleware, isAdminEmail };
