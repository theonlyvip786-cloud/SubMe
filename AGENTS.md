# AGENTS.md — SubKo Project

## Project Overview

**SubKo** is a Creator Promotion & Video Feedback Rewards Platform. Users earn points by completing video watch + feedback tasks, then spend points to promote their own content. The platform enforces strict anti-cheat, compliance (no fake engagement), and uses Supabase Auth for authentication.

**Monorepo Structure:**
- `/backend` — Node.js + Express API server
- `/mobile-app` — React Native Expo app (Pastel Y2K E-Learning aesthetic), includes admin functionality
- `/supabase_schema.sql` — PostgreSQL schema with Supabase Auth integration

---

## Agent Definitions

### 1. Backend Agent
**Scope:** `/backend/src/index.js` and all backend logic.

**Responsibilities:**
- Express server setup with Morgan logging and Helmet security headers
- JWT verification via Supabase Auth tokens (signup/login delegated to Supabase Auth on frontend)
- Dual-mode auth: Supabase ES256 JWTs for users, custom HS256 JWTs for admin (issued at `/api/auth/login`)
- Rate limiting via express-rate-limit on all API routes (stricter on auth endpoints)
- Task execution workflow: `POST /api/tasks/:id/start`, `POST /api/tasks/:id/submit`
- Server-side timer validation with 24-hour session expiration and 3-second tolerance buffer
- Screenshot hash verification (SHA-256, checked globally across all submissions)
- MCQ answer verification against task's `mcq_answer`
- Points economy: atomic credit on approval (via `credit_points` RPC), debit on promotion (49 / 200 pts), refund on rejection
- Referral hook: atomic 5-pts credit to referrer on first approved task (race-condition safe via optimistic locking)
- Payment flow: UPI-based manual payments with admin review and crediting
- Admin routes: submission review, promotion approval/rejection, user search, manual credit, payment approval, task CRUD, system logs, CSV export
- Background cron: auto-cleanup of tasks older than 24 hours (runs every 30 mins)
- Serve static files: mobile app web build at `/`

**Key Files:**
- `backend/src/index.js` — Express app setup, route mounting, 24hr cleanup cron
- `backend/src/routes/admin.js` — All admin operations
- `backend/src/routes/auth.js` — Admin login, profile creation, device registration
- `backend/src/routes/tasks.js` — Task list, start session, submit with full validation
- `backend/src/routes/proofs.js` — Proof submission and history
- `backend/src/routes/payments.js` — UPI payment submission + UTR check
- `backend/src/routes/promotions.js` — Campaign promotion spend
- `backend/src/routes/referrals.js` — Referral code lookup
- `backend/src/routes/transactions.js` — Transaction history
- `backend/src/routes/users.js` — User profile CRUD
- `backend/src/middleware/auth.js` — authMiddleware + adminMiddleware
- `backend/src/middleware/rateLimit.js` — apiLimiter + authLimiter
- `backend/src/lib/supabase.js` — Supabase client singleton (service role)
- `backend/.env` — Environment config
- `backend/package.json` — Dependencies
- `backend/scripts/` — Dev-only utility scripts (not production)

**Dependencies:** express, jsonwebtoken, cors, helmet, morgan, @supabase/supabase-js, dotenv, express-rate-limit, razorpay

