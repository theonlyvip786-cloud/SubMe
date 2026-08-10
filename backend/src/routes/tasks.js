const express = require('express');
const router = express.Router();

router.get('/ping', (req, res) => res.json({ message: 'pong2', time: Date.now() }));
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../lib/helpers');

// List active tasks the user has NOT yet had APPROVED (excludes their completed ones and tasks older than 24 hours).
// Tasks with a pending or rejected submission still show — user can see progress or resubmit after rejection.
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const { data: submitted, error: subErr } = await supabase.from('submissions')
        .select('task_id').eq('user_id', req.user.id).eq('status', 'approved');
    if (subErr) throw subErr;
    const submittedIds = (submitted || []).map(s => s.task_id);

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let query = supabase.from('tasks')
        .select('*, users!creator_user_id(id, username, email)')
        .eq('is_active', true)
        .gte('created_at', cutoff); // Strict 24-hour live limit for ALL tasks

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
    console.log(`[DEBUG /start] User: ${req.user.id} attempting to start Task: ${task_id}`);
    
    let task;
    try {
        const result = await supabase.from('tasks').select('*').eq('id', task_id).single();
        if (result.error) throw result.error;
        task = result.data;
    } catch (e) {
        e.message = "STEP_1_TASKS: " + e.message;
        throw e;
    }
    
    if (!task || !task.is_active) {
        console.error(`[DEBUG /start] Task ${task_id} not found or inactive`);
        throw new Error('Task not found or inactive');
    }

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (task.created_at && new Date(task.created_at) < cutoffDate) {
        throw new Error('This task has expired (tasks remain live for 24 hours max)');
    }

    try {
        const { error } = await supabase.from('task_sessions').update({ status: 'abandoned' })
            .eq('user_id', req.user.id).eq('status', 'active')
            .lt('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        if (error) throw error;
    } catch (e) {
        e.message = "STEP_2_UPDATE_ABANDONED: " + e.message;
        throw e;
    }

    let existing;
    try {
        const result = await supabase.from('task_sessions')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('task_id', task_id)
            .eq('status', 'active')
            .maybeSingle();
        if (result.error) throw result.error;
        existing = result.data;
    } catch (e) {
        e.message = "STEP_3_SELECT_EXISTING: " + e.message;
        throw e;
    }
    
    if (existing) {
        return res.json({ message: 'Task session already active', session: existing });
    }

    try {
        const { error } = await supabase.from('task_sessions').delete()
            .eq('user_id', req.user.id)
            .eq('task_id', task_id)
            .in('status', ['abandoned', 'completed']);
        if (error) throw error;
    } catch (e) {
        e.message = "STEP_4_DELETE_OLD: " + e.message;
        throw e;
    }

    let data;
    try {
        // Auto-ensure user row exists in public.users to prevent foreign key 23503 error
        await supabase.from('users').upsert({
            id: req.user.id,
            email: req.user.email || 'user@subko.app',
            username: (req.user.email || 'user').split('@')[0],
            referral_code: 'SUB' + req.user.id.substring(0, 5).toUpperCase(),
        }, { onConflict: 'id', ignoreDuplicates: true });

        const result = await supabase.from('task_sessions')
            .upsert(
                { user_id: req.user.id, task_id, started_at: new Date().toISOString(), status: 'active' },
                { onConflict: 'user_id,task_id', ignoreDuplicates: true }
            )
            .select().maybeSingle();
        if (result.error) throw result.error;
        data = result.data;
    } catch (e) {
        e.message = "STEP_5_UPSERT: " + e.message;
        throw e;
    }
    
    if (!data) {
        try {
            const { data: latest, error } = await supabase.from('task_sessions')
                .select('*').eq('user_id', req.user.id).eq('task_id', task_id).eq('status', 'active').maybeSingle();
            if (error) throw error;
            data = latest;
        } catch (e) {
            e.message = "STEP_6_FETCH_LATEST: " + e.message;
            throw e;
        }
        if (!data) throw new Error('Failed to start or retrieve task session');
    }

    try {
        const { error } = await supabase.from('logs').insert([{
            user_id: req.user.id,
            action: `Task Started: ${task.title}`,
            ip_address: req.ip,
        }]);
        if (error) throw error;
    } catch (e) {
        e.message = "STEP_7_LOGS: " + e.message;
        throw e;
    }

    res.json({ message: 'Task session started successfully', session: data });
}));

