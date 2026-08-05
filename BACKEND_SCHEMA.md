# BACKEND SCHEMA & DATA LAYER
**Project:** SubKo — Creator Promotion & Video Feedback Rewards
**Database:** Supabase PostgreSQL
**Last Updated:** 2026-07-18

---

## 1. THE FOUNDATION
The data layer is the absolute source of truth. If it is not in the database, it did not happen. We rely on PostgreSQL's native constraints, default timestamps, and RPC functions to maintain atomic integrity.

### Foreign Key Rule
All tables referencing a user use a `user_id` column of type `UUID` that maps directly to `public.users(id)`, which in turn cascades from `auth.users(id)`.

---

## 2. THE TABLES

### 2.1. `users`
The core identity. Created automatically via trigger when a user signs up via Supabase Auth.
* `id` (UUID, PK) — *Matches `auth.users.id`.*
* `email` (Text, Unique)
* `username` (Text, Unique)
* `points` (Integer, Default 0) — *Never updated manually. Always via RPC. Enforced >= 0 by CHECK constraint.*
* `referral_code` (Text, Unique) — *Auto-generated on signup.*
* `referred_by` (UUID, FK → users.id, Nullable) — *Set if user signed up with a referral code.*
* `status` (Enum: `active`, `banned`)
* `created_at` (Timestampz, Default NOW())

### 2.2. `tasks`
The inventory of work available to users. Created by Admin directly (AdminToolsScreen) or when a promotion is approved.
* `id` (UUID, PK)
* `title` (Text)
* `video_url` (Text) — *YouTube or Instagram link.*
* `channel_url` (Text, Nullable) — *Creator's channel link.*
* `platform` (Text: `youtube`, `instagram`) — *Determines platform badge in UI.*
* `reward_points` (Integer) — *Base reward. VIP tasks pay 2x on approval.*
* `is_vip` (Boolean, Default false) — *True if the creator paid 200 BUG's. VIP tasks appear on HomeScreen banner.*
* `is_active` (Boolean, Default true) — *Admin can pause/unpause tasks without deleting.*
* `required_watch_time` (Integer) — *Seconds the user must watch before submitting.*
* `mcq_question` (Text)
* `mcq_options` (JSONB / Text Array)
* `mcq_answer` (Text) — *Must match user's submitted answer exactly.*
* `thumbnail_id` (Text, Nullable) — *ID referencing a preset thumbnail from `mobile-app/assets/thumbnails.ts`.*
* `created_at` (Timestampz, Default NOW())

### 2.3. `task_sessions`
The anti-cheat heartbeat. Prevents client-side time manipulation.
* `id` (UUID, PK)
* `user_id` (UUID, FK → users.id)
* `task_id` (UUID, FK → tasks.id)
* `started_at` (Timestampz) — *Generated strictly by the backend at `POST /api/tasks/:id/start`.*
* `completed_at` (Timestampz, Nullable)
* `status` (Text: `active`, `completed`, `abandoned`)

### 2.4. `submissions`
The proof of work. Created on task submit.
* `id` (UUID, PK)
* `user_id` (UUID, FK → users.id)
* `task_id` (UUID, FK → tasks.id)
* `screenshot_url` (Text) — *Supabase Storage URL in `screenshots` bucket.*
* `image_hash` (Text) — *SHA-256 of the image. Checked globally for duplicates.*
* `mcq_answer` (Text) — *User's submitted MCQ answer.*
* `status` (Enum: `pending`, `approved`, `rejected`)
* `created_at` (Timestampz, Default NOW())
* *Constraint: Unique index on `(user_id, task_id)` — one submission per user per task.*

### 2.5. `transactions`
The immutable financial ledger. **APPEND ONLY — NO UPDATE OR DELETE EVER.**
* `id` (UUID, PK)
* `user_id` (UUID, FK → users.id)
* `type` (Enum: `earn`, `spend`, `topup`, `reward`, `refund`)
* `amount` (Integer) — *Positive for credits, negative for debits.*
* `description` (Text)
* `created_at` (Timestampz, Default NOW())
* *Rule: Append-only. No UPDATEs or DELETEs.*

### 2.6. `promotions`
The creators' requests to buy attention.
* `id` (UUID, PK)
* `user_id` (UUID, FK → users.id)
* `title` (Text)
* `video_url` (Text)
* `channel_url` (Text, Nullable)
* `platform` (Text: `youtube`, `instagram`)
* `mcq_question` (Text)
* `mcq_options` (JSONB / Text Array)
* `mcq_answer` (Text)
* `is_vip` (Boolean, Default false) — *True if 200 BUG's were paid.*
* `status` (Enum: `pending`, `approved`, `rejected`)
* `created_at` (Timestampz, Default NOW())

