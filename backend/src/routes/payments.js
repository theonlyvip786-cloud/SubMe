const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authMiddleware } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const { asyncHandler } = require('../lib/helpers');

// ─── Cashfree Config ──────────────────────────────────────────────────────────
// These are read from .env. They will be undefined until you fill in credentials.
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || 'sandbox';
const CASHFREE_BASE_URL = CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

// Helper: Check if Cashfree credentials are configured
const isCashfreeReady = () =>
    CASHFREE_APP_ID &&
    CASHFREE_APP_ID !== 'your_cashfree_app_id_here' &&
    CASHFREE_SECRET_KEY &&
    CASHFREE_SECRET_KEY !== 'your_cashfree_secret_key_here';

// ─────────────────────────────────────────────────────────────────────────────
//  CASHFREE ROUTES (STUB — wire up when credentials are available)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/payments/create-order
// Creates a Cashfree payment order and returns the payment_session_id.
// Frontend uses this session ID to open the Cashfree checkout page.
router.post('/create-order', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const parsedAmount = Number(amount);

    if (isNaN(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount < 50) {
        return res.status(400).json({ error: 'Minimum payment is ₹50 (must be a whole number).' });
    }
    if (parsedAmount > 100000) {
        return res.status(400).json({ error: 'Maximum payment is ₹1,00,000.' });
    }

    // ── TODO: Replace stub block below with live Cashfree API call ────────────
    // When credentials are ready:
    //
    // const axios = require('axios');
    // const orderId = `SUBKO_${req.user.id.substring(0,8)}_${Date.now()}`;
    // const cfRes = await axios.post(`${CASHFREE_BASE_URL}/orders`, {
    //     order_id: orderId,
    //     order_amount: parsedAmount,
    //     order_currency: 'INR',
    //     customer_details: {
    //         customer_id: req.user.id,
    //         customer_email: req.user.email,
    //         customer_phone: '9999999999',  // TODO: Add phone to users table
    //     },
    //     order_meta: {
    //         return_url: `${process.env.APP_URL}/wallet?order_id={order_id}`,
    //         notify_url: `${process.env.APP_URL}/api/payments/cashfree-webhook`,
    //     },
    // }, {
    //     headers: {
    //         'x-client-id': CASHFREE_APP_ID,
    //         'x-client-secret': CASHFREE_SECRET_KEY,
    //         'x-api-version': '2023-08-01',
    //         'Content-Type': 'application/json',
    //     }
    // });
    // const { order_id, payment_session_id, order_status } = cfRes.data;
    //
    // await supabase.from('payment_requests').insert([{
    //     user_id: req.user.id,
    //     amount: parsedAmount,
    //     screenshot_url: 'cashfree_auto',
    //     utr_number: order_id,
    //     payment_method: 'cashfree',
    //     cashfree_order_id: order_id,
    //     status: 'pending',
    // }]);
    //
    // return res.json({ order_id, payment_session_id, amount: parsedAmount });
    // ── END TODO ──────────────────────────────────────────────────────────────

    if (!isCashfreeReady()) {
        return res.status(503).json({
            error: 'Cashfree payment gateway is not yet configured. Please use UPI manual payment.',
            fallback: 'upi_manual',
        });
    }

    // Stub response (will never be reached until credentials are added)
    res.json({
        order_id: `STUB_ORDER_${Date.now()}`,
        payment_session_id: 'stub_session_id',
        amount: parsedAmount,
        message: 'Stub order created. Replace with live Cashfree integration.',
    });
}));

// POST /api/payments/verify-order
// Called by frontend after user returns from Cashfree checkout.
// Verifies the order status and credits points if payment is successful.
router.post('/verify-order', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { order_id } = req.body;

    if (!order_id || !order_id.trim()) {
        return res.status(400).json({ error: 'order_id is required.' });
    }

    // ── TODO: Replace stub block below with live Cashfree verification ────────
    // When credentials are ready:
    //
    // const axios = require('axios');
    // const cfRes = await axios.get(`${CASHFREE_BASE_URL}/orders/${order_id}`, {
    //     headers: {
    //         'x-client-id': CASHFREE_APP_ID,
    //         'x-client-secret': CASHFREE_SECRET_KEY,
    //         'x-api-version': '2023-08-01',
    //     }
    // });
    // const { order_status, order_amount, cf_payment_id } = cfRes.data;
    //
    // if (order_status !== 'PAID') {
    //     return res.json({ success: false, status: order_status });
    // }
    //
    // // Idempotency: check if already credited
    // const { data: existing } = await supabase
    //     .from('payment_requests')
    //     .select('id, status')
    //     .eq('cashfree_order_id', order_id)
    //     .maybeSingle();
    //
    // if (existing?.status === 'approved') {
    //     return res.json({ success: true, already_credited: true });
    // }
    //
    // // Credit points atomically
    // await supabase.rpc('credit_points', { uid: req.user.id, delta: order_amount });
    // await supabase.from('transactions').insert([{
    //     user_id: req.user.id,
    //     type: 'topup',
    //     amount: order_amount,
    //     description: `Cashfree Top-Up: ₹${order_amount} | Order: ${order_id}`,
    // }]);
    // await supabase.from('payment_requests')
    //     .update({ status: 'approved', cashfree_payment_id: cf_payment_id })
    //     .eq('cashfree_order_id', order_id);
    //
    // return res.json({ success: true, amount: order_amount, cf_payment_id });
    // ── END TODO ──────────────────────────────────────────────────────────────

    if (!isCashfreeReady()) {
        return res.status(503).json({
            error: 'Cashfree payment gateway is not yet configured.',
            fallback: 'upi_manual',
        });
    }

    res.json({ success: false, status: 'STUB_NOT_IMPLEMENTED', message: 'Stub verify. Wire Cashfree credentials to activate.' });
}));

