# 🧠 Project Brain — SubKo

> **This is the single source of truth for any AI assistant working on this project.**
> Read this before touching any file. Last updated: 2026-07-18.

---

## 1. Project Overview

**SubKo** is a Creator Promotion & Video Feedback Rewards Platform. Users earn "BUG's" (internal points, 1 BUG = ₹1 INR) by completing video-watch + MCQ feedback tasks, then spend those BUG's to promote their own YouTube/Instagram content to other users. The entire economy is enforced server-side — no client decisions are trusted.

- **Target Platform:** Android (primary), iOS, Web (Admin PWA)
- **Current Stage:** MVP / Beta
- **Primary Language:** TypeScript (mobile), JavaScript (backend)
- **Framework:** React Native + Expo (mobile), Node.js + Express (backend)

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile Framework | React Native via **Expo SDK ~54** |
| Language | TypeScript (strict) |
| State Management | **Zustand** v4 |
| Navigation | **React Navigation** v6 (Stack + Bottom Tabs) |
| Backend | **Node.js + Express.js** |
| Database | **Supabase PostgreSQL** (via `@supabase/supabase-js`) |
| Auth | **Supabase Auth** (JWT — backend only verifies, never issues for users) |
| Storage | **Supabase Storage** (buckets: `screenshots`, `payment-proofs`, `avatars`) |
| Cryptography | `expo-crypto` SHA-256 (client-side screenshot hashing) |
| HTTP Client | **Axios** with global 401/403 interceptors |
| Image Picker | `expo-image-picker` |
| Clipboard | `expo-clipboard` |
| Animations | React Native `Animated` API (spring physics) |
| Icons | `@expo/vector-icons` (Ionicons) |
| Styling | Pure `StyleSheet` — NO TailwindCSS, NO UI libraries |

### Key Dependencies (mobile-app/package.json)
```
expo ~54.0.0 | react-native 0.81.5 | react 19.1.0
@supabase/supabase-js ^2.39.3 | axios ^1.6.7 | zustand ^4.5.1
@react-navigation/native ^6.1.9 | @react-navigation/native-stack ^6.9.17
@react-navigation/bottom-tabs ^6.6.1
expo-crypto ~15.0.9 | expo-image-picker ~17.0.11 | expo-clipboard ~8.0.8
expo-linear-gradient ~15.0.8 | expo-av ^16.0.8 | expo-font ~14.0.11
react-native-safe-area-context ~5.6.0 | react-native-screens ~4.16.0
react-native-confetti-cannon ^1.5.2 | react-native-webview ^13.15.0
```

### Backend Dependencies (backend/package.json)
```
express | jsonwebtoken | cors | helmet | morgan
@supabase/supabase-js | dotenv | express-rate-limit | razorpay
```

---

## 3. Project Architecture