### 2.7. `referrals`
The viral loop tracker.
* `id` (UUID, PK)
* `referrer_id` (UUID, FK → users.id)
* `referred_user_id` (UUID, FK → users.id)
* `reward_earned` (Boolean, Default false) — *Flipped to true only after the referred user's first approved task. Race-condition-safe via optimistic locking.*
* `created_at` (Timestampz, Default NOW())
* *Constraint: Unique on `(referrer_id, referred_user_id)`.*

### 2.8. `payment_requests`
The bridge between fiat (UPI) and BUG's.
* `id` (UUID, PK)
* `user_id` (UUID, FK → users.id)
* `amount` (Integer, CHECK >= 50 AND <= 100000) — *In BUG's / INR.*
* `screenshot_url` (Text) — *Supabase Storage URL in `payment-proofs` bucket.*
* `utr_number` (Text) — *UPI transaction reference. Unique to prevent double-credit.*
* `status` (Enum: `pending`, `approved`, `rejected`)
* `created_at` (Timestampz, Default NOW())

### 2.9. `logs`
The abuse watchdog. Tracks system events for admin review.
* `id` (UUID, PK)
* `user_id` (UUID, FK → users.id, Nullable)
* `action` (Text) — *Event type, e.g. `duplicate_hash`, `admin_user_status_change`.*
* `ip_address` (Text, Nullable)
* `device_id` (Text, Nullable)
* `metadata` (JSONB) — *Flexible additional context.*
* `created_at` (Timestampz, Default NOW())

### 2.10. `device_links`
Maps unique device IDs to users for multi-account detection.
* `id` (UUID, PK)
* `user_id` (UUID, FK → users.id)
* `device_id` (Text) — *Unique device identifier generated by `lib/deviceId.ts`.*
* `created_at` (Timestampz, Default NOW())
* *Constraint: Unique on `(user_id, device_id)`.*

---

## 3. THE ATOMIC ENGINE (RPC)

The database exposes a suite of atomic RPCs that the backend calls for every
economy-changing operation. These run inside a single Postgres transaction so
the points mutation, the ledger append, and the status flip either ALL commit
or ALL roll back — no partial failures.

### Primitive RPCs

| RPC | Purpose | Returns |
|-----|---------|---------|
| `credit_points(user_uuid, amount)` | Unconditional credit (positive) or debit (negative amount) | void |
| `deduct_points(user_uuid, amount)` | Conditional debit — returns false if balance would go negative | boolean |
| `get_user_stats(user_uuid)` | Total earned, spent, tasks completed, promotions count | JSONB |

### Triggers

| Trigger | On | Function | Purpose |
|---------|-----|----------|---------|
| `on_auth_user_created` | INSERT on `auth.users` | `handle_new_user()` | Auto-creates `public.users` row with generated referral code |

### Application-Level Workflows
These are multi-step operations composed by the backend (not single RPCs) but executed atomically:

| Workflow | API Route | Steps |
|----------|-----------|-------|
| **Approve Submission** | `POST /admin/submissions/:id/approve` | 1. `credit_points(user, reward)` 2. Update submission status→approved 3. Insert `reward` transaction 4. If first task + referred: `credit_points(referrer, 5)` + insert referral `reward` transaction + flip `referrals.reward_earned=true` |
| **Reject Submission** | `POST /admin/submissions/:id/reject` | 1. Update submission status→rejected |
| **Approve Promotion** | `POST /admin/promotions/:id/approve` | 1. Insert new row in `tasks` from promotion data 2. Update promotion status→approved |
| **Reject Promotion** | `POST /admin/promotions/:id/reject` | 1. `credit_points(user, 49 or 200)` 2. Insert `refund` transaction 3. Update promotion status→rejected |
| **Approve Payment** | `POST /admin/payments/:id/approve` | 1. `credit_points(user, amount)` 2. Insert `topup` transaction 3. Update payment status→approved |
| **Request Promotion (User)** | `POST /promotions/request` | 1. Check balance >= 49/200 2. `credit_points(user, -49 or -200)` 3. Insert `spend` transaction 4. Insert `promotions` row (status=pending) |

### Design Invariant
By forcing the API to call `credit_points` instead of composing multi-step `SELECT + UPDATE` sequences in application code, we eliminate **every** race condition where concurrent requests could double-spend, double-reward, or leave the ledger out of sync with the balance.

---

## 4. STORAGE BUCKETS

| Bucket | Public | Upload From | Purpose |
|--------|--------|----|---------|
| `screenshots` | No | Mobile (anon key) | Task proof screenshots |
| `payment-proofs` | No | Mobile (anon key) | UPI payment screenshots |
| `avatars` | Yes | Mobile (anon key) | User profile pictures |
