# IMPLEMENTATION TASKS — SubKo
**Project:** SubKo — Creator Promotion & Video Feedback Rewards
**Last Updated:** 2026-07-18

This document tracks all completed and planned work. Each phase builds upon the last.

---

## PHASE 1: CORE SETUP & THE AUTH GATEWAY ✅
- [x] **Task 1.1:** Scaffold `/backend` (Express, Helmet, Morgan, dotenv) and `/mobile-app` (Expo, Zustand, React Navigation).
- [x] **Task 1.2:** Execute `supabase_schema.sql` to generate all 10 core tables in the PostgreSQL database.
- [x] **Task 1.3:** Implement `/api/auth/login` (admin) and `/api/auth/` (user profile fallback) endpoints.
- [x] **Task 1.4:** Build `useAuthStore` in Zustand. Implement Axios interceptor for 401/403 handling.
- [x] **Task 1.5:** Build `ForgotPasswordScreen` (Supabase `resetPasswordForEmail`).
- [x] **Task 1.6:** Build `ResetPasswordScreen` (Supabase `updateUser`). `requiresPasswordReset` state in Zustand.
- [x] **Task 1.7:** WelcomeScreen hero with Y2K character and CTA buttons.

## PHASE 2: THE ANTI-CHEAT ENGINE ✅
- [x] **Task 2.1:** Build `POST /api/tasks/:id/start`. Immediately inserts into `task_sessions` with `started_at = NOW()`.
- [x] **Task 2.2:** Build `TaskScreen.tsx`. Cosmetic countdown timer unlocks MCQ when it hits 0.
- [x] **Task 2.3:** Build `SubmitProofScreen.tsx`. Integrates `expo-crypto` SHA-256 hash before upload. Uploads to Supabase Storage.
- [x] **Task 2.4:** Build `POST /api/tasks/:id/submit`. Validates: (A) elapsed time >= required_watch_time, (B) image_hash not duplicate, (C) MCQ answer correct.
- [x] **Task 2.5:** Build `deviceId.ts` for stable device fingerprinting. Register via `/api/auth/device`.

## PHASE 3: THE ECONOMY & LEDGER ✅
- [x] **Task 3.1:** `credit_points` RPC in PostgreSQL for atomic balance mutations.
- [x] **Task 3.2:** Build `WalletScreen.tsx` with Bento Lime Balance Card and full transaction ledger.
- [x] **Task 3.3:** Build `GET /api/transactions`. Pulls from immutable `transactions` table.
- [x] **Task 3.4:** Build `POST /api/payments/manual`. User submits UTR + screenshot for admin review.
- [x] **Task 3.5:** Build `POST /api/payments/verify-utr`. Checks UTR uniqueness before submission.
- [x] **Task 3.6:** Build `MyProofsScreen.tsx`. User's submission history with status badges.

## PHASE 4: PROMOTIONS & REFERRALS ✅
- [x] **Task 4.1:** Build `RequestPromotionScreen.tsx`. Standard (49 BUG's) and VIP (200 BUG's) tiers with MCQ creation.
- [x] **Task 4.2:** Implement Refund Logic. Admin rejection triggers `credit_points(user_id, 49 or 200)` + `refund` transaction.
- [x] **Task 4.3:** Build Referral Hook. On first approved task of referred user → `credit_points(referrer_id, 5)` + flip `referrals.reward_earned = true` (race-condition safe via optimistic lock).
- [x] **Task 4.4:** Build `ReferralScreen.tsx`. Displays real `referral_code` from API with clipboard copy.

## PHASE 5: THE ADMIN DASHBOARD ✅
- [x] **Task 5.1:** Build `AdminTabNavigator` with 5 dedicated screens (Analytics, Users, Reviews, Payments, Tools).
- [x] **Task 5.2:** Build `AdminAnalyticsScreen.tsx`. Economy charts (daily/weekly/monthly) + stats cards + CSV export.
- [x] **Task 5.3:** Build `AdminReviewsScreen.tsx`. Pending submissions (approve/reject) + pending promotions (approve/reject).
- [x] **Task 5.4:** Build `AdminPaymentsScreen.tsx`. UPI payment queue with UTR + screenshot review.
- [x] **Task 5.5:** Build `AdminUsersScreen.tsx`. User search + ban/unban with `logs` audit.
- [x] **Task 5.6:** Build `AdminToolsScreen.tsx`. Create tasks with thumbnail picker, manage tasks (toggle/delete), credit user, system logs.
- [x] **Task 5.7:** Connect Admin Approve → backend points credit + transaction logging + referral hook.
- [x] **Task 5.8:** Promotion approval → creates live `tasks` row from promotion data.

## PHASE 6: POLISH & DEPLOYMENT ✅
- [x] **Task 6.1:** Bento Grid UI. Y2K Pastel colors across all cards. Sharp offset shadows.
- [x] **Task 6.2:** `Y2KCelebrationOverlay` (sparkles), `Y2KAlertPopup`, `Y2KCharacter`, `Y2KCoin`, `Y2KNote`.
- [x] **Task 6.3:** Custom `BottomTabBar` with spring-animated sliding indicator pill.
- [x] **Task 6.4:** Single Origin Serving. Express serves web build at `/`.
- [x] **Task 6.5:** 24-hour task auto-cleanup cron in `index.js` (runs every 30 minutes).
- [x] **Task 6.6:** Global rate limiting on all API routes.

## PHASE 7: MAINTENANCE & DOCS ✅ (2026-07-18)
- [x] **Task 7.1:** Move backend dev scripts to `backend/scripts/` folder.
- [x] **Task 7.2:** Update `brain.md` — full codebase state sync.
- [x] **Task 7.3:** Update `APP_FLOW.md` — all 19 screens + flows documented.
- [x] **Task 7.4:** Update `prd.md` — version 3.1.0 with all features.
- [x] **Task 7.5:** Update `TRD.md` — all routes, middleware, lib files, scripts.
- [x] **Task 7.6:** Update `BACKEND_SCHEMA.md` — all 10 tables with all fields.
- [x] **Task 7.7:** Update `AGENTS.md` — all agents with current screens and responsibilities.
- [x] **Task 7.8:** Update `DESIGN.md` — theme components catalog, tab icons, animation details.
- [x] **Task 7.9:** Align referral reward = 5 BUG's across all docs and code.

---

## BACKLOG / FUTURE
- [ ] Push notifications (task approval, payment approval)
- [ ] In-app video player (instead of external browser)
- [ ] User-facing analytics (my earnings chart)
- [ ] Leaderboard (top earners)
- [ ] Withdrawal / payout flow (UPI payout to user)
- [ ] Rate limiting per-user (not just global)
- [ ] APK production build + Play Store listing
