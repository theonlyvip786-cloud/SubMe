-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE (profile table — auth handled by Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- Matches auth.users.id (no default — set by trigger)
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    points INT DEFAULT 0,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TASKS TABLE
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    video_url TEXT NOT NULL,
    channel_url TEXT,
    reward_points INT NOT NULL,
    is_vip BOOLEAN DEFAULT FALSE,
    required_watch_time INT NOT NULL, -- in seconds
    mcq_question TEXT NOT NULL,
    mcq_options JSONB NOT NULL,
    mcq_answer TEXT NOT NULL,
    platform TEXT DEFAULT 'youtube' CHECK (platform IN ('youtube', 'instagram')),
    thumbnail_id TEXT DEFAULT NULL, -- Optional: bundled thumbnail asset ID
    creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- User who promoted this task
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SUBMISSIONS TABLE
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    screenshot_url TEXT,               -- Nullable: SMS-verified or no-screenshot flows
    image_hash TEXT,                   -- For duplicate detection (SHA-256)
    mcq_answer TEXT,                   -- User's submitted MCQ answer for verification
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

-- PROMOTIONS TABLE (with MCQ for anti-cheat)
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    video_url TEXT NOT NULL,
    channel_url TEXT,
    mcq_question TEXT,
    mcq_options JSONB,   -- e.g. ["Word A", "Word B", "Word C", "Word D"]
    mcq_answer TEXT,     -- correct option text
    is_vip BOOLEAN DEFAULT FALSE,
    platform TEXT DEFAULT 'youtube' CHECK (platform IN ('youtube', 'instagram')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    thumbnail_id TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRANSACTIONS TABLE (point ledger)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'topup', 'refund', 'reward')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TASK SESSIONS TABLE (server-side timer tracking for anti-cheat)
CREATE TABLE IF NOT EXISTS task_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    UNIQUE(user_id, task_id)
);

-- LOGS TABLE (cheat detection, IP tracking, abuse)
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    ip_address TEXT,
    device_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fix column names if table was created with old schema
DO $$ BEGIN
    ALTER TABLE logs RENAME COLUMN event TO action;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE logs RENAME COLUMN details TO ip_address;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- PAYMENT REQUESTS TABLE (manual payment proof uploads)