// Submit a task: server-validated timer + MCQ + screenshot hash.
router.post('/:id/submit', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { id: task_id } = req.params;
    const { screenshot_url, image_hash, mcq_answer } = req.body;

    // Server enforces that a screenshot proof must accompany every submission.
    // The client UI already requires this; the server is the source of truth.
    if (!screenshot_url || !screenshot_url.trim()) {
        return res.status(400).json({ error: 'Screenshot proof is required. Please upload your subscription screenshot before submitting.' });
    }

    // Use the provided hash, or empty string (hash check will be skipped below).
    // No more fake 'no-hash-...' placeholders that permanently bypass the anti-cheat.
    const finalImageHash = image_hash && image_hash.trim() ? image_hash.trim() : '';


    const { data: task } = await supabase.from('tasks').select('*').eq('id', task_id).single();
    if (!task) throw new Error('Task not found');

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (task.created_at && new Date(task.created_at) < cutoffDate) {
        throw new Error('This task has expired (tasks remain live for 24 hours max)');
    }

    // Server-side timer validation (client timer is cosmetic only).
    const { data: session, error: sessionErr } = await supabase.from('task_sessions')
        .select('started_at')
        .eq('user_id', req.user.id)
        .eq('task_id', task_id)
        .eq('status', 'active')
        .maybeSingle();
        
    await supabase.from('logs').insert([{
        user_id: req.user.id,
        action: 'DEBUG /submit session fetch',
        metadata: { req_user_id: req.user.id, task_id, session, sessionErr },
        ip_address: req.ip
    }]);

    if (!session) {
        throw new Error('No active session. Please start the task first.');
    }

    const sessionAge = Date.now() - new Date(session.started_at).getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
        await supabase.from('task_sessions').update({ status: 'abandoned' })
            .eq('user_id', req.user.id).eq('task_id', task_id).eq('status', 'active');
        throw new Error('Session expired. Please start the task again.');
    }

    const elapsedSeconds = Math.floor(sessionAge / 1000);
    const toleranceSeconds = 3; // network-latency buffer
    
    // Bypass watch time validation for Instagram tasks as they don't have a reliable player API to track time
    if (task.platform !== 'instagram' && (elapsedSeconds + toleranceSeconds) < task.required_watch_time) {
        throw new Error(`Watch time not met. Required: ${task.required_watch_time}s, elapsed: ${elapsedSeconds}s (including tolerance)`);
    }

    // MCQ verification.
    if (task.mcq_answer && mcq_answer !== task.mcq_answer) {
        throw new Error('Incorrect answer');
    }

    // Only check for duplicate hash if a real hash was provided (non-empty string).
    // Missing hash (older devices / upload failures) skips the check — logged below.
    if (finalImageHash) {
        const { data: dupHash } = await supabase.from('submissions')
            .select('id, user_id')
            .eq('image_hash', finalImageHash)
            .limit(1)
            .maybeSingle();

        if (dupHash) {
            const sameUser = dupHash.user_id === req.user.id;
            await supabase.from('logs').insert([{
                user_id: req.user.id,
                action: sameUser ? 'Cheat Attempt: Duplicate Hash (self)' : 'Cheat Attempt: Duplicate Hash (cross-user)',
                ip_address: req.ip,
                metadata: { image_hash: finalImageHash, matched_submission: dupHash.id, owner: dupHash.user_id },
            }]);
            throw new Error(sameUser
                ? 'You have already used this screenshot.'
                : 'This screenshot has already been submitted by another account.');
        }
    } else {
        // No hash provided — flag for audit but allow through (don't punish hash failures)
        await supabase.from('logs').insert([{
            user_id: req.user.id,
            action: 'WARN: Submission without image hash',
            ip_address: req.ip,
            metadata: { task_id, screenshot_url },
        }]).catch(() => {});
    }

    // Insert submission with status 'approved' for instant reward
    const { data: submission, error } = await supabase.from('submissions').insert([{
        user_id: req.user.id, task_id, screenshot_url, image_hash: finalImageHash || null, mcq_answer: mcq_answer || null, status: 'approved',
    }]).select().single();
    if (error) {
        if (error.code === '23505') throw new Error('You have already submitted this task.');
        throw error;
    }

    // Mark session as completed.
    await supabase.from('task_sessions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('user_id', req.user.id).eq('task_id', task_id).eq('status', 'active');

    // Ensure user profile exists in users table so credit_points RPC never fails
    const { data: userRow } = await supabase.from('users').select('id').eq('id', req.user.id).maybeSingle();
    if (!userRow) {
        const refCode = req.user.id.replace(/-/g, '').toUpperCase();
        await supabase.from('users').insert([{
            id: req.user.id,
            email: req.user.email || `user_${req.user.id.substring(0,6)}@subme.app`,
            username: (req.user.email ? req.user.email.split('@')[0] : `User_${req.user.id.substring(0,4)}`),
            referral_code: refCode,
            points: 0,
            status: 'active'
        }]).catch(() => {});
    }

    // Instant point credit (1 BUG for standard task, 2 BUG's for VIP/Premium task)
    const rewardAmount = task.is_vip ? 2 : 1;
    await supabase.rpc('credit_points', { user_uuid: req.user.id, amount: rewardAmount });

    // Append to transactions ledger
    await supabase.from('transactions').insert([{
        user_id: req.user.id,
        amount: rewardAmount,
        type: 'reward',
        description: `Task Completed: ${task.title || 'Video'}${task.is_vip ? ' (VIP 2x)' : ''}`
    }]);

    res.json({ message: 'Task completed! BUG\'s credited to your wallet instantly.', reward: rewardAmount });
}));

module.exports = router;