### Folder Structure
```
SubKo/
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express app entry + route mounting + 24hr task cleanup cron
│   │   ├── lib/
│   │   │   └── supabase.js       ← Supabase client singleton (service role)
│   │   ├── middleware/
│   │   │   ├── auth.js           ← authMiddleware + adminMiddleware
│   │   │   └── rateLimit.js      ← authLimiter + apiLimiter
│   │   └── routes/
│   │       ├── admin.js          ← All admin CRUD routes (stats, analytics, tasks, users, payments, logs)
│   │       ├── auth.js           ← Profile creation + device registration + admin login
│   │       ├── payments.js       ← UPI payment submission + UTR verification
│   │       ├── promotions.js     ← Campaign promotion spending
│   │       ├── proofs.js         ← User proof submission (SubmitProofScreen)
│   │       ├── referrals.js      ← Referral code lookup
│   │       ├── tasks.js          ← Task list + start/submit workflow
│   │       ├── transactions.js   ← Transaction history
│   │       └── users.js          ← User profile (GET /me, PUT /me)
│   ├── scripts/                  ← Dev/utility scripts (not production)
│   │   ├── add_premium.js
│   │   ├── scratch_insert_vip.js
│   │   ├── setup_storage.js
│   │   └── test.js
│   ├── .env                      ← 🔑 SECRET — never commit
│   ├── .env.example              ← Template for new devs
│   └── package.json
├── mobile-app/
│   ├── App.tsx                   ← Root navigator + boot hydration + global CSS (web)
│   ├── config.ts                 ← API_URL, SUPABASE_URL, SUPABASE_ANON_KEY
│   ├── app.json                  ← Expo app config
│   ├── eas.json                  ← EAS build profiles
│   ├── babel.config.js           ← Babel + expo preset
│   ├── tsconfig.json             ← TypeScript config
│   ├── screens/
│   │   ├── WelcomeScreen.tsx     ← First screen (auth entry)
│   │   ├── LoginScreen.tsx       ← Email + password login
│   │   ├── SignUpScreen.tsx      ← Registration with optional referral code
│   │   ├── ForgotPasswordScreen.tsx ← Password reset request
│   │   ├── ResetPasswordScreen.tsx  ← New password entry (post email link)
│   │   ├── HomeScreen.tsx        ← Bento grid dashboard (tasks + quick actions)
│   │   ├── TaskScreen.tsx        ← Task execution + timer + MCQ
│   │   ├── SubmitProofScreen.tsx ← Screenshot upload + SHA-256 hash
│   │   ├── MyProofsScreen.tsx    ← User's submitted proofs history
│   │   ├── WalletScreen.tsx      ← Balance + transactions + UPI topup
│   │   ├── RequestPromotionScreen.tsx ← Spend BUG's to promote (Standard 49 / VIP 200)
│   │   ├── ReferralScreen.tsx    ← Referral code + share
│   │   ├── ProfileScreen.tsx     ← Settings + admin mode toggle + logout
│   │   ├── BannedScreen.tsx      ← Locked death state (403 trap)
│   │   ├── AdminAnalyticsScreen.tsx ← Charts + economy metrics
│   │   ├── AdminReviewsScreen.tsx   ← Submission + promotion moderation
│   │   ├── AdminPaymentsScreen.tsx  ← Payment approval queue
│   │   ├── AdminToolsScreen.tsx     ← Manual credit + task create/manage + logs
│   │   └── AdminUsersScreen.tsx     ← User search + ban/unban
│   ├── store/
│   │   └── useAuthStore.ts       ← Zustand: token, user, isAdminMode, hydrated, requiresPasswordReset
│   ├── theme/
│   │   ├── designSystem.ts       ← Colors, fonts, shadows, spacing (single source of truth)
│   │   ├── BottomTabBar.tsx      ← Custom Y2K animated tab bar
│   │   ├── animations.tsx        ← Spring physics hooks (useCardAnimation, AnimatedPressable, StaggeredItem)
│   │   ├── authLayout.tsx        ← Shared auth screen wrapper
│   │   ├── inputs.tsx            ← Styled input components (AppTextInput, InputBox)
│   │   ├── Y2KAlertPopup.tsx     ← Custom Y2K-style alert modal
│   │   ├── Y2KCelebrationOverlay.tsx ← Sparkle celebration animation (login/signup success)
│   │   ├── Y2KCharacter.tsx      ← Animated Y2K mascot character
│   │   ├── Y2KCoin.tsx           ← Animated BUG's coin icon
│   │   ├── Y2KNote.tsx           ← Y2K sticky note component
│   │   └── copy.ts               ← All UI text strings
│   ├── lib/
│   │   ├── supabase.ts           ← Supabase client (anon key, client-side)
│   │   ├── deviceId.ts           ← Unique device ID generation (anti-cheat)
│   │   └── useSmsReader.ts       ← SMS auto-read hook (UTR extraction)
│   ├── assets/
│   │   ├── upi-qr.jpg            ← QR code for UPI payment (8955833538@axl)
│   │   ├── thumbnails.ts         ← Task thumbnail presets registry
│   │   └── [thumbnail images]    ← Pre-defined task banner images
│   └── dist/                     ← Built web output (served by Express at /)
├── scripts/
│   └── smoke-test.js             ← API smoke test runner
├── supabase/                     ← Supabase CLI config
├── supabase_schema.sql           ← Full DB schema + RLS + triggers + RPCs
├── AGENTS.md                     ← Agent role definitions
├── APP_FLOW.md                   ← Screen-by-screen UX flows
├── BACKEND_SCHEMA.md             ← DB table documentation
├── DESIGN.md                     ← Visual design system brief
├── TRD.md                        ← Technical requirements
├── prd.md                        ← Product requirements
└── brain.md                      ← THIS FILE
```