CREATE TABLE IF NOT EXISTS payment_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL CHECK (amount >= 50),
    screenshot_url TEXT,
    utr_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    payment_method TEXT DEFAULT 'upi_manual' CHECK (payment_method IN ('upi_manual', 'upi_auto_sms', 'cashfree')),
    cashfree_order_id TEXT,            -- Cashfree order ID for automated payments
    cashfree_payment_id TEXT,          -- Cashfree payment ID after successful capture
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DEVICE LINKS TABLE (anti-cheat: detect multi-account on same device)
CREATE TABLE IF NOT EXISTS device_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REFERRALS TABLE (track referral relationships and reward status)
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reward_earned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES for common query patterns
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_id ON submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_image_hash ON submissions(image_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_task_sessions_user_task ON task_sessions(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_sessions_status ON task_sessions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_user_id ON promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_device_links_device ON device_links(device_id);
CREATE INDEX IF NOT EXISTS idx_device_links_user_id ON device_links(user_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status         ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_points         ON users(points);
CREATE INDEX IF NOT EXISTS idx_tasks_active_created ON tasks(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_is_vip         ON tasks(is_vip);
CREATE INDEX IF NOT EXISTS idx_submissions_created  ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_created   ON promotions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_utr ON payment_requests(utr_number);
CREATE INDEX IF NOT EXISTS idx_logs_created         ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action          ON logs(action);

-- Partial indexes for the common admin-queue query
-- (status = 'pending' ORDER BY created_at).
CREATE INDEX IF NOT EXISTS idx_submissions_pending_created
    ON submissions(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_promotions_pending_created
    ON promotions(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_requests_pending_created
    ON payment_requests(created_at) WHERE status = 'pending';

-- ══════════════════════════════════════════════════════════════
-- MIGRATION: Add thumbnail_id to tasks and promotions
-- Run this in Supabase SQL editor if tables already exist.
-- ══════════════════════════════════════════════════════════════
DO $$ BEGIN
    ALTER TABLE tasks ADD COLUMN thumbnail_id TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE promotions ADD COLUMN thumbnail_id TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Integrity: economy invariants enforced at the DB layer.

ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_points_nonnegative
    CHECK (points >= 0);
ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_amount_range;
ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_amount_range
    CHECK (amount >= 50 AND amount <= 100000);

-- A referred user can be rewarded at most once (belt-and-braces on the RPC).
CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_rewarded_once
    ON referrals (referred_user_id)
    WHERE reward_earned = TRUE;

-- Atomic points mutation primitive — prevents race conditions on concurrent
-- updates. The application calls this via supabase.rpc('credit_points', ...).
CREATE OR REPLACE FUNCTION credit_points(user_uuid UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE users SET points = points + amount WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Total currency in circulation, computed at the DB layer.
CREATE OR REPLACE FUNCTION sum_points()
RETURNS JSONB AS $$
DECLARE v_total BIGINT;
BEGIN
    SELECT COALESCE(SUM(points), 0) INTO v_total FROM users;
    RETURN jsonb_build_object('total', v_total);
END;
$$ LANGUAGE plpgsql;

-- Atomic conditional spend — deducts ONLY if balance stays >= 0.
-- Returns TRUE on success, FALSE on insufficient funds.
-- This closes the check-then-deduct race in the promotion flow.
CREATE OR REPLACE FUNCTION spend_points(user_uuid UUID, amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    rows_affected INTEGER;
BEGIN
    IF amount IS NULL OR amount <= 0 THEN
        RETURN FALSE;
    END IF;
    UPDATE users
       SET points = points - amount
     WHERE id = user_uuid
       AND points >= amount;
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    RETURN rows_affected = 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FULL ATOMIC WORKFLOWS
-- Each of these runs entirely inside a single Postgres transaction,
-- so the users row, the immutable ledger row, and the status flip
-- either ALL commit or ALL roll back. No partial failures.
--
-- Referral bounty is 5 points (AGENTS.md rule #7: "Referral reward is 5 BUG's").
-- ============================================================

-- Approve a submission: credit worker (+ optional 2x VIP) + flip status
-- + append ledger + pay referrer bonus on first approval. Race-safe.
CREATE OR REPLACE FUNCTION approve_submission(sub_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_sub            RECORD;
    v_task           RECORD;
    v_user           RECORD;
    v_referral       RECORD;
    v_reward         INTEGER;
    v_referrer_bonus INTEGER := 5;
    v_paid_referrer  BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_sub FROM submissions WHERE id = sub_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
    IF v_sub.status = 'approved' THEN RAISE EXCEPTION 'Submission already approved'; END IF;
    IF v_sub.status = 'rejected' THEN RAISE EXCEPTION 'Cannot approve a rejected submission'; END IF;

    SELECT reward_points, title, is_vip INTO v_task FROM tasks WHERE id = v_sub.task_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task for submission not found'; END IF;

    SELECT id, username, referred_by INTO v_user FROM users WHERE id = v_sub.user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User for submission not found'; END IF;

    v_reward := COALESCE(v_task.reward_points, 0);
    IF v_task.is_vip THEN v_reward := v_reward * 2; END IF;

    UPDATE users SET points = points + v_reward WHERE id = v_sub.user_id;
    UPDATE submissions SET status = 'approved' WHERE id = sub_id;
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (v_sub.user_id, v_reward, 'reward',
        'Task Approved: ' || COALESCE(v_task.title, 'Video') ||
        CASE WHEN v_task.is_vip THEN ' (VIP 2x)' ELSE '' END);

    -- Referral bounty on first approved submission only (race-safe).
    IF v_user.referred_by IS NOT NULL THEN
        SELECT * INTO v_referral FROM referrals
         WHERE referrer_id = v_user.referred_by AND referred_user_id = v_sub.user_id
         FOR UPDATE;
        IF FOUND AND v_referral.reward_earned = FALSE THEN
            PERFORM 1 FROM submissions
             WHERE user_id = v_sub.user_id AND status = 'approved' AND id <> sub_id LIMIT 1;
            IF NOT FOUND THEN
                UPDATE referrals SET reward_earned = TRUE
                 WHERE referrer_id = v_user.referred_by
                   AND referred_user_id = v_sub.user_id AND reward_earned = FALSE;
                IF FOUND THEN
                    UPDATE users SET points = points + v_referrer_bonus WHERE id = v_user.referred_by;
                    INSERT INTO transactions (user_id, amount, type, description)
                    VALUES (v_user.referred_by, v_referrer_bonus, 'reward',
                        'Referral Bonus: ' || COALESCE(v_user.username, 'Referred user') ||
                        ' completed their first task');
                    v_paid_referrer := TRUE;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object('approved', TRUE, 'reward', v_reward,
        'referrer_bonus', CASE WHEN v_paid_referrer THEN v_referrer_bonus ELSE 0 END,
        'referrer_id', v_user.referred_by);
END;
$$ LANGUAGE plpgsql;

-- Publish a pending promotion as a live task (creator already paid).
-- Stores creator_user_id so creator can later view subscription proofs.
CREATE OR REPLACE FUNCTION approve_promotion(promo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_promo RECORD; v_task_id UUID;
BEGIN
    SELECT * INTO v_promo FROM promotions WHERE id = promo_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Promotion not found'; END IF;
    IF v_promo.status <> 'pending' THEN RAISE EXCEPTION 'Promotion already processed'; END IF;

    INSERT INTO public.tasks (
        title, video_url, channel_url, reward_points, is_vip, platform,
        required_watch_time, mcq_question, mcq_options, mcq_answer,
        is_active, thumbnail_id, creator_user_id
    )
    VALUES (
        v_promo.title,
        v_promo.video_url,
        v_promo.channel_url,
        10,
        COALESCE(v_promo.is_vip, FALSE),
        COALESCE(v_promo.platform, 'youtube'),
        180,
        v_promo.mcq_question,
        v_promo.mcq_options,
        v_promo.mcq_answer,
        TRUE,
        v_promo.thumbnail_id,
        v_promo.user_id
    ) RETURNING id INTO v_task_id;

    UPDATE promotions SET status = 'approved' WHERE id = promo_id;
    RETURN jsonb_build_object('approved', TRUE, 'task_id', v_task_id);
END;
$$ LANGUAGE plpgsql;

-- Reject a promotion: refund the cost (49 or 200) atomically.
CREATE OR REPLACE FUNCTION reject_promotion(promo_id UUID)
RETURNS JSONB AS $$
DECLARE v_promo RECORD; v_refund INTEGER;
BEGIN
    SELECT * INTO v_promo FROM promotions WHERE id = promo_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Promotion not found'; END IF;
    IF v_promo.status <> 'pending' THEN RAISE EXCEPTION 'Promotion already processed'; END IF;

    v_refund := CASE WHEN v_promo.is_vip THEN 200 ELSE 49 END;
    UPDATE users SET points = points + v_refund WHERE id = v_promo.user_id;
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (v_promo.user_id, v_refund, 'refund', 'Promotion Rejected Refund: ' || v_promo.video_url);
    UPDATE promotions SET status = 'rejected' WHERE id = promo_id;
    RETURN jsonb_build_object('rejected', TRUE, 'refunded', v_refund);
END;
$$ LANGUAGE plpgsql;

-- Approve a UPI payment: mint currency into the wallet atomically.
CREATE OR REPLACE FUNCTION approve_payment(payment_id UUID)
RETURNS JSONB AS $$
DECLARE v_pay RECORD;
BEGIN
    SELECT * INTO v_pay FROM payment_requests WHERE id = payment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment request not found'; END IF;
    IF v_pay.status <> 'pending' THEN RAISE EXCEPTION 'Payment already processed'; END IF;

    UPDATE users SET points = points + v_pay.amount WHERE id = v_pay.user_id;
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (v_pay.user_id, v_pay.amount, 'topup',
        'Payment approved: ₹' || v_pay.amount || ' — BUG''s credited');
    UPDATE payment_requests SET status = 'approved' WHERE id = payment_id;
    RETURN jsonb_build_object('approved', TRUE, 'amount', v_pay.amount);
END;
$$ LANGUAGE plpgsql;

-- Create a promotion request: atomic conditional spend + promotion row
-- + ledger entry. Promotion starts 'pending' (admin approves to go live).
CREATE OR REPLACE FUNCTION create_promotion(
    p_user_id UUID, p_title TEXT, p_video_url TEXT, p_channel_url TEXT,
    p_mcq_question TEXT, p_mcq_options JSONB, p_mcq_answer TEXT,
    p_is_vip BOOLEAN, p_platform TEXT, p_thumbnail_id TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_cost INTEGER := CASE WHEN p_is_vip THEN 200 ELSE 49 END;
    v_platform TEXT := CASE WHEN p_platform = 'instagram' THEN 'instagram' ELSE 'youtube' END;
    v_promo_id UUID; v_spent_ok BOOLEAN;
BEGIN
    IF p_title IS NULL OR TRIM(p_title) = '' THEN RAISE EXCEPTION 'Title is required'; END IF;
    IF p_video_url IS NULL OR TRIM(p_video_url) = '' THEN RAISE EXCEPTION 'Video URL is required'; END IF;
    IF p_mcq_question IS NULL OR TRIM(p_mcq_question) = '' THEN RAISE EXCEPTION 'MCQ question is required'; END IF;
    IF p_mcq_options IS NULL THEN RAISE EXCEPTION 'MCQ options are required'; END IF;
    IF p_mcq_answer IS NULL OR TRIM(p_mcq_answer) = '' THEN RAISE EXCEPTION 'MCQ answer is required'; END IF;

    SELECT spend_points(p_user_id, v_cost) INTO v_spent_ok;
    IF v_spent_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'Insufficient balance. You need % points.', v_cost;
    END IF;

    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (p_user_id, -v_cost, 'spend',
        CASE WHEN p_is_vip THEN 'VIP ' ELSE '' END || 'Channel Promotion Request: ' || p_video_url);

    INSERT INTO promotions (user_id, title, video_url, channel_url, mcq_question, mcq_options,
        mcq_answer, is_vip, platform, status, thumbnail_id)
    VALUES (p_user_id, p_title, p_video_url, p_channel_url, p_mcq_question, p_mcq_options,
        p_mcq_answer, p_is_vip, v_platform, 'pending', p_thumbnail_id)
    RETURNING id INTO v_promo_id;

    RETURN jsonb_build_object('created', TRUE, 'promotion_id', v_promo_id, 'cost', v_cost);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SUPABASE AUTH: Trigger function + RLS
-- ============================================================

-- Trigger function: auto-creates user profile on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
    v_referral_input TEXT;
    v_referrer_id UUID;
    v_referral_code TEXT;
BEGIN
    v_username := NEW.raw_user_meta_data->>'username';
    v_referral_input := NEW.raw_user_meta_data->>'referral_code_input';
    v_referral_code := UPPER(REPLACE(NEW.id::TEXT, '-', ''));

    IF v_referral_input IS NOT NULL AND v_referral_input != '' THEN
        SELECT id INTO v_referrer_id
        FROM public.users
        WHERE referral_code = UPPER(TRIM(v_referral_input))
        LIMIT 1;
    END IF;

    INSERT INTO public.users (id, email, username, referral_code, referred_by, points, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(v_username, SPLIT_PART(NEW.email, '@', 1)),
        v_referral_code,
        v_referrer_id,
        0,
        'active'
    )
    ON CONFLICT (id) DO NOTHING;

    IF v_referrer_id IS NOT NULL THEN
        INSERT INTO public.referrals (referrer_id, referred_user_id, reward_earned)
        VALUES (v_referrer_id, NEW.id, FALSE)
        ON CONFLICT (referred_user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger: fires after new auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW-LEVEL SECURITY — Enabled on ALL tables
-- ============================================================
-- NOTE: Backend uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- These policies only restrict direct client-side (anon key) access.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_links ENABLE ROW LEVEL SECURITY;

-- ── Users ────────────────────────────────────────────────────
-- Users can READ their own profile only.
-- NO UPDATE policy — all profile mutations go through backend (service_role).
-- This prevents users from changing their own points/status via Supabase client.
CREATE POLICY "Users can read own profile"
    ON public.users FOR SELECT TO authenticated USING (id = auth.uid());

-- ── Tasks ────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read active tasks"
    ON public.tasks FOR SELECT TO authenticated USING (is_active = true);

-- ── Submissions ──────────────────────────────────────────────
CREATE POLICY "Users can insert own submissions"
    ON public.submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can read own submissions"
    ON public.submissions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── Transactions ─────────────────────────────────────────────
CREATE POLICY "Users can read own transactions"
    ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── Task Sessions ────────────────────────────────────────────
CREATE POLICY "Users can read own task sessions"
    ON public.task_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── Promotions ───────────────────────────────────────────────
CREATE POLICY "Users can read own promotions"
    ON public.promotions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own promotions"
    ON public.promotions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ── Payment Requests ─────────────────────────────────────────
CREATE POLICY "Users can read own payment requests"
    ON public.payment_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own payment requests"
    ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ── Referrals ────────────────────────────────────────────────
CREATE POLICY "Users can read own referrals"
    ON public.referrals FOR SELECT TO authenticated
    USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

-- ── Logs ─────────────────────────────────────────────────────
-- No client-side access at all — only backend (service_role) writes/reads logs.

-- ── Device Links ─────────────────────────────────────────────
-- No client-side access — only backend (service_role) manages device links.

-- ============================================================
-- SUBSCRIPTION PROOFS TABLE
-- Stores screenshot proofs of YouTube subscriptions.
-- Only visible to the task's creator (peer-to-peer, no admin involvement).
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    submitter_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    screenshot_url TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_proofs_task ON subscription_proofs(task_id);
CREATE INDEX IF NOT EXISTS idx_subscription_proofs_submitter ON subscription_proofs(submitter_user_id);

-- ── Subscription Proofs RLS ───────────────────────────────────
ALTER TABLE public.subscription_proofs ENABLE ROW LEVEL SECURITY;

-- Task creator can view proofs for their tasks
CREATE POLICY "Task creator can view subscription proofs"
    ON public.subscription_proofs FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = subscription_proofs.task_id
            AND tasks.creator_user_id = auth.uid()
        )
    );

-- Submitter can insert their own proof
CREATE POLICY "Submitter can insert own proof"
    ON public.subscription_proofs FOR INSERT TO authenticated
    WITH CHECK (submitter_user_id = auth.uid());

-- ── MIGRATION: Add creator_user_id to existing tasks table ───
DO $$ BEGIN
    ALTER TABLE tasks ADD COLUMN creator_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── MIGRATION: Add payment_method to existing payment_requests table ───
DO $$ BEGIN
    ALTER TABLE payment_requests ADD COLUMN payment_method TEXT DEFAULT 'upi_manual'
        CHECK (payment_method IN ('upi_manual', 'upi_auto_sms', 'cashfree'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── MIGRATION: Widen payment_method constraint if already exists (idempotent) ───
DO $$ BEGIN
    ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_payment_method_check;
    ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_payment_method_check
        CHECK (payment_method IN ('upi_manual', 'upi_auto_sms', 'cashfree'));
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ── MIGRATION: Add Cashfree columns to payment_requests ───
DO $$ BEGIN
    ALTER TABLE payment_requests ADD COLUMN cashfree_order_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE payment_requests ADD COLUMN cashfree_payment_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── MIGRATION: Add mcq_answer to submissions (stores user's MCQ answer) ───
DO $$ BEGIN
    ALTER TABLE submissions ADD COLUMN mcq_answer TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── MIGRATION: Make screenshot_url nullable in submissions ───
DO $$ BEGIN
    ALTER TABLE submissions ALTER COLUMN screenshot_url DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- ── SYSTEM SETTINGS TABLE (Dynamic app configurations e.g. UPI handles) ───
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default UPI config if not present
INSERT INTO system_settings (key, value)
VALUES ('upi_config', '{"name": "SubMe Admin", "handles": ["theonlyvip786@okaxis"]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

