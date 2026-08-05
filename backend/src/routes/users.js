const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware, isAdminEmail } = require('../middleware/auth');

router.get('/me', authMiddleware, async (req, res) => {
    try {
        if (isAdminEmail(req.user.email) || req.user.id === '00000000-0000-0000-0000-000000000000') {
            return res.json({
                id: '00000000-0000-0000-0000-000000000000',
                email: req.user.email,
                username: 'Admin',
                points: 0,
                referral_code: 'ADMIN',
                status: 'active',
                totalApproved: 0,
            });
        }

        const { data: user, error } = await supabase.from('users').select('id, username, email, points, referral_code, status').eq('id', req.user.id).single();
        if (error) throw error;

        const { count } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('status', 'approved');
        const { count: premiumCount } = await supabase.from('promotions').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('is_vip', true);
        
        res.json({ ...user, totalApproved: count || 0, is_premium: premiumCount > 0 });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/me', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username || username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }

        if (isAdminEmail(req.user.email) || req.user.id === '00000000-0000-0000-0000-000000000000') {
            return res.status(400).json({ error: 'Admin username cannot be modified.' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .update({ username: username.trim() })
            .eq('id', req.user.id)
            .select('id, username, email, points, referral_code, status')
            .single();

        if (error) throw error;

        const { count } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('status', 'approved');
        res.json({ ...user, totalApproved: count || 0 });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
