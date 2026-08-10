const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../lib/helpers');

// All admin routes require auth + admin check
router.use(authMiddleware, adminMiddleware);

// --- SUBMISSION ROUTES ---

router.post('/submissions/:id/approve', asyncHandler(async (req, res) => {
    // Use the atomic approve_submission RPC which handles:
    // - Status update (pending → approved) with row locking
    // - VIP 2x reward calculation
    // - Point credit via credit_points
    // - Transaction ledger insert
    // - Referral bonus check and credit (5 BUGs)
    // All in a single atomic transaction
    const { data: result, error } = await supabase.rpc('approve_submission', { sub_id: req.params.id });
    if (error) {
        if (error.message && error.message.includes('already approved')) {
            return res.status(409).json({ error: 'Already approved — points already credited.' });
        }
        if (error.message && error.message.includes('Cannot approve a rejected')) {
            return res.status(409).json({ error: 'Submission was already rejected.' });
        }
        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ error: 'Submission not found.' });
        }
        throw new Error(error.message || 'Failed to approve submission');
    }
    res.json({ message: 'Approved and points credited', result });
}));


router.post('/submissions/:id/reject', asyncHandler(async (req, res) => {
    // Check current status before rejecting
    const { data: sub } = await supabase.from('submissions').select('status').eq('id', req.params.id).single();
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (sub.status !== 'pending') return res.status(409).json({ error: `Submission is already ${sub.status}.` });

    const { error } = await supabase.from('submissions').update({ status: 'rejected' }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Submission rejected' });
}));

router.get('/submissions/pending', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('submissions')
        .select('*, users(username), tasks(title)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50); // Hard limit to prevent overload
    if (error) throw error;
    res.json(data);
}));

// --- TASK ROUTES ---

router.post('/tasks', asyncHandler(async (req, res) => {
    const { title, video_url, reward_points, is_vip, required_watch_time, mcq_question, mcq_options, mcq_answer, thumbnail_id, platform } = req.body;
    if (!title || !video_url || !reward_points || !required_watch_time || !mcq_question || !mcq_options || !mcq_answer) {
        return res.status(400).json({ error: 'Missing required fields: title, video_url, reward_points, required_watch_time, mcq_question, mcq_options, mcq_answer' });
    }
    const { error } = await supabase.from('tasks').insert([{
        title, video_url, reward_points: parseInt(reward_points),
        is_vip: is_vip || false, required_watch_time: parseInt(required_watch_time),
        mcq_question, mcq_options, mcq_answer, is_active: true,
        thumbnail_id: thumbnail_id || null,
        platform: platform || 'youtube',
        creator_user_id: req.user.id
    }]);
    if (error) throw error;
    res.json({ message: 'Task created' });
}));

router.get('/tasks', asyncHandler(async (req, res) => {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
}));

router.put('/tasks/:id', asyncHandler(async (req, res) => {
    const { title, video_url, reward_points, required_watch_time, mcq_question, mcq_options, mcq_answer, thumbnail_id, is_vip, platform } = req.body;
    const { error } = await supabase.from('tasks').update({
        title,
        video_url,
        reward_points: parseInt(reward_points || (is_vip ? '2' : '1')),
        required_watch_time: parseInt(required_watch_time || '180'),
        mcq_question,
        mcq_options: Array.isArray(mcq_options) ? mcq_options : (mcq_options ? mcq_options.split(',').map(s => s.trim()) : []),
        mcq_answer,
        thumbnail_id: thumbnail_id || null,
        is_vip: is_vip || false,
        platform: platform || 'youtube'
    }).eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Task updated successfully' });
}));

router.post('/tasks/:id/toggle', asyncHandler(async (req, res) => {
    const { data: task } = await supabase.from('tasks').select('is_active').eq('id', req.params.id).single();
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { error } = await supabase.from('tasks').update({ is_active: !task.is_active }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: `Task ${!task.is_active ? 'activated' : 'paused'}`, is_active: !task.is_active });
}));

router.delete('/tasks/:id', asyncHandler(async (req, res) => {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Task deleted' });
}));

