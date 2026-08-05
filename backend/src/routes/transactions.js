const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../lib/helpers');

router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const { data, error } = await supabase.from('transactions')
        .select('*').eq('user_id', req.user.id)
        .order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    res.json(data);
}));

module.exports = router;