// POST /api/payments/cashfree-webhook
// Cashfree server-to-server webhook. Called automatically by Cashfree when payment succeeds.
// This is the most reliable way to credit points — even if user closes app before verify-order.
// Webhook URL to register in Cashfree dashboard:
//   https://your-production-domain.com/api/payments/cashfree-webhook
router.post('/cashfree-webhook', express.json({ type: '*/*' }), asyncHandler(async (req, res) => {
    // ── TODO: Verify webhook signature ───────────────────────────────────────
    // When credentials are ready:
    //
    // const crypto = require('crypto');
    // const rawBody = JSON.stringify(req.body);
    // const timestamp = req.headers['x-webhook-timestamp'];
    // const signature = req.headers['x-webhook-signature'];
    //
    // const expectedSig = crypto
    //     .createHmac('sha256', CASHFREE_SECRET_KEY)
    //     .update(timestamp + rawBody)
    //     .digest('base64');
    //
    // if (signature !== expectedSig) {
    //     return res.status(401).json({ error: 'Invalid webhook signature.' });
    // }
    //
    // const { type, data } = req.body;
    //
    // if (type === 'PAYMENT_SUCCESS_WEBHOOK') {
    //     const { order, payment } = data;
    //     const order_id = order.order_id;
    //     const amount = Math.round(order.order_amount);
    //     const cf_payment_id = payment.cf_payment_id;
    //
    //     // Idempotency check
    //     const { data: existing } = await supabase
    //         .from('payment_requests')
    //         .select('id, status, user_id')
    //         .eq('cashfree_order_id', order_id)
    //         .maybeSingle();
    //
    //     if (!existing || existing.status === 'approved') {
    //         return res.json({ received: true, skipped: true });
    //     }
    //
    //     // Credit points atomically
    //     await supabase.rpc('credit_points', { uid: existing.user_id, delta: amount });
    //     await supabase.from('transactions').insert([{
    //         user_id: existing.user_id,
    //         type: 'topup',
    //         amount,
    //         description: `Cashfree Top-Up: ₹${amount} | Order: ${order_id} | CF: ${cf_payment_id}`,
    //     }]);
    //     await supabase.from('payment_requests')
    //         .update({ status: 'approved', cashfree_payment_id: cf_payment_id })
    //         .eq('cashfree_order_id', order_id);
    //
    //     await supabase.from('logs').insert([{
    //         user_id: existing.user_id,
    //         action: `Cashfree Webhook: ₹${amount} credited | Order: ${order_id}`,
    //     }]);
    // }
    // ── END TODO ──────────────────────────────────────────────────────────────

    // Always return 200 to Cashfree so it doesn't retry unnecessarily
    res.status(200).json({ received: true, stub: true });
}));


// ─────────────────────────────────────────────────────────────────────────────
//  UPI MANUAL ROUTES (Keep as-is — fallback / legacy flow)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/payments/my-pending
// Returns count of the authenticated user's pending payment requests.
// Used by WalletScreen to show the PendingPaymentBanner.
router.get('/my-pending', authMiddleware, asyncHandler(async (req, res) => {
    const { count, error } = await supabase
        .from('payment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
        .eq('status', 'pending');
    if (error) throw error;
    res.json({ count: count || 0 });
}));

// POST /api/payments/verify-utr
// Pre-flight duplicate-UTR check so the client can warn before submit.
router.post('/verify-utr', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { utr_number } = req.body;
    if (!utr_number || !utr_number.trim()) {
        return res.status(400).json({ error: 'UTR number is required.' });
    }
    const cleanUtr = utr_number.trim().toUpperCase();
    const { data: existing, error } = await supabase
        .from('payment_requests')
        .select('id, status')
        .eq('utr_number', cleanUtr)
        .in('status', ['pending', 'approved'])
        .maybeSingle();
    if (error) throw error;
    res.json({
        valid: !existing,
        duplicate: !!existing,
        status: existing && existing.status || null,
    });
}));