// --- USER MANAGEMENT ROUTES ---

router.get('/users/search', asyncHandler(async (req, res) => {
    const { q } = req.query;
    let query = supabase
        .from('users')
        .select('id, username, email, points, referral_code, created_at, status')
        .order('created_at', { ascending: false })
        .limit(100);

    if (q && q.length >= 2) {
        query = query.or(`email.ilike.%${q}%,username.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    if (data && data.length > 0) {
        const userIds = data.map(u => u.id);
        const { data: premiumPromos } = await supabase
            .from('promotions')
            .select('user_id')
            .eq('is_vip', true)
            .in('user_id', userIds);
            
        const premiumSet = new Set(premiumPromos?.map(p => p.user_id) || []);
        const enriched = data.map(u => ({ ...u, is_premium: premiumSet.has(u.id) }));
        return res.json(enriched);
    }
    
    res.json(data || []);
}));

router.post('/users/:id/ban', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'ban' or 'unban'
    const status = action === 'unban' ? 'active' : 'banned';
    const { data, error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    
    await supabase.from('logs').insert([{
        user_id: req.user.id,
        action: 'admin_user_status_change',
        metadata: { target_user: id, new_status: status }
    }]);

    res.json(data);
}));

router.post('/users/credit', async (req, res) => {
    const { userId, amount, description } = req.body;
    const creditAmount = Number(amount);
    if (!userId || isNaN(creditAmount) || !Number.isInteger(creditAmount) || creditAmount <= 0) {
        return res.status(400).json({ error: 'Invalid userId or amount (must be a positive whole number).' });
    }
    try {
        const { data: user, error } = await supabase.from('users').select('username, email').eq('id', userId).single();
        if (error || !user) throw new Error('User not found');
        const { error: creditErr } = await supabase.rpc('credit_points', { user_uuid: userId, amount: creditAmount });
        if (creditErr) throw new Error('Failed to credit points');

        await supabase.from('transactions').insert([{
            user_id: userId,
            type: 'topup',
            amount: creditAmount,
            description: description || `Manual credit by admin — Payment received`
        }]);

        const { data: updated } = await supabase.from('users').select('points').eq('id', userId).single();
        res.json({ message: `${amount} SubMe BUG's credited to ${user.username}`, newBalance: updated?.points });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// --- PROMOTION ROUTES ---

router.get('/promotions/pending', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('promotions')
        .select('*, users(username, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50); // Hard limit
    if (error) throw error;
    res.json(data);
}));

// Approve promotion: atomically creates a real Task from it
router.post('/promotions/:id/approve', asyncHandler(async (req, res) => {
    const { data: result, error } = await supabase.rpc('approve_promotion', { promo_id: req.params.id });
    if (error) {
        if (error.message && error.message.includes('already')) {
            return res.status(409).json({ error: 'Already processed.' });
        }
        throw new Error(error.message || 'Failed to approve promotion');
    }
    res.json({ message: 'Promotion approved and task created!', result });
}));

// Reject promotion: atomically refunds points to user
router.post('/promotions/:id/reject', asyncHandler(async (req, res) => {
    const { data: result, error } = await supabase.rpc('reject_promotion', { promo_id: req.params.id });
    if (error) {
        if (error.message && error.message.includes('already')) {
            return res.status(409).json({ error: 'Already processed.' });
        }
        throw new Error(error.message || 'Failed to reject promotion');
    }
    res.json({ message: 'Promotion rejected and points refunded.', result });
}));

// --- PAYMENT ROUTES ---

router.get('/payments/pending', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('payment_requests')
        .select('*, users(username, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50); // Hard limit
    if (error) throw error;
    res.json(data);
}));

router.post('/payments/:id/approve', async (req, res) => {
    try {
        const { data: result, error } = await supabase.rpc('approve_payment', { payment_id: req.params.id });
        if (error) {
            if (error.message && error.message.includes('already')) {
                return res.status(409).json({ error: 'Already processed.' });
            }
            if (error.message && error.message.includes('not found')) {
                return res.status(404).json({ error: 'Payment request not found.' });
            }
            throw new Error(error.message || 'Failed to approve payment');
        }
        res.json({ message: `Payment approved. BUG's credited.` });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/payments/:id/reject', asyncHandler(async (req, res) => {
    const { data: payment } = await supabase.from('payment_requests').select('*').eq('id', req.params.id).single();
    if (!payment) return res.status(404).json({ error: 'Payment request not found' });
    if (payment.status !== 'pending') return res.status(409).json({ error: 'Already processed' });

    await supabase.from('payment_requests').update({ status: 'rejected' }).eq('id', req.params.id);
    res.json({ message: 'Payment rejected' });
}));


// --- USER STATUS MANAGEMENT ---
router.post('/users/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['active', 'banned'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const { error } = await supabase.from('users').update({ status }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: `User status updated to ${status}` });
}));

// --- ANALYTICS & LEDGER ROUTES ---
router.get('/analytics', async (req, res) => {
    try {
        const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: submissionsCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: paymentsCount } = await supabase.from('payment_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        
        // Sum total points in circulation
        const { data: usersData } = await supabase.from('users').select('points');
        const totalPoints = usersData?.reduce((acc, u) => acc + (u.points || 0), 0) || 0;

        // Fetch transactions from the last 6 months to build metrics & charts
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const { data: txs, error: txsErr } = await supabase
            .from('transactions')
            .select('amount, type, created_at')
            .gte('created_at', sixMonthsAgo.toISOString())
            .order('created_at', { ascending: true });

        if (txsErr) throw txsErr;

        // Calculate aggregates
        let totalEarnedPoints = 0;
        let totalSpentPoints = 0;
        if (txs) {
            txs.forEach(tx => {
                const val = Math.abs(tx.amount || 0);
                if (['earn', 'reward', 'topup', 'refund'].includes(tx.type)) {
                    totalEarnedPoints += val;
                } else if (tx.type === 'spend') {
                    totalSpentPoints += val;
                }
            });
        }

        // Setup chart Maps
        // Daily (Last 7 days)
        const dailyMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const label = d.toLocaleDateString('en-US', { weekday: 'short' });
            dailyMap[key] = { label, earned: 0, spent: 0 };
        }

        // Weekly (Last 4 weeks)
        const weeklyMap = {};
        for (let i = 3; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i * 7);
            const startOfWeek = new Date(d);
            const day = startOfWeek.getDay();
            const diff = startOfWeek.getDate() - day;
            startOfWeek.setDate(diff);
            startOfWeek.setHours(0, 0, 0, 0);
            const key = startOfWeek.toISOString().split('T')[0];
            const label = `Wk of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            weeklyMap[key] = { label, earned: 0, spent: 0, dateObj: new Date(startOfWeek) };
        }

        // Monthly (Last 6 months)
        const monthlyMap = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'short' });
            monthlyMap[key] = { label, earned: 0, spent: 0 };
        }

        // Populate maps
        if (txs) {
            txs.forEach(tx => {
                const txDate = new Date(tx.created_at);
                const txDateStr = txDate.toISOString().split('T')[0];
                const isEarn = ['earn', 'reward', 'topup', 'refund'].includes(tx.type);
                const val = Math.abs(tx.amount || 0);

                // Daily
                if (dailyMap[txDateStr]) {
                    if (isEarn) dailyMap[txDateStr].earned += val;
                    else dailyMap[txDateStr].spent += val;
                }

                // Weekly
                for (const [key, slot] of Object.entries(weeklyMap)) {
                    const slotStart = slot.dateObj;
                    const slotEnd = new Date(slotStart);
                    slotEnd.setDate(slotEnd.getDate() + 7);
                    if (txDate >= slotStart && txDate < slotEnd) {
                        if (isEarn) slot.earned += val;
                        else slot.spent += val;
                        break;
                    }
                }

                // Monthly
                const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyMap[monthKey]) {
                    if (isEarn) monthlyMap[monthKey].earned += val;
                    else monthlyMap[monthKey].spent += val;
                }
            });
        }

        const dailyChart = Object.keys(dailyMap).sort().map(k => ({ label: dailyMap[k].label, earned: dailyMap[k].earned, spent: dailyMap[k].spent }));
        const weeklyChart = Object.keys(weeklyMap).sort().map(k => ({ label: weeklyMap[k].label, earned: weeklyMap[k].earned, spent: weeklyMap[k].spent }));
        const monthlyChart = Object.keys(monthlyMap).sort().map(k => ({ label: monthlyMap[k].label, earned: monthlyMap[k].earned, spent: monthlyMap[k].spent }));

        // Fetch approved payment requests (Income/Revenue source)
        const { data: approvedPayments } = await supabase
            .from('payment_requests')
            .select('id, user_id, amount, utr_number, status, created_at, users(username)')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        let todayRev = 0, todayCount = 0;
        let monthRev = 0, monthCount = 0;
        let lifeRev = 0, lifeCount = 0;

        const incomeHistory = (approvedPayments || []).map(p => {
            const pDate = new Date(p.created_at);
            const amt = Math.abs(p.amount || 0);

            lifeRev += amt;
            lifeCount += 1;

            if (pDate >= startOfMonth) {
                monthRev += amt;
                monthCount += 1;
            }

            if (pDate >= startOfToday) {
                todayRev += amt;
                todayCount += 1;
            }

            return {
                id: p.id,
                username: p.users?.username || 'user',
                amount: amt,
                utr_number: p.utr_number,
                created_at: p.created_at
            };
        });

        res.json({
            stats: {
                totalUsers: usersCount || 0,
                pendingSubmissions: submissionsCount || 0,
                pendingPayments: paymentsCount || 0,
                totalPoints,
                totalEarnedPoints,
                totalSpentPoints
            },
            revenue: {
                today: { amount: todayRev, count: todayCount },
                month: { amount: monthRev, count: monthCount },
                entireLife: { amount: lifeRev, count: lifeCount },
                history: incomeHistory
            },
            charts: {
                daily: dailyChart,
                weekly: weeklyChart,
                monthly: monthlyChart
            }
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/transactions/export', async (req, res) => {
    try {
        // Restrict export to last 30 days to prevent huge queries
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: txs, error } = await supabase
            .from('transactions')
            .select('id, amount, type, description, created_at, users(username, email)')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(5000); // hard limit of 5k rows per export

        if (error) throw error;

        const headers = ['Transaction ID', 'Date', 'User', 'Email', 'Type', "Amount (BUG's)", 'Description'];
        const rows = (txs || []).map(tx => [
            tx.id,
            new Date(tx.created_at).toISOString(),
            tx.users?.username || 'N/A',
            tx.users?.email || 'N/A',
            tx.type,
            tx.amount,
            `"${(tx.description || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        res.json({ csv: csvContent });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/logs', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('logs')
        .select('*, users(username, email)')
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) throw error;
    res.json(data);
}));

// POST /api/admin/upi-config — update active UPI handles & payee name
router.post('/upi-config', asyncHandler(async (req, res) => {
    const { name, handles } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Payee name is required.' });
    }
    if (!Array.isArray(handles) || handles.length === 0) {
        return res.status(400).json({ error: 'At least one UPI handle is required.' });
    }

    const cleanHandles = handles
        .map(h => String(h).trim().toLowerCase())
        .filter(h => h.length > 0 && h.includes('@'));

    if (cleanHandles.length === 0) {
        return res.status(400).json({ error: 'Please enter valid UPI IDs (e.g. name@upi).' });
    }

    const newConfig = {
        name: name.trim(),
        handles: cleanHandles,
    };

    const { error } = await supabase
        .from('system_settings')
        .upsert({
            key: 'upi_config',
            value: newConfig,
            updated_at: new Date().toISOString(),
        });

    if (error) throw error;

    await supabase.from('logs').insert([{
        user_id: req.user.id,
        action: `Admin updated UPI handles: ${cleanHandles.join(', ')} | Payee: ${name}`,
        ip_address: req.ip,
    }]);

    res.json({ message: 'UPI settings updated successfully!', config: newConfig });
}));

module.exports = router;