**Constraints:**
- Auth is Supabase Auth. Backend only verifies JWTs — no signup/login/password logic for regular users.
- Points mutations use `credit_points` RPC for atomicity. Use negative values for deductions.
- Immutable transaction ledger — never delete or mutate past records.
- Admin is determined by email check: `admin@subko.app` or `ADMIN_EMAIL` env var.
- Backend uses `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS. Never use anon key on server.

---

### 2. Mobile App Agent
**Scope:** `/mobile-app/` — React Native Expo app.

**Responsibilities:**
- Screen implementations: Welcome, Login, SignUp, ForgotPassword, ResetPassword, Home, Task, SubmitProof, MyProofs, Wallet, Profile, Referral, RequestPromotion, Banned, AdminAnalytics, AdminReviews, AdminPayments, AdminTools, AdminUsers
- Auth store (Zustand): JWT storage, auto-logout on 401/403, banned-state routing to BannedScreen, `requiresPasswordReset` state for password reset flow
- Task UI: client-side countdown timer (cosmetic only, server validates), MCQ rendering with selectable options, screenshot upload via `SubmitProofScreen`
- SubmitProofScreen: SHA-256 hash via `expo-crypto` before upload, Supabase Storage upload, submit to backend
- MyProofsScreen: user's submission history with status badges
- Wallet UI: transaction history, UPI payment flow with QR code and app deep-link, payment proof upload, UTR verification
- Promote UI: 49-pt / 200-pt spend flow with MCQ creation (4 options, 1 correct), platform selector, tier selector
- Referral UI: fetches real `referral_code` from API, clipboard copy, share
- Profile UI: admin mode toggle (for admin email only), logout, link to MyProofs
- Admin UI: 5 dedicated screens — Analytics, Reviews, Payments, Tools, Users
- ForgotPassword + ResetPassword flow via Supabase Auth
- Pastel Y2K E-Learning aesthetic with SafeAreaView, KeyboardAvoidingView

**Key Files:**
- `mobile-app/App.tsx` — Root navigator (Stack + Bottom Tabs), boot hydration, global CSS injection
- `mobile-app/config.ts` — API_URL, Supabase URL and key
- `mobile-app/screens/WelcomeScreen.tsx`
- `mobile-app/screens/LoginScreen.tsx`
- `mobile-app/screens/SignUpScreen.tsx`
- `mobile-app/screens/ForgotPasswordScreen.tsx`
- `mobile-app/screens/ResetPasswordScreen.tsx`
- `mobile-app/screens/HomeScreen.tsx` — Bento grid with VIP banner + quick actions
- `mobile-app/screens/TaskScreen.tsx` — Task execution with cosmetic timer + MCQ
- `mobile-app/screens/SubmitProofScreen.tsx` — Screenshot picker + SHA-256 hash + upload
- `mobile-app/screens/MyProofsScreen.tsx` — User's submission history
- `mobile-app/screens/WalletScreen.tsx` — Balance + transactions + UPI topup
- `mobile-app/screens/RequestPromotionScreen.tsx` — Promotion spend flow
- `mobile-app/screens/ReferralScreen.tsx` — Referral code display + share
- `mobile-app/screens/ProfileScreen.tsx` — Settings + admin mode toggle
- `mobile-app/screens/BannedScreen.tsx` — Locked state
- `mobile-app/screens/AdminAnalyticsScreen.tsx` — Economy charts + metrics + CSV export
- `mobile-app/screens/AdminReviewsScreen.tsx` — Submission + promotion review queues
- `mobile-app/screens/AdminPaymentsScreen.tsx` — UPI payment approval queue
- `mobile-app/screens/AdminToolsScreen.tsx` — Create tasks + manage tasks + credit user + system logs
- `mobile-app/screens/AdminUsersScreen.tsx` — User search + ban/unban
- `mobile-app/store/useAuthStore.ts` — Zustand auth state management
- `mobile-app/lib/deviceId.ts` — Stable device ID generation
- `mobile-app/lib/useSmsReader.ts` — SMS UTR auto-read hook
- `mobile-app/assets/upi-qr.jpg` — QR code image for UPI payment

**Constraints:**
- Timer is cosmetic only — server validates elapsed time on submit with 24-hour session expiration
- No hardcoded API URLs in screens; use `config.ts`
- Screenshots are uploaded to Supabase Storage; SHA-256 hash computed client-side via `expo-crypto`
- `SUPABASE_ANON_KEY` in config.ts is the anon key (safe for client-side use)
- `requiresPasswordReset` in auth store controls whether ResetPasswordScreen is shown

---

### 3. Database Agent
**Scope:** `supabase_schema.sql` and all database concerns.

**Responsibilities:**
- Schema design for all 10 tables:
  - `users` — id (UUID, matches auth.users), email, username, points, referral_code, referred_by, status (active/banned)
  - `tasks` — title, video_url, channel_url, reward_points, is_vip, is_active, required_watch_time, mcq_question, mcq_options, mcq_answer, platform, thumbnail_id
  - `task_sessions` — user_id, task_id, started_at, completed_at, status
  - `submissions` — user_id, task_id, screenshot_url, image_hash, mcq_answer, status (pending/approved/rejected)
  - `transactions` — user_id, type (earn/spend/topup/reward/refund), amount, description (immutable ledger)
  - `promotions` — user_id, title, video_url, channel_url, platform, mcq_question, mcq_options, mcq_answer, is_vip, status
  - `referrals` — referrer_id, referred_user_id, reward_earned (boolean)
  - `logs` — user_id, action, ip_address, device_id, metadata (JSONB) for abuse tracking
  - `payment_requests` — user_id, amount (≥50, ≤100000), screenshot_url, utr_number, status (pending/approved/rejected)
  - `device_links` — device_id, user_id (for multi-account detection)
- UUID primary keys, PostgreSQL default timestamps
- Unique constraints: (user_id, task_id) on submissions, (email) and (username) on users, (user_id, device_id) on device_links
- `handle_new_user()` trigger fires on `auth.users` INSERT

**Key Files:**
- `supabase_schema.sql` — Full schema definition with SQL functions, triggers, and RLS policies

**Constraints:**
- Supabase Auth is used for authentication. RLS policies are enabled on users, tasks, submissions, and transactions tables.
- No Supabase Edge Functions
- All queries are raw SQL via `@supabase/supabase-js` client
- Backend uses service_role key to bypass RLS

---

### 4. Anti-Cheat Agent
**Scope:** Cross-cutting concern across backend and mobile app.

**Responsibilities:**
- **Screenshot Farming:** SHA-256 hashes computed client-side via `expo-crypto` in `SubmitProofScreen`. Stored in `submissions.image_hash`. Duplicate hashes flagged in `logs` and rejected.
- **Timer Manipulation:** Server-side `started_at` timestamps in `task_sessions`. Backend validates elapsed time on submit. 3-second tolerance buffer. 24-hour session expiration.
- **MCQ Verification:** Server checks submitted answer against task's `mcq_answer` (case-sensitive exact match).
- **Multi-Account Detection:** `deviceId.ts` generates stable device ID. Registered via `/api/auth/device`. `device_links` table tracks associations. Flagged in `logs`.
- **Double Submission:** Database UNIQUE constraint on `(user_id, task_id)` in `submissions`.
- **Referral Abuse:** `reward_earned` flag + optimistic locking — only one referral reward per referred user ever.

**Key Touch Points:**
- `backend/src/routes/tasks.js` — Hash checks, timer validation, MCQ verification
- `backend/src/routes/admin.js` — Submission approval with referral hook (5 BUG's)
- `mobile-app/screens/SubmitProofScreen.tsx` — Client-side hash computation + upload
- `mobile-app/lib/deviceId.ts` — Device fingerprinting
- `supabase_schema.sql` — `logs` table for abuse tracking

**Constraints:**
- Client-side timer is cosmetic only — server is the source of truth
- Hash must be computed BEFORE upload, sent with submission payload
- Device registration happens at login/signup, not on every request

---

### 5. Payments Agent
**Scope:** Payment flow — UPI-based manual payments.

**Responsibilities:**
- **Production Flow:** User pays via UPI (QR code or app deep-link), uploads payment screenshot and UTR number via `/api/payments/manual`. Admin reviews in mobile app AdminPaymentsScreen and approves, which credits BUG's to user atomically via `credit_points` RPC.
- UTR uniqueness check via `/api/payments/verify-utr` to prevent double-submissions.
- `payment_requests` table: tracks screenshots, UTR numbers, admin review status.
- Idempotency: payments are reviewed manually, no automatic double-credit risk.

**Key Touch Points:**
- `backend/src/routes/payments.js` — `/api/payments/manual`, `/api/payments/verify-utr`
- `backend/src/routes/admin.js` — `/api/admin/payments/:id/approve`
- `mobile-app/screens/WalletScreen.tsx` — UPI payment UI, QR code, screenshot upload
- `mobile-app/screens/AdminPaymentsScreen.tsx` — Payment approval tab
- `mobile-app/assets/upi-qr.jpg` — QR code image

**UPI Details:**
- UPI ID: `theonlyvip786@okaxis`
- Name: `SubKo Admin`
- Minimum topup: ₹50

---

### 6. Referral Agent
**Scope:** Referral system across backend and mobile app.

**Responsibilities:**
- Referral code stored in `users.referral_code` (generated on signup via `handle_new_user` trigger)
- `referrals` table: links referrer_id to referred_user_id
- Referral reward hook: on first approved task of referred user, auto-credit **5 BUG's** to referrer
- One-time reward enforcement via `referrals.reward_earned` boolean flag + optimistic locking (race-condition safe)
- Mobile UI: displays real referral code from API, clipboard copy, share functionality

**Key Touch Points:**
- `backend/src/routes/admin.js` — Approval workflow referral hook (5 pts credit to referrer)
- `backend/src/routes/referrals.js` — GET own referral code
- `mobile-app/screens/ReferralScreen.tsx` — Displays real referral code + share
- `mobile-app/screens/ProfileScreen.tsx` — Referral code with copy button
- `supabase_schema.sql` — `referrals` table

---

### 7. Deployment Agent
**Scope:** Build, deployment, and production configuration.

**Responsibilities:**
- Single-origin serving: Express serves API (`/api/*`) and mobile app build (`/`)
- No CORS complexity — same domain for all components in production
- Production environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `SUPABASE_JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Mobile app web build output at `mobile-app/dist/`
- Android APK via EAS build (`eas build --platform android`)

**Key Touch Points:**
- `backend/src/index.js` — `express.static` serving mobile build
- `mobile-app/dist/` — built frontend assets
- `mobile-app/eas.json` — EAS build configuration
- `backend/.env` — All production secrets

**Constraints:**
- API and mobile app must share the same production domain
- No separate CDN or frontend hosting — all through Express
- Never commit `.env` to version control (use `.env.example` as template)

---

## Cross-Agent Rules

1. **Auth is Supabase Auth.** Backend only verifies JWTs — no custom login/signup/password logic for regular users.
2. **Server is always the truth.** Client timers are cosmetic only.
3. **Transactions are immutable.** Never UPDATE or DELETE from the `transactions` table — only INSERT.
4. **Compliance:** No fake engagement. Tasks are video discovery + qualitative feedback only.
5. **Banned users** must be force-redirected to BannedScreen on any 403 response.
6. **All monetary values** are in points (BUG's). 1 INR = 1 BUG. 49 BUG's = Standard promotion. 200 BUG's = VIP promotion.
7. **Referral reward is 5 BUG's**, credited only after the referred user's first approved task.
8. **Admin is determined by email** (`admin@subko.app` or `ADMIN_EMAIL` env var) — no `admin_users` table.
9. **Points mutations must be atomic.** Use `credit_points` RPC — never read-then-write. Use negative amounts for deductions.
10. **VIP tasks pay 2x** reward points to the worker on admin approval.
11. **Task auto-expiry:** Tasks older than 24 hours are auto-deleted by backend cron every 30 minutes.
