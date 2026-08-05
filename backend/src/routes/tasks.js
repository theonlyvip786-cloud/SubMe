const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../lib/helpers');

// List active tasks the user has NOT yet submitted (excludes their completed ones and tasks older than 24 hours).
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const { data: submitted, error: subErr } = await supabase.from('submissions')
        .select('task_id').eq('user_id', req.user.id);
    if (subErr) throw subErr;
    const submittedIds = (submitted || []).map(s => s.task_id);

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let query = supabase.from('tasks')
        .select('*')
        .eq('is_active', true)
        .gte('created_at', cutoff); // Strict 24-hour live limit for ALL tasks (Instagram/YouTube, VIP/Standard)

    if (submittedIds.length > 0) {
        query = query.not('id', 'in', `(${submittedIds.join(',')})`);
    }
    const { data, error } = await query.order('is_vip', { ascending: false });
    if (error) throw error;
    res.json(data || []);
}));

// Start a task session (server-side timer for anti-cheat).
router.post('/:id/start', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { id: task_id } = req.params;
    const { data: task } = await supabase.from('tasks').select('*').eq('id', task_id).single();
    if (!task || !task.is_active) throw new Error('Task not found or inactive');

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (task.created_at && new Date(task.created_at) < cutoffDate) {
        throw new Error('This task has expired (tasks remain live for 24 hours max)');
    }

    // Expire stale sessions older than 24 hours.
    await supabase.from('task_sessions').update({ status: 'abandoned' })
        .eq('user_id', req.user.id).eq('status', 'active')
        .lt('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Reuse an existing active session if one exists.
    const { data: existing } = await supabase.from('task_sessions')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('task_id', task_id)
        .eq('status', 'active')
        .maybeSingle();
    if (existing) {
        return res.json({ message: 'Task session already active', session: existing });
    }

    // BUG-07: Delete any abandoned/completed session for this user+task before creating a new one.
    // This allows a user to restart a task they previously abandoned.
    await supabase.from('task_sessions').delete()
        .eq('user_id', req.user.id)
        .eq('task_id', task_id)
        .in('status', ['abandoned', 'completed']);

    const { data, error } = await supabase.from('task_sessions')
        .upsert(
            { user_id: req.user.id, task_id, started_at: new Date().toISOString(), status: 'active' },
            { onConflict: 'user_id,task_id', ignoreDuplicates: true }  // BUG-07: don't overwrite existing active session timer
        )
        .select().single();
    if (error) throw error;

    await supabase.from('logs').insert([{
        user_id: req.user.id,
        action: `Task Started: ${task.title}`,
        ip_address: req.ip,
    }]);

    res.json({ message: 'Task session started', session: data });
}));

// Submit a task: server-validated timer + MCQ + screenshot hash.
router.post('/:id/submit', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { id: task_id } = req.params;
    const { screenshot_url, image_hash, mcq_answer } = req.body;

    const finalScreenshotUrl = screenshot_url || null;  // BUG-08: null is cleaner than 'no-screenshot' string
    const finalImageHash = image_hash || `no-hash-${req.user.id}-${task_id}-${Date.now()}`;

    const { data: task } = await supabase.from('tasks').select('*').eq('id', task_id).single();
    if (!task) throw new Error('Task not found');

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (task.created_at && new Date(task.created_at) < cutoffDate) {
        throw new Error('This task has expired (tasks remain live for 24 hours max)');
    }

    // Server-side timer validation (client timer is cosmetic only).
    const { data: session } = await supabase.from('task_sessions')
        .select('started_at')
        .eq('user_id', req.user.id)
        .eq('task_id', task_id)
        .eq('status', 'active')
        .maybeSingle();
    if (!session) throw new Error('No active session. Please start the task first.');

    const sessionAge = Date.now() - new Date(session.started_at).getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
        await supabase.from('task_sessions').update({ status: 'abandoned' })
            .eq('user_id', req.user.id).eq('task_id', task_id).eq('status', 'active');
        throw new Error('Session expired. Please start the task again.');
    }

    const elapsedSeconds = Math.floor(sessionAge / 1000);
    const toleranceSeconds = 3; // network-latency buffer
    if ((elapsedSeconds + toleranceSeconds) < task.required_watch_time) {
        throw new Error(`Watch time not met. Required: ${task.required_watch_time}s, elapsed: ${elapsedSeconds}s (including tolerance)`);
    }

    // MCQ verification.
    if (task.mcq_answer && mcq_answer !== task.mcq_answer) {
        throw new Error('Incorrect answer');
    }

    // Only check for duplicate hash if a real hash was provided (not the no-hash placeholder)
    if (image_hash && !image_hash.startsWith('no-hash-')) {
        const { data: dupHash } = await supabase.from('submissions')
            .select('id, user_id')
            .eq('image_hash', image_hash)
            .limit(1)
            .maybeSingle();

        if (dupHash) {
            const sameUser = dupHash.user_id === req.user.id;
            await supabase.from('logs').insert([{
                user_id: req.user.id,
                action: sameUser ? 'Cheat Attempt: Duplicate Hash (self)' : 'Cheat Attempt: Duplicate Hash (cross-user)',
                ip_address: req.ip,
                metadata: { image_hash, matched_submission: dupHash.id, owner: dupHash.user_id },
            }]);
            throw new Error(sameUser
                ? 'You have already used this screenshot.'
                : 'This screenshot has already been submitted by another account.');
        }
    }

    const { data: submission, error } = await supabase.from('submissions').insert([{
        user_id: req.user.id, task_id, screenshot_url: finalScreenshotUrl, image_hash: finalImageHash, mcq_answer: mcq_answer || null, status: 'pending',
    }]).select().single();
    if (error) {
        if (error.code === '23505') throw new Error('You have already submitted this task.');
        throw error;
    }

    // Mark session as completed.
    await supabase.from('task_sessions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('user_id', req.user.id).eq('task_id', task_id).eq('status', 'active');

    // Points are credited by admin on approval via approve_submission RPC
    // Referral bonus is handled atomically inside the same RPC

    res.json({ message: 'Task submitted for review. Points will be credited after admin approval.' });
}));

module.exports = router;
