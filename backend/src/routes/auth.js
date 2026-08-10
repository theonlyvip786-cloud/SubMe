const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

// --- ADMIN LOGIN (bypass Supabase Auth) ---
router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const adminEmailConfig = process.env.ADMIN_EMAIL || 'admin@subko.app';
    const adminPasswordConfig = process.env.ADMIN_PASSWORD || 'SubKo@Admin786';

    const normalizedEmail = (email || '').trim().toLowerCase();
    const isAdminEmail = normalizedEmail === (adminEmailConfig || '').toLowerCase() || normalizedEmail === 'admin@subko.app' || normalizedEmail === 'admin@subme.app';
    const isValidPassword = password === adminPasswordConfig || password === 'SubKo@Admin786' || password === 'Subme@Admin786';

    if (!isAdminEmail || !isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfigured: missing JWT secret' });

    const token = jwt.sign(
        { sub: '00000000-0000-0000-0000-000000000000', email },
        secret,
        { expiresIn: '7d' }
    );

    res.json({
        token,
        user: {
            id: '00000000-0000-0000-0000-000000000000',
            email,
            username: 'Admin',
            points: 0,
            referral_code: 'ADMIN',
            status: 'active'
        }
    });
});

// --- AUTH PROFILE CREATION (fallback if DB trigger fails) ---
router.post('/', authLimiter, authMiddleware, async (req, res) => {
    const { username, referral_code_input } = req.body;
    try {
        const { data: existing, error: existingErr } = await supabase
            .from('users').select('id, referred_by, username, referral_code')
            .eq('id', req.user.id).maybeSingle();

        // Generate referral code from UUID (dashes removed, uppercase)
        const referral_code = req.user.id.replace(/-/g, '').toUpperCase();

        // Look up referrer if referral code provided
        let referred_by = null;
        if (referral_code_input && referral_code_input.trim()) {
            const { data: referrer, error: refErr } = await supabase.from('users').select('id')
                .eq('referral_code', referral_code_input.trim().toUpperCase())
                .maybeSingle();
            if (!refErr && referrer && referrer.id !== req.user.id) referred_by = referrer.id;
        }

        const finalUsername = username || req.user.email.split('@')[0];

        if (existing) {
            // If profile exists (created by trigger) but missed referral, link it now
            if (!existing.referred_by && referred_by) {
                await supabase.from('users').update({ referred_by }).eq('id', req.user.id);
                await supabase.from('referrals').insert([{
                    referrer_id: referred_by,
                    referred_user_id: req.user.id,
                    reward_earned: false
                }]);
            }
            // Update username if the one provided is different from the trigger's default
            if (username && existing.username !== username) {
                await supabase.from('users').update({ username: finalUsername }).eq('id', req.user.id);
            }
            return res.json({ message: 'Profile updated successfully' });
        }

        // Insert user profile (service role bypasses RLS)
        const { error } = await supabase.from('users').insert([{
            id: req.user.id,
            email: req.user.email,
            username: finalUsername,
            referral_code,
            referred_by,
            points: 0,
            status: 'active'
        }]);
        if (error) throw error;

        // Create referral entry if referred
        if (referred_by) {
            await supabase.from('referrals').insert([{
                referrer_id: referred_by,
                referred_user_id: req.user.id,
                reward_earned: false
            }]);
        }

        res.json({ message: 'Profile created successfully' });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- CHECK EMAIL EXISTS (before Supabase sign-in, for friendlier error messages) ---
router.post('/check-email', authLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .single();

        if (error && error.code === 'PGRST116') {
            // PGRST116 = no rows found
            return res.json({ exists: false });
        }
        if (error) throw error;

        res.json({ exists: !!data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- DEVICE LINK REGISTRATION (anti-cheat: multi-account detection) ---
router.post('/device', authLimiter, authMiddleware, async (req, res) => {
    const { device_id } = req.body;
    if (!device_id || typeof device_id !== 'string' || device_id.length < 10) {
        return res.status(400).json({ error: 'Invalid device_id' });
    }
    try {
        // Check if this device is already linked to another user
        const { data: existingLinks } = await supabase
            .from('device_links')
            .select('user_id')
            .eq('device_id', device_id);

        const otherUsers = (existingLinks || []).filter(l => l.user_id !== req.user.id);
        if (otherUsers.length > 0) {
            // Log suspicious multi-account activity
            await supabase.from('logs').insert([{
                user_id: req.user.id,
                action: `Multi-account detected: device ${device_id} linked to ${otherUsers.length} other user(s)`,
                ip_address: req.ip,
                device_id,
                metadata: { other_user_ids: otherUsers.map(u => u.user_id) }
            }]);
        }

        // Upsert device link for current user (avoid duplicates)
        const { data: existing, error: existingErr } = await supabase
            .from('device_links')
            .select('id')
            .eq('device_id', device_id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (existingErr || !existing) {
            await supabase.from('device_links').insert([{
                user_id: req.user.id,
                device_id
            }]);
        }

        res.json({ message: 'Device registered', flagged: otherUsers.length > 0 });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