// --- SMS Parsing Helpers ---
const UTR_PATTERNS = [
    /(?:UPI\s*Ref(?:erence)?\s*(?:No\.?|ID|#|:)?\s*)[:\s]?(\d{10,20})/i,
    /(?:Ref(?:erence)?\s*(?:No\.?|ID|#|:)?)\s*[:\s]?(\d{10,20})/i,
    /(?:Transaction\s*(?:ID|Ref)\s*[:\s]?)(\d{10,20})/i,
    /(?:UTR\s*[:\s]?)([A-Z0-9]{10,22})/i,
    /(\d{12})/,
];
const AMOUNT_PATTERNS = [
    /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:INR|Rs\.?|₹)/i,
    /debited\s+(?:INR|Rs\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];
const BANK_DEBIT_KEYWORDS = [
    'debited', 'debit', 'paid', 'transferred', 'sent',
    'upi', 'bhim', 'phonepe', 'gpay', 'paytm',
];

function extractSmsData(body) {
    if (!body) return null;
    const lower = body.toLowerCase();
    if (!BANK_DEBIT_KEYWORDS.some(kw => lower.includes(kw))) return null;

    let utr = null;
    for (const pat of UTR_PATTERNS) {
        const m = body.match(pat);
        if (m && m[1] && m[1].length >= 10) {
            utr = m[1].trim().toUpperCase();
            break;
        }
    }

    let amt = null;
    for (const pat of AMOUNT_PATTERNS) {
        const m = body.match(pat);
        if (m && m[1]) {
            amt = Number(m[1].replace(/,/g, ''));
            break;
        }
    }
    return { utr, amount: amt };
}

// POST /api/payments/manual
// Submit a UPI manual payment proof. UTR AND screenshot are both required.
// Duplicate-UTR check runs again here (the verify-utr call is advisory).
router.post('/manual', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { screenshot, amount, utr_number, sms_raw, sms_timestamp_ms } = req.body;
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount < 50) {
        return res.status(400).json({ error: 'Minimum payment is ₹50 (must be a whole number).' });
    }
    if (parsedAmount > 100000) {
        return res.status(400).json({ error: 'Maximum payment is ₹100,000.' });
    }
    if (!utr_number || !utr_number.trim()) {
        return res.status(400).json({ error: 'UTR / Transaction ID is required.' });
    }
    if (!screenshot || !screenshot.trim()) {
        return res.status(400).json({ error: 'Payment screenshot / receipt is required. Please upload proof of payment.' });
    }

    const cleanUtr = utr_number.trim().toUpperCase();

    const { data: existingPay, error: searchErr } = await supabase
        .from('payment_requests')
        .select('id')
        .eq('utr_number', cleanUtr)
        .in('status', ['pending', 'approved'])
        .maybeSingle();
    if (searchErr) throw searchErr;
    if (existingPay) {
        return res.status(400).json({ error: 'This UTR / Transaction ID has already been submitted.' });
    }

    // ── Auto-credit validation ─────────────────────────────────────────────
    let status = 'pending';
    let auto_credited = false;

    if (sms_raw) {
        const extracted = extractSmsData(sms_raw);
        if (extracted && extracted.utr === cleanUtr && extracted.amount === parsedAmount) {
            status = 'approved';
            auto_credited = true;
        }
    }

    const { error } = await supabase.from('payment_requests').insert([{
        user_id: req.user.id,
        amount: parsedAmount,
        screenshot_url: screenshot || null,
        utr_number: cleanUtr,
        payment_method: auto_credited ? 'upi_auto_sms' : 'upi_manual',
        status: status,
    }]);
    if (error) throw error;

    if (auto_credited) {
        // Credit points atomically
        await supabase.rpc('credit_points', { uid: req.user.id, delta: parsedAmount });
        await supabase.from('transactions').insert([{
            user_id: req.user.id,
            type: 'topup',
            amount: parsedAmount,
            description: `UPI Auto-Credit: ₹${parsedAmount} | UTR: ${cleanUtr}`,
        }]);
    }

    await supabase.from('logs').insert([{
        user_id: req.user.id,
        action: `UPI Payment ${auto_credited ? 'Auto-Credited' : 'Submitted'}: ₹${parsedAmount} | UTR: ${cleanUtr}`,
        ip_address: req.ip,
        metadata: { utr: cleanUtr, amount: parsedAmount, sms_timestamp_ms, sms_raw },
    }]);

    const msg = auto_credited
        ? 'Payment verified automatically! BUG\'s have been added to your wallet. 🎉'
        : 'Proof uploaded! Admin will verify and credit your coins shortly.';
    res.json({ message: msg, auto_credited });
}));


// ─────────────────────────────────────────────────────────────────────────────
//  AUTO-VERIFY ENDPOINT (Fast-Track: SMS-detected payments → instant credit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/auto-verify
 *
 * Called automatically when the mobile app detects a matching bank SMS after
 * the user returns from a UPI payment app. This is the "fast-track" flow:
 *  - Validates UTR uniqueness, amount bounds, and SMS recency (≤10 min)
 *  - Instantly credits BUG's via credit_points RPC (no admin review needed)
 *  - Logs the event; suspicious patterns are flagged for audit
 *
 * Body: { utr_number, amount, bank_name, sms_timestamp_ms, sms_raw }
 */
router.post('/auto-verify', apiLimiter, authMiddleware, asyncHandler(async (req, res) => {
    const { utr_number, amount, bank_name, sms_timestamp_ms, sms_raw } = req.body;

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!utr_number || !utr_number.trim()) {
        return res.status(400).json({ error: 'UTR number is required.' });
    }
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || !Number.isInteger(parsedAmount) || parsedAmount < 50) {
        return res.status(400).json({ error: 'Minimum payment is ₹50.' });
    }
    if (parsedAmount > 100000) {
        return res.status(400).json({ error: 'Maximum payment is ₹1,00,000.' });
    }

    const cleanUtr = utr_number.trim().toUpperCase();

    // ── Duplicate UTR check ───────────────────────────────────────────────────
    const { data: existingPay, error: searchErr } = await supabase
        .from('payment_requests')
        .select('id, status')
        .eq('utr_number', cleanUtr)
        .in('status', ['pending', 'approved'])
        .maybeSingle();
    if (searchErr) throw searchErr;
    if (existingPay) {
        await supabase.from('logs').insert([{
            user_id: req.user.id,
            action: `AUTO_VERIFY_DUPLICATE_UTR: ${cleanUtr} | Amount: ${parsedAmount}`,
            ip_address: req.ip,
            metadata: { utr: cleanUtr, amount: parsedAmount, duplicate_of: existingPay.id },
        }]);
        return res.status(400).json({ error: 'This UTR has already been submitted. Contact support if this is a mistake.' });
    }

    // ── SECURITY: Always set to pending — admin must approve.
    // Client-supplied UTR/amount/SMS timestamp cannot be trusted as proof
    // of a real payment. Instant credit based on client attestation only
    // would allow any authenticated user to credit themselves arbitrary amounts.
    // The SMS-detection UX still works; credit happens via admin approval.
    const { error: insertErr } = await supabase
        .from('payment_requests')
        .insert([{
            user_id: req.user.id,
            amount: parsedAmount,
            utr_number: cleanUtr,
            screenshot_url: null,
            payment_method: 'upi_auto_sms',
            status: 'pending',
        }]);
    if (insertErr) throw insertErr;

    // ── Log for admin audit ───────────────────────────────────────────────────
    const smsAgeMin = sms_timestamp_ms ? Math.round((Date.now() - Number(sms_timestamp_ms)) / 60000) : null;
    await supabase.from('logs').insert([{
        user_id: req.user.id,
        action: `AUTO_VERIFY_PENDING: UTR ${cleanUtr} | Amount: ₹${parsedAmount} | Bank: ${bank_name || '?'}${smsAgeMin !== null ? ` | SMS age: ${smsAgeMin}min` : ''}`,
        ip_address: req.ip,
        metadata: { utr: cleanUtr, amount: parsedAmount, bank_name, sms_timestamp_ms, sms_raw },
    }]);

    return res.status(202).json({
        message: 'Payment recorded! Admin will verify your UTR and credit your BUG\'s shortly (usually within a few hours).',
        auto_approved: false,
        pending: true,
    });
}));

// GET /api/payments/upi-config
// Returns active UPI handles and payee name. Dynamically updated by admin.
router.get('/upi-config', asyncHandler(async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'upi_config')
            .maybeSingle();

        if (error || !data || !data.value) {
            return res.json({
                name: 'SubMe Admin',
                handles: ['theonlyvip786@okaxis']
            });
        }

        res.json({
            name: data.value.name || 'SubMe Admin',
            handles: Array.isArray(data.value.handles) && data.value.handles.length > 0
                ? data.value.handles
                : ['theonlyvip786@okaxis']
        });
    } catch (_) {
        res.json({
            name: 'SubMe Admin',
            handles: ['theonlyvip786@okaxis']
        });
    }
}));

module.exports = router;
