const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../lib/helpers');

// Referral bounty amount — must match the credit applied in tasks.js and admin.js approve hook.
const REFERRAL_REWARD = 5;

router.get('/stats', authMiddleware, asyncHandler(async (req, res) => {
    const { count } = await supabase.from('referrals')
        .select('*', { count: 'exact', head: true }).eq('referrer_id', req.user.id);
    const { count: rewarded } = await supabase.from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', req.user.id).eq('reward_earned', true);

    res.json({
        totalReferrals: count || 0,
        rewardedReferrals: rewarded || 0,
        totalEarnings: (rewarded || 0) * REFERRAL_REWARD,
        rewardPerReferral: REFERRAL_REWARD,
    });
}));

// GET /api/referrals/list — returns the list of users referred by the current user
router.get('/list', authMiddleware, asyncHandler(async (req, res) => {
    const { data: referrals, error } = await supabase.from('referrals')
        .select(`
            created_at,
            reward_earned,
            users!referred_user_id ( id, username, email )
        `)
        .eq('referrer_id', req.user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(referrals || []);
}));

// GET /api/referrals/code — returns the current user's own referral code
// BUG-18: screens should be able to fetch the referral code independently
router.get('/code', authMiddleware, asyncHandler(async (req, res) => {
    const { data: userRow, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', req.user.id)
        .single();
    if (error || !userRow) return res.status(404).json({ error: 'User not found' });
    res.json({ referral_code: userRow.referral_code });
}));

module.exports = router;
