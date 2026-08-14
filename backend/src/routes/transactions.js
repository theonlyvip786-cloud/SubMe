const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../lib/helpers');

router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    // 1. Fetch normal transactions
    const { data: txData, error: txError } = await supabase.from('transactions')
        .select('*').eq('user_id', req.user.id)
        .order('created_at', { ascending: false }).limit(20);
    if (txError) throw txError;

    // 2. Fetch rejected payment requests
    const { data: rejectedData, error: rejError } = await supabase.from('payment_requests')
        .select('*').eq('user_id', req.user.id).eq('status', 'rejected')
        .order('created_at', { ascending: false }).limit(10);
    if (rejError) throw rejError;

    // 3. Format rejected payments to match transaction structure
    const rejectedTx = (rejectedData || []).map(req => ({
        id: req.id,
        type: 'rejected',
        amount: req.amount,
        description: `Rejected Payment (UTR: ${req.utr_number})`,
        created_at: req.created_at,
        is_rejected: true
    }));

    // 4. Merge and sort by created_at descending
    const combined = [...(txData || []), ...rejectedTx];
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(combined.slice(0, 30));
}));

module.exports = router;
