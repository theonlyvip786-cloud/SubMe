const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { asyncHandler, callRpc, isInsufficient } = require('../lib/helpers');

// Create a promotion request.
//
// The entire spend (points debit + ledger entry + promotion row) happens
// atomically inside the create_promotion() RPC, so two concurrent requests
// can never double-submit or overdraw. The promotion starts in 'pending'
// status; an admin must approve it before it becomes a live task
// (see admin.js /promotions/:id/approve -> approve_promotion()).
router.post('/request', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { title, videoUrl, channelUrl, mcqQuestion, mcqOptions, mcqAnswer, isVip, platform, thumbnailId } = req.body;

    if (!title || !videoUrl || !mcqQuestion || !mcqOptions || !mcqAnswer) {
        return res.status(400).json({
            error: 'Missing required fields: title, videoUrl, mcqQuestion, mcqOptions, mcqAnswer'
        });
    }

    try {
        const result = await callRpc(supabase, 'create_promotion', {
            p_user_id: req.user.id,
            p_title: title,
            p_video_url: videoUrl,
            p_channel_url: channelUrl || videoUrl, // fallback to videoUrl if no channel URL
            p_mcq_question: mcqQuestion,
            p_mcq_options: mcqOptions,
            p_mcq_answer: mcqAnswer,
            p_is_vip: !!isVip,
            p_platform: platform === 'instagram' ? 'instagram' : 'youtube',
            p_thumbnail_id: thumbnailId || null,
        });
        // BUG-20: promoId was unused; result.promotion_id available if needed in future

        res.json({
            message: 'Promotion submitted! It will be reviewed by admin and go live once approved.',
            cost: result && result.cost,
        });
    } catch (err) {
        if (isInsufficient(err)) {
            const cost = isVip ? 200 : 49;
            return res.status(400).json({ error: `Insufficient balance. You need ${cost} points.` });
        }
        throw err;
    }
}));

module.exports = router;
