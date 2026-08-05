const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../lib/helpers');

// POST /api/proofs/:taskId
// Submitter uploads a subscription proof screenshot URL for a task.
router.post('/:taskId', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { screenshot_url } = req.body;

    if (!screenshot_url || !screenshot_url.trim()) {
        return res.status(400).json({ error: 'screenshot_url is required' });
    }

    // Verify task exists and is active
    const { data: task, error: taskErr } = await supabase
        .from('tasks')
        .select('id, is_active')
        .eq('id', taskId)
        .single();

    if (taskErr || !task) return res.status(404).json({ error: 'Task not found' });
    if (!task.is_active) return res.status(400).json({ error: 'Task is no longer active' });

    // Upsert: one proof per submitter per task
    const { error } = await supabase.from('subscription_proofs').upsert({
        task_id: taskId,
        submitter_user_id: req.user.id,
        screenshot_url: screenshot_url.trim(),
        submitted_at: new Date().toISOString(),
    }, { onConflict: 'task_id,submitter_user_id' });

    if (error) throw error;

    res.json({ message: 'Subscription proof saved successfully.' });
}));

// GET /api/proofs/my-tasks
// Returns all subscription proofs for tasks created by the authenticated user.
// The route '/my-tasks' must be defined BEFORE '/:taskId' to avoid param conflict.
router.get('/my-tasks', authMiddleware, asyncHandler(async (req, res) => {
    // Find all tasks where this user is the creator
    const { data: tasks, error: tasksErr } = await supabase
        .from('tasks')
        .select('id, title, thumbnail_id, video_url, platform')
        .eq('creator_user_id', req.user.id)
        .eq('is_active', true);

    if (tasksErr) throw tasksErr;
    if (!tasks || tasks.length === 0) return res.json([]);

    const taskIds = tasks.map(t => t.id);

    // Fetch all proofs for those tasks, including submitter username
    const { data: proofs, error: proofsErr } = await supabase
        .from('subscription_proofs')
        .select('id, task_id, screenshot_url, submitted_at, submitter_user_id, users(username)')
        .in('task_id', taskIds)
        .order('submitted_at', { ascending: false });

    if (proofsErr) throw proofsErr;

    // Group proofs by task
    const taskMap = tasks.map(task => ({
        ...task,
        proofs: (proofs || []).filter(p => p.task_id === task.id),
    }));

    res.json(taskMap);
}));

// POST /api/proofs/:id/report
// Allows a task creator to report a user for unsubscribing
router.post('/:id/report', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Verify proof exists and the current user is the creator of the task
    const { data: proof, error: proofErr } = await supabase
        .from('subscription_proofs')
        .select('*, tasks!inner(creator_user_id, title), users(username)')
        .eq('id', id)
        .single();
        
    if (proofErr || !proof) return res.status(404).json({ error: 'Proof not found' });
    if (proof.tasks.creator_user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to report this proof' });
    }

    // Insert a log entry for the report
    const { error: logErr } = await supabase.from('logs').insert([{
        user_id: req.user.id, // the creator who is reporting
        action: 'User Reported (Unsubscribe/Cheat)',
        metadata: {
            reported_user_id: proof.submitter_user_id,
            reported_username: proof.users?.username,
            task_id: proof.task_id,
            task_title: proof.tasks?.title,
            proof_id: proof.id,
            reason: reason || 'Unsubscribed'
        },
        ip_address: req.ip
    }]);

    if (logErr) throw logErr;

    res.json({ message: 'Report submitted successfully. Admin will review and take action.' });
}));

module.exports = router;
