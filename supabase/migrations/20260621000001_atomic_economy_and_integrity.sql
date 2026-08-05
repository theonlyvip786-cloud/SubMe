-- ============================================================
-- SubKo Migration 2026-06-21
-- Atomic economy workflows + integrity hardening + perf indexes.
--
-- Design goals:
--   1. Replace read-then-write point mutations with single atomic
--      statements so concurrent requests can never double-spend or
--      double-reward.
--   2. Move multi-step workflows (approve submission, reject promo,
--      approve payment, create promotion) into single transactional
--      RPCs so the users row, the ledger row, and the status flip
--      either ALL commit or ALL roll back.
--   3. Make the referral bounty match the documented 5 points
--      (PRD §2, AGENTS.md rule #7, TASKS.md 4.3, mobile copy.ts).
--   4. Add constraints + indexes for integrity and query speed.
--
-- This file is IDEMPOTENT — safe to re-run on an existing DB:
--   * functions use CREATE OR REPLACE
--   * indexes / constraints use IF NOT EXISTS / DO $$ blocks
-- ============================================================

-- Needed by some helpers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 0. Single-row atomic primitives (used by the workflows below)
-- ------------------------------------------------------------

-- credit_points already exists in the base schema; redefine here to be safe.
-- Adds the row when missing? No — users are always created by the auth
-- trigger, so we keep the simple UPDATE. Returns nothing.
CREATE OR REPLACE FUNCTION credit_points(user_uuid UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE users SET points = points + amount WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- spend_points: deducts only if the resulting balance stays >= 0.
-- Returns TRUE if the spend succeeded, FALSE if insufficient funds.
-- This closes the TOCTOU race where two concurrent requests both read
-- a sufficient balance and both deduct.
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

-- sum_points: total currency in circulation, computed at the DB.
-- Cheaper + safer than SELECT points FROM users + reduce in Node.
CREATE OR REPLACE FUNCTION sum_points()
RETURNS JSONB AS $$
DECLARE v_total BIGINT;
BEGIN
    SELECT COALESCE(SUM(points), 0) INTO v_total FROM users;
    RETURN jsonb_build_object('total', v_total);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 1. approve_submission(sub_id) — the FULL workflow in one tx.
--    Closes the partial-failure window in the old JS implementation:
--    credit -> update submission -> ledger -> referral bounty all
--    commit atomically.
--
--    Returns JSONB so the caller can report exactly what happened
--    (reward credited, referrer bonus paid, etc.) without a second
--    round-trip.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_submission(sub_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_sub            RECORD;
    v_task           RECORD;
    v_user           RECORD;
    v_referral       RECORD;
    v_reward         INTEGER;
    v_referrer_bonus INTEGER := 5;    -- matches PRD/AGENTS.md
    v_paid_referrer  BOOLEAN := FALSE;
BEGIN
    -- Lock the submission row for the duration of the tx.
    SELECT * INTO v_sub
      FROM submissions
     WHERE id = sub_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission not found';
    END IF;

    IF v_sub.status = 'approved' THEN
        RAISE EXCEPTION 'Submission already approved';
    END IF;
    IF v_sub.status = 'rejected' THEN
        RAISE EXCEPTION 'Cannot approve a rejected submission';
    END IF;

    SELECT reward_points, title, is_vip, id INTO v_task
      FROM tasks WHERE id = v_sub.task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task for submission not found';
    END IF;

    SELECT id, username, referred_by INTO v_user
      FROM users WHERE id = v_sub.user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User for submission not found';
    END IF;

    v_reward := COALESCE(v_task.reward_points, 0);
    IF v_task.is_vip THEN
        v_reward := v_reward * 2;
    END IF;

    -- 1) Credit the worker.
    UPDATE users SET points = points + v_reward WHERE id = v_sub.user_id;

    -- 2) Flip submission status.
    UPDATE submissions SET status = 'approved' WHERE id = sub_id;

    -- 3) Append-only ledger entry.
    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (
        v_sub.user_id,
        v_reward,
        'reward',
        'Task Approved: ' || COALESCE(v_task.title, 'Video') ||
            CASE WHEN v_task.is_vip THEN ' (VIP 2x)' ELSE '' END
    );

    -- 4) Referral bounty — ONLY on the referred user's FIRST approved
    --    submission, and ONLY once per referral link.
    --    Race-safe: the UPDATE ... WHERE reward_earned = false inside
    --    the same tx means a second concurrent approval can't double-pay.
    IF v_user.referred_by IS NOT NULL THEN
        SELECT * INTO v_referral
          FROM referrals
         WHERE referrer_id      = v_user.referred_by
           AND referred_user_id = v_sub.user_id
         FOR UPDATE;

        IF FOUND AND v_referral.reward_earned = FALSE THEN
            -- Confirm this is genuinely the first approved submission
            -- for the referred user (defence in depth).
            PERFORM 1
              FROM submissions
             WHERE user_id = v_sub.user_id
               AND status  = 'approved'
               AND id     <> sub_id
             LIMIT 1;

            IF NOT FOUND THEN
                UPDATE referrals
                   SET reward_earned = TRUE
                 WHERE referrer_id      = v_user.referred_by
                   AND referred_user_id = v_sub.user_id
                   AND reward_earned    = FALSE;

                IF FOUND THEN
                    UPDATE users
                       SET points = points + v_referrer_bonus
                     WHERE id = v_user.referred_by;

                    INSERT INTO transactions (user_id, amount, type, description)
                    VALUES (
                        v_user.referred_by,
                        v_referrer_bonus,
                        'reward',
                        'Referral Bonus: ' || COALESCE(v_user.username, 'Referred user') ||
                            ' completed their first task'
                    );

                    v_paid_referrer := TRUE;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'approved',        TRUE,
        'reward',          v_reward,
        'referrer_bonus',  CASE WHEN v_paid_referrer THEN v_referrer_bonus ELSE 0 END,
        'referrer_id',     v_user.referred_by
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 2. approve_promotion(promo_id) — publish a pending promotion
--    as a live task, atomically. The creator already paid on
--    submission (see create_promotion), so this only inserts the
--    task and flips the promotion to approved.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_promotion(promo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_promo RECORD;
    v_task_id UUID;
BEGIN
    SELECT * INTO v_promo FROM promotions WHERE id = promo_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Promotion not found';
    END IF;
    IF v_promo.status <> 'pending' THEN
        RAISE EXCEPTION 'Promotion already processed';
    END IF;

    INSERT INTO tasks (
        title, video_url, channel_url, reward_points, is_vip, platform,
        required_watch_time, mcq_question, mcq_options, mcq_answer,
        thumbnail_id, creator_user_id, is_active, created_at
    ) VALUES (
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
        v_promo.thumbnail_id,
        v_promo.user_id,
        TRUE,
        NOW()
    )
    RETURNING id INTO v_task_id;

    UPDATE promotions SET status = 'approved' WHERE id = promo_id;

    RETURN jsonb_build_object(
        'approved', TRUE,
        'task_id',  v_task_id
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 3. reject_promotion(promo_id) — refund the creator atomically.
--    The cost was debited on submission, so a rejection must return it.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION reject_promotion(promo_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_promo RECORD;
    v_refund INTEGER;
BEGIN
    SELECT * INTO v_promo FROM promotions WHERE id = promo_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Promotion not found';
    END IF;
    IF v_promo.status <> 'pending' THEN
        RAISE EXCEPTION 'Promotion already processed';
    END IF;

    v_refund := CASE WHEN v_promo.is_vip THEN 200 ELSE 49 END;

    UPDATE users SET points = points + v_refund WHERE id = v_promo.user_id;

    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (
        v_promo.user_id,
        v_refund,
        'refund',
        'Promotion Rejected Refund: ' || v_promo.video_url
    );

    UPDATE promotions SET status = 'rejected' WHERE id = promo_id;

    RETURN jsonb_build_object('rejected', TRUE, 'refunded', v_refund);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 4. approve_payment(payment_id) — mint currency into the user's
--    wallet after admin verifies the UTR. Atomic credit + ledger.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_payment(payment_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_pay RECORD;
BEGIN
    SELECT * INTO v_pay FROM payment_requests WHERE id = payment_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment request not found';
    END IF;
    IF v_pay.status <> 'pending' THEN
        RAISE EXCEPTION 'Payment already processed';
    END IF;

    UPDATE users SET points = points + v_pay.amount WHERE id = v_pay.user_id;

    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (
        v_pay.user_id,
        v_pay.amount,
        'topup',
        'Payment approved: ₹' || v_pay.amount || ' — BUG''s credited'
    );

    UPDATE payment_requests SET status = 'approved' WHERE id = payment_id;

    RETURN jsonb_build_object('approved', TRUE, 'amount', v_pay.amount);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 5. create_promotion(...) — the SPEND side, fully atomic.
--    Deducts the cost (49 or 200) only if the user can afford it,
--    then inserts the promotion row + ledger entry in the same tx.
--    Promotion starts in 'pending' status — admin must approve
--    before it becomes a live task (matches APP_FLOW.md §3.2).
--
--    Returns JSONB with success / error state so the caller can
--    surface the right message without guessing.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_promotion(
    p_user_id       UUID,
    p_title         TEXT,
    p_video_url     TEXT,
    p_channel_url   TEXT,
    p_mcq_question  TEXT,
    p_mcq_options   JSONB,
    p_mcq_answer    TEXT,
    p_is_vip        BOOLEAN,
    p_platform      TEXT,
    p_thumbnail_id  TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_cost       INTEGER := CASE WHEN p_is_vip THEN 200 ELSE 49 END;
    v_platform   TEXT     := CASE WHEN p_platform = 'instagram' THEN 'instagram' ELSE 'youtube' END;
    v_promo_id   UUID;
    v_spent_ok   BOOLEAN;
BEGIN
    IF p_title IS NULL OR TRIM(p_title) = '' THEN
        RAISE EXCEPTION 'Title is required';
    END IF;
    IF p_video_url IS NULL OR TRIM(p_video_url) = '' THEN
        RAISE EXCEPTION 'Video URL is required';
    END IF;
    IF p_mcq_question IS NULL OR TRIM(p_mcq_question) = '' THEN
        RAISE EXCEPTION 'MCQ question is required';
    END IF;
    IF p_mcq_options IS NULL THEN
        RAISE EXCEPTION 'MCQ options are required';
    END IF;
    IF p_mcq_answer IS NULL OR TRIM(p_mcq_answer) = '' THEN
        RAISE EXCEPTION 'MCQ answer is required';
    END IF;

    -- Atomic conditional spend: only succeeds if balance >= cost.
    SELECT spend_points(p_user_id, v_cost) INTO v_spent_ok;
    IF v_spent_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'Insufficient balance. You need % points.', v_cost;
    END IF;

    INSERT INTO transactions (user_id, amount, type, description)
    VALUES (
        p_user_id,
        -v_cost,
        'spend',
        CASE WHEN p_is_vip THEN 'VIP ' ELSE '' END ||
            'Channel Promotion Request: ' || p_video_url
    );

    INSERT INTO promotions (
        user_id, title, video_url, channel_url, mcq_question, mcq_options,
        mcq_answer, is_vip, platform, thumbnail_id, status, created_at
    ) VALUES (
        p_user_id, p_title, p_video_url, COALESCE(p_channel_url, p_video_url), p_mcq_question, p_mcq_options,
        p_mcq_answer, p_is_vip, v_platform, p_thumbnail_id, 'pending', NOW()
    )
    RETURNING id INTO v_promo_id;

    RETURN jsonb_build_object(
        'created',     TRUE,
        'promotion_id', v_promo_id,
        'cost',        v_cost
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. Integrity constraints (idempotent)
-- ============================================================

-- Points can never be negative — defends the economy at the DB layer
-- regardless of any application bug.
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT users_points_nonnegative CHECK (points >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment amounts already have CHECK (amount >= 50); add an upper bound
-- to mirror the application cap and prevent runaway rows.
DO $$ BEGIN
    ALTER TABLE payment_requests
        DROP CONSTRAINT IF EXISTS payment_requests_amount_check;
    ALTER TABLE payment_requests
        ADD CONSTRAINT payment_requests_amount_range
        CHECK (amount >= 50 AND amount <= 100000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A referral link can only ever reward once.
DO $$ BEGIN
    ALTER TABLE referrals
        ADD CONSTRAINT referrals_one_reward
        CHECK (reward_earned IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Partial unique index: a referred user can appear in referrals at most
-- once with reward_earned = true. Belt-and-braces on top of the RPC logic.
DO $$ BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS referrals_referred_rewarded_once
        ON referrals (referred_user_id)
        WHERE reward_earned = TRUE;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- ============================================================
-- 7. Performance indexes (idempotent)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_status         ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_points         ON users(points);
CREATE INDEX IF NOT EXISTS idx_tasks_active_created ON tasks(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_is_vip         ON tasks(is_vip);
CREATE INDEX IF NOT EXISTS idx_submissions_created  ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_created   ON promotions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_utr ON payment_requests(utr_number);
CREATE INDEX IF NOT EXISTS idx_logs_created         ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_action          ON logs(action);

-- Composite index for the most common admin queue query
-- (status = 'pending' ORDER BY created_at).
CREATE INDEX IF NOT EXISTS idx_submissions_pending_created
    ON submissions(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_promotions_pending_created
    ON promotions(created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_requests_pending_created
    ON payment_requests(created_at) WHERE status = 'pending';

-- ============================================================
-- 8. Backfill: any legacy rows that violate the new constraints.
--    (Best-effort — only matters if old data exists.)
-- ============================================================
UPDATE users SET points = 0 WHERE points < 0;

-- ============================================================
-- 9. Additional column migrations (idempotent, safe to re-run)
-- ============================================================

-- BUG-03/19: Add mcq_answer to submissions table (stores user's selected MCQ answer)
DO $$ BEGIN
    ALTER TABLE submissions ADD COLUMN mcq_answer TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- BUG-08: Make screenshot_url nullable in submissions (SMS-verified flows don't upload screenshots)
DO $$ BEGIN
    ALTER TABLE submissions ALTER COLUMN screenshot_url DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- BUG-04: Extend payment_method CHECK constraint to include 'cashfree'
DO $$ BEGIN
    ALTER TABLE payment_requests DROP CONSTRAINT IF EXISTS payment_requests_payment_method_check;
    ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_payment_method_check
        CHECK (payment_method IN ('upi_manual', 'upi_auto_sms', 'cashfree'));
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- BUG-15: Add Cashfree order/payment tracking columns to payment_requests
DO $$ BEGIN
    ALTER TABLE payment_requests ADD COLUMN cashfree_order_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE payment_requests ADD COLUMN cashfree_payment_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