### Architecture Pattern
**Triangle of Truth:**
1. **Client (Mobile)** — Presentation only. Untrusted. Does client-side SHA-256 hashing.
2. **Backend (Express)** — Enforcer. Verifies JWTs, validates timers, enforces business rules.
3. **Database (Supabase)** — Absolute source of truth. Points only mutated via RPC.

---

## 4. Navigation Structure

```
App.tsx (root)
├── [No token]          → AuthNavigator (Stack)
│   ├── WelcomeScreen
│   ├── LoginScreen
│   ├── SignUpScreen
│   └── ForgotPasswordScreen
├── [requiresPasswordReset] → ResetPasswordScreen (full screen)
├── [Banned]            → BannedScreen (full screen, no back)
├── [Admin + adminMode] → AdminTabNavigator (Bottom Tabs, 5 tabs)
│   ├── Analytics  → AdminAnalyticsScreen
│   ├── Users      → AdminUsersScreen
│   ├── Reviews    → AdminReviewsScreen
│   ├── Payments   → AdminPaymentsScreen
│   └── Tools      → AdminToolsScreen
└── [Normal user]       → MainTabNavigator (Bottom Tabs, 5 tabs)
    ├── Home       → HomeScreen
    ├── Wallet     → WalletScreen
    ├── Refer      → ReferralScreen
    ├── Promote    → RequestPromotionScreen
    ├── Profile    → ProfileScreen
    └── (Stack overlays — accessible from any tab)
        ├── TaskScreen
        ├── SubmitProofScreen
        └── MyProofs → MyProofsScreen
```

---

## 5. State Management (Zustand)

**File:** `mobile-app/store/useAuthStore.ts`

```typescript
// Key state shape:
{
  token: string | null,           // Supabase JWT or admin custom JWT
  user: UserProfile | null,       // From /api/users/me
  isAdminMode: boolean,           // Toggle admin tabs in ProfileScreen
  hydrated: boolean,              // AsyncStorage hydration complete
  requiresPasswordReset: boolean, // Force ResetPasswordScreen after Supabase OTP login
}

// Key actions:
login(token, user)       // Sets token + user, persists to AsyncStorage
logout()                 // Clears all state + AsyncStorage
hydrate()                // Restores token on app boot, calls /api/users/me
setAdminMode(bool)       // Toggles admin/user tab view
```

**Axios Interceptors** (set up in `setupAxiosInterceptors()`):
- 401 → auto-logout → LoginScreen
- 403 with `"banned"` → set `user.status = 'banned'` → triggers `BannedScreen`

---

## 6. Backend API Routes

**Base URL:** `http://[SERVER_IP]:5000` (configured in `mobile-app/config.ts`)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/login` | None | Admin-only custom login (returns HS256 JWT) |
| POST | `/api/auth/` | JWT | Create user profile (fallback if trigger fails) |
| POST | `/api/auth/check-email` | None | Check if email exists in Supabase |
| POST | `/api/auth/device` | JWT | Register device ID (anti-cheat) |
| GET | `/api/users/me` | JWT | Get own profile + approved task count |
| PUT | `/api/users/me` | JWT | Update username |
| GET | `/api/tasks` | JWT | List available tasks (excludes already-submitted) |
| POST | `/api/tasks/:id/start` | JWT | Start task session (server-side timer lock) |
| POST | `/api/tasks/:id/submit` | JWT | Submit task proof (timer + hash + MCQ validation) |
| POST | `/api/proofs` | JWT | Submit screenshot proof (SubmitProofScreen) |
| GET | `/api/proofs/my` | JWT | Get user's own proof submissions |
| POST | `/api/payments/verify-utr` | JWT | Check if UTR already used (idempotency) |
| POST | `/api/payments/manual` | JWT | Submit UPI payment proof |
| POST | `/api/promotions/request` | JWT | Spend BUG's to promote (49 std / 200 VIP) |
| GET | `/api/transactions` | JWT | Transaction history |
| GET | `/api/referrals` | JWT | Get own referral code |
| GET | `/api/admin/stats` | Admin JWT | Dashboard counts |
| GET | `/api/admin/analytics` | Admin JWT | Charts + metrics (daily/weekly/monthly) |
| GET | `/api/admin/submissions/pending` | Admin JWT | Pending submissions queue |
| POST | `/api/admin/submissions/:id/approve` | Admin JWT | Approve + credit points + referral hook |
| POST | `/api/admin/submissions/:id/reject` | Admin JWT | Reject submission |
| GET | `/api/admin/promotions/pending` | Admin JWT | Pending promotions queue |
| POST | `/api/admin/promotions/:id/approve` | Admin JWT | Approve → creates live task |
| POST | `/api/admin/promotions/:id/reject` | Admin JWT | Reject + refund (49 or 200 BUG's) |
| GET | `/api/admin/payments/pending` | Admin JWT | Pending payment requests |
| POST | `/api/admin/payments/:id/approve` | Admin JWT | Approve + mint BUG's |
| POST | `/api/admin/payments/:id/reject` | Admin JWT | Reject payment |
| GET | `/api/admin/users/search` | Admin JWT | Search users by email/username |
| POST | `/api/admin/users/:id/ban` | Admin JWT | Ban/unban user |
| POST | `/api/admin/users/:id/status` | Admin JWT | Set user status (active/banned) |
| POST | `/api/admin/users/credit` | Admin JWT | Manual credit BUG's to any user |
| POST | `/api/admin/tasks` | Admin JWT | Create new task (with thumbnail_id) |
| GET | `/api/admin/tasks` | Admin JWT | List all tasks |
| POST | `/api/admin/tasks/:id/toggle` | Admin JWT | Activate/pause task |
| DELETE | `/api/admin/tasks/:id` | Admin JWT | Delete task |
| GET | `/api/admin/logs` | Admin JWT | Abuse + system logs |
| GET | `/api/admin/transactions/export` | Admin JWT | CSV export (last 30 days, max 5000 rows) |

---

## 7. Database Schema

**Project:** Supabase `otbcyccbonxwaqslqtto` (ap-south-1 region)

### Tables (all have RLS enabled)

| Table | Primary Key | Key Columns |
|-------|------------|-------------|
| `users` | UUID (= auth.users.id) | email, username, points, referral_code, referred_by, status |
| `tasks` | UUID | title, video_url, channel_url, reward_points, is_vip, is_active, required_watch_time, mcq_*, platform, thumbnail_id |
| `task_sessions` | (user_id, task_id) | started_at, completed_at, status |
| `submissions` | UUID | user_id, task_id, screenshot_url, image_hash, mcq_answer, status |
| `transactions` | UUID | user_id, type, amount, description (**APPEND ONLY**) |
| `promotions` | UUID | user_id, title, video_url, channel_url, platform, mcq_*, is_vip, status |
| `referrals` | UUID | referrer_id, referred_user_id, reward_earned |
| `payment_requests` | UUID | user_id, amount, screenshot_url, utr_number, status |
| `logs` | UUID | user_id, action, ip_address, device_id, metadata |
| `device_links` | UUID | user_id, device_id |

### SQL Functions (RPCs)
```sql
credit_points(user_uuid UUID, amount INT)    -- Atomic points mutation (negative = deduction)
deduct_points(user_uuid UUID, amount INT)    -- Returns BOOL (false if insufficient balance)
get_user_stats(user_uuid UUID)               -- Returns total_earned, total_spent, tasks_completed, promotions_count
handle_new_user()                            -- Trigger: auto-creates users row on auth.users INSERT
```

### Triggers
- `on_auth_user_created` → fires `handle_new_user()` after INSERT on `auth.users`

### Storage Buckets
| Bucket | Public | Purpose |
|--------|--------|---------| 
| `screenshots` | No | Task proof screenshots |
| `payment-proofs` | No | UPI payment screenshots |
| `avatars` | Yes | User profile pictures |

---

## 8. Authentication Flow

### Regular Users
1. Sign up via Supabase Auth on the mobile app (client-side)
2. `on_auth_user_created` trigger auto-creates `public.users` row
3. Mobile app calls `POST /api/auth/` with username + optional referral code (fallback profile creation)
4. Supabase JWT stored in Zustand + AsyncStorage
5. All API calls send `Authorization: Bearer <supabase_jwt>` header
6. Backend verifies via `supabase.auth.getUser(token)` (ES256, Supabase-signed)

### Admin
1. Admin logs in via `POST /api/auth/login` with email + ADMIN_PASSWORD
2. Backend issues a custom HS256 JWT signed with `JWT_SECRET`
3. Admin JWT verified locally (not via Supabase) in `authMiddleware`
4. Admin check: `req.user.email === 'admin@subko.app' || process.env.ADMIN_EMAIL`

### Password Reset Flow
1. User taps "Forgot Password" → `ForgotPasswordScreen` → calls Supabase `resetPasswordForEmail()`
2. Supabase emails a magic link
3. User clicks link → app receives deep link → `requiresPasswordReset = true` in Zustand
4. App routes to `ResetPasswordScreen` → user sets new password via Supabase `updateUser()`

---

## 9. Environment Variables

### Backend (`backend/.env`)
```env
PORT=5000
SUPABASE_URL=https://otbcyccbonxwaqslqtto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>   ← Full admin DB access, bypasses RLS
SUPABASE_SECRET_KEY=<sb_secret_...>            ← Management API secret
JWT_SECRET=<string>                            ← Signs admin custom JWTs
SUPABASE_JWT_SECRET=<same_as_jwt_secret>       ← Alias used in auth middleware
ADMIN_EMAIL=admin@subko.app
ADMIN_PASSWORD=<admin_password>
```

### Mobile App (`mobile-app/config.ts`)
```typescript
export const API_URL = 'http://[PC_IP]:5000';      // Dynamic: reads from Metro scriptURL or window.location
export const SUPABASE_URL = 'https://otbcyccbonxwaqslqtto.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGci...';   // Safe anon key (public)
```

---

## 10. Design System

**Aesthetic:** Y2K Bento Grid / Pastel Fintech / Neo-Brutalist

**File:** `mobile-app/theme/designSystem.ts`

### Color Palette
```
bgPrimary:   #FAF9F6  ← Parchment canvas (app background)
bgDark:      #16120F  ← Deep obsidian (shadows, headers, boot screen)
white:       #FFFFFF  ← Card surfaces
black:       #16120F  ← Text, borders
pink:        #FFB7D5  ← Brand accent (hero cards, admin dashboard)
lime:        #C6F277  ← Money color (wallet balance, CTA buttons)
peach:       #FFD6AF  ← Promote actions, VIP tags
lavender:    #E6D5FF  ← Add Money actions
blue:        #2A6CFF  ← Refer actions, highlights
```

### Typography
- Font: `Inter` (system fallback: `Poppins`, `-apple-system`)
- Headings: 34px+, weight 800, letter-spacing -0.8
- Balance numbers: weight 900
- Shadows: **sharp, solid, offset** (neo-brutalist) — NOT blurred grey

### Theme Components
| Component | File | Purpose |
|-----------|------|---------|
| `AnimatedPressable` | animations.tsx | Press with scale(0.96) spring-back |
| `StaggeredItem` | animations.tsx | Staggered entrance animation |
| `useCardAnimation` | animations.tsx | Card slide-up + fade entrance |
| `AppTextInput` | inputs.tsx | Styled text input |
| `InputBox` | inputs.tsx | Input wrapper container |
| `Y2KAlertPopup` | Y2KAlertPopup.tsx | Custom modal alert |
| `Y2KCelebrationOverlay` | Y2KCelebrationOverlay.tsx | Sparkle burst on success |
| `Y2KCharacter` | Y2KCharacter.tsx | Animated mascot character |
| `Y2KCoin` | Y2KCoin.tsx | Animated BUG's coin |
| `Y2KNote` | Y2KNote.tsx | Sticky note UI element |
| `CustomBottomTabBar` | BottomTabBar.tsx | Custom animated bottom tabs |

### Animation Patterns
- **Press:** `scale(0.96)` on press, spring back on release
- **Entrance:** Staggered slide-up + fade with `tension: 80, friction: 6`
- **Celebration:** `Y2KCelebrationOverlay` sparkles on success events

---

## 11. Key Business Rules (NEVER violate these)

1. **Auth is Supabase Auth.** Backend only verifies JWTs. Never implement signup/login logic on backend for users.
2. **Server is always the truth.** Client timers are cosmetic. `task_sessions.started_at` is the real timer.
3. **Transactions are IMMUTABLE.** Never UPDATE or DELETE from `transactions` table. Only INSERT.
4. **Points mutations MUST be atomic.** Always use `credit_points` RPC. Never read-then-write.
5. **Banned users** get HTTP 403. Axios interceptor catches it → routes to `BannedScreen`. No escape.
6. **VIP tasks** pay 2x reward points on approval.
7. **Referral reward = 5 BUG's**, credited ONLY after referred user's first approved task. Enforced by `referrals.reward_earned` flag.
8. **Standard promotion cost = 49 BUG's. VIP promotion cost = 200 BUG's.**
9. **Admin determination** = email check only (`admin@subko.app` or `ADMIN_EMAIL` env var). No admin table.
10. **Duplicate screenshot** detection: SHA-256 hash checked globally. Duplicates logged + rejected.
11. **1 BUG = ₹1 INR.** All amounts are integers. Minimum topup = ₹50.
12. **UPI ID for payments:** `8955833538@axl` (Name: SubKo Admin)
13. **Task auto-expiry:** Backend cron runs every 30 mins, auto-deletes tasks older than 24 hours.
14. **Rate limiting:** Global `apiLimiter` on all `/api/*` routes. Stricter `authLimiter` on auth endpoints.

---

## 12. Anti-Cheat Matrix

| Attack Vector | Defense |
|--------------|---------|
| Timer manipulation | Server stores `started_at` in `task_sessions`. Submit rejected if elapsed < `required_watch_time`. |
| Screenshot farming | SHA-256 hash computed client-side via `expo-crypto`, checked against `submissions.image_hash`. Duplicates flagged in `logs`. |
| MCQ guessing | Server verifies `mcq_answer` against `tasks.mcq_answer`. Wrong answer = rejected. |
| Multi-account | `device_links` table maps device IDs to users. Flagged in `logs`. `deviceId.ts` generates stable device ID. |
| Banned users | 403 → Axios interceptor → `BannedScreen`. All navigation locked. |
| Session replay | Sessions expire after 24 hours. Task auto-cleanup removes stale tasks. |
| Double submission | Unique constraint on `(user_id, task_id)` in `submissions`. |
| Referral abuse | `reward_earned` flag on `referrals` table. Only first approved task triggers reward. Race-condition-safe via optimistic lock. |

---

## 13. Deployment Notes

- **Backend port:** 5000
- **Dev:** `npm run dev` in `backend/` starts Express with nodemon
- **Mobile dev:** `expo start --web` in `mobile-app/` → http://localhost:8081
- **Admin access:** Login with `admin@subko.app` + `ADMIN_PASSWORD` from `.env`
- **IP config:** Update `config.ts` with your PC's local IP for mobile/Android testing
- **Supabase project ref:** `otbcyccbonxwaqslqtto` (region: ap-south-1)
- **Build for APK:** `eas build --platform android` (configured in `eas.json`)
- **Web build:** `expo export --platform web` → output to `mobile-app/dist/` → served by Express at `/`
- **Single-origin:** Express serves API on `/api/*` and frontend build on `/`. No CORS needed.

---

## 14. Common Gotchas & Debug Tips

| Issue | Cause | Fix |
|-------|-------|-----|
| `Supabase connection check failed: Invalid API key` | `.env` has placeholder `SUPABASE_SERVICE_ROLE_KEY` | Add real service role key |
| `No active session` on task submit | User didn't call `/api/tasks/:id/start` first | Always call start before submit |
| `Watch time not met` error | Client submitted too early (possible clock mismatch) | 3-second tolerance buffer is built in |
| Admin JWT rejected | `JWT_SECRET` and `SUPABASE_JWT_SECRET` must match | Set both to same value in `.env` |
| Mobile can't reach backend | IP mismatch in `config.ts` | Update IP to match local PC on same Wi-Fi |
| `CharacterType` not found | Missing export in `Y2KCharacter.tsx` | Export type from that file |
| Expo Go tunnel URL | Start with `expo start --tunnel` for cross-network testing | Use ngrok URL shown in terminal |
| RLS blocking backend | Backend must use `service_role` key (bypasses RLS) | Never use `anon` key on backend |
| `logs` table insert fails | Schema mismatch — `logs` uses `action` not `event` | Use `action`, `metadata` columns |
| Task not appearing after promotion approved | `is_active` defaults correctly but check RLS policy | Ensure tasks RLS allows SELECT for authenticated users |

---

*Last updated: 2026-07-18 by AI assistant. This is a living document — update it whenever architecture changes.*
