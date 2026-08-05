# TECHNICAL REQUIREMENTS DOCUMENT (TRD)
**Project:** SubKo — Creator Promotion & Video Feedback Rewards
**Architecture:** High-Velocity, Anti-Cheat, Monorepo Setup
**Last Updated:** 2026-07-18

---

## 1. SYSTEM ARCHITECTURE
SubKo operates on a tight, zero-latency paradigm. It runs as a monorepo consisting of a React Native mobile frontend, a Node.js Express backend, and a deeply integrated PostgreSQL database powered by Supabase.

### The Triangle of Truth:
1. **The Client (Mobile):** The presentation layer. Beautiful, fast, and entirely untrusted. It handles UX, local state, and basic client-side hashing. It makes zero final decisions.
2. **The Gateway (Backend):** The enforcer. Written in Express.js. It verifies JWTs, calculates time diffs, rate-limits abuse globally, and delegates every economy-changing operation to atomic Postgres RPCs.
3. **The Vault (Database):** Supabase PostgreSQL. Stores the absolute state of the economy. Mutations to balances only happen via the atomic RPC suite (`credit_points`, `deduct_points`) — each running inside a single Postgres transaction so points, ledger, and status flip together or not at all.

---

## 2. THE STACK IN DETAIL

### 2.1. The Frontend (Mobile App)
* **Framework:** React Native via Expo SDK ~54.
* **Language:** TypeScript (Strict Mode).
* **State Management:** Zustand v4. (Lightweight, unopinionated, blistering fast).
* **Network Layer:** Axios with aggressive interceptors. If a 401/403 hits, the interceptor instantly flushes state and routes to Login/Banned.
* **Cryptography:** `expo-crypto` for SHA-256 client-side screenshot hashing.
* **Styling:** Custom Neobrutalist / Y2K Bento Grid system. No bloated UI libraries. Pure `StyleSheet` performance.
* **Media:** `expo-av` for any audio/video needs. `expo-image-picker` for screenshot selection.
* **Device:** `lib/deviceId.ts` generates a stable, unique device ID for anti-cheat registration. `lib/useSmsReader.ts` provides SMS auto-read capability for UTR extraction.
* **Storage Client:** `lib/supabase.ts` provides anon-key Supabase client for client-side Storage uploads.

### 2.2. The Backend (API Gateway)
* **Runtime:** Node.js.
* **Framework:** Express.js.
* **Security:** Helmet (Headers), Morgan (Logging), `express-rate-limit` (DDoS & Spam prevention on all `/api/*` routes).
* **Authentication:** Dual-mode JWT verification:
  * **User JWTs:** Supabase-issued ES256 tokens — verified via `supabase.auth.getUser(token)`.
  * **Admin JWTs:** Custom HS256 tokens signed with `JWT_SECRET` — verified locally via `jsonwebtoken`.
* **Deployment Setup:** Single Origin Serving. The Express backend statically serves the React web build on `/`, while the API operates on `/api/*`. No CORS nightmares. One domain rules all.
* **Background Jobs:** A `setInterval` cron runs every 30 minutes in `index.js` to auto-delete tasks older than 24 hours (`cleanupExpiredTasks()`).

### 2.3. The Database (Supabase PostgreSQL)
* **Core:** PostgreSQL 15+.
* **Auth:** Supabase Auth (`auth.users`) deeply tied to the public `users` table via UUID foreign keys and trigger functions (`handle_new_user` trigger).
* **Storage:** Supabase Storage buckets (`screenshots`, `payment-proofs`, `avatars`) for binary file uploads.
* **Atomicity:** `credit_points(user_uuid, amount)` RPC for all balance mutations. We never do a `SELECT balance` followed by an `UPDATE balance`. Every mutation runs inside a single database transaction so concurrent requests cannot cause double-spends, double-credits, or ledger/balance desync.
* **Service Role:** Backend uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Never use `anon` key on the server.

---

## 3. BACKEND ROUTES BREAKDOWN

### Route Files (`backend/src/routes/`)

| File | Mount | Responsibility |
|------|-------|---------------|
| `auth.js` | `/api/auth` | Admin login, user profile creation (fallback), email check, device registration |
| `users.js` | `/api/users` | GET/PUT `/me` — profile fetch + username update |
| `tasks.js` | `/api/tasks` | Task list, start session, submit task (timer + hash + MCQ validation) |
| `proofs.js` | `/api/proofs` | Screenshot proof submission, user's proof history |
| `payments.js` | `/api/payments` | UPI payment submission, UTR uniqueness check |
| `promotions.js` | `/api/promotions` | Atomic BUG's spend + pending promotion creation |
| `referrals.js` | `/api/referrals` | Get own referral code |
| `transactions.js` | `/api/transactions` | Immutable ledger read |
| `admin.js` | `/api/admin` | All admin operations (stats, analytics, tasks CRUD, user management, review queues, payments, logs, CSV export) |

### Middleware (`backend/src/middleware/`)

| File | Exports | Purpose |
|------|---------|---------|
| `auth.js` | `authMiddleware`, `adminMiddleware` | JWT verification (dual-mode), admin email check |
| `rateLimit.js` | `apiLimiter`, `authLimiter` | Rate limiting (global + stricter on auth endpoints) |

---

## 4. DATA FLOW & SECURITY PROTOCOLS

### The 403 Death Sentence
If a user tries to game the system, the Admin marks them `banned`.
1. Next API request hits Express.
2. `authMiddleware` checks `users.status`. Sees `banned`. Returns HTTP 403.
3. Mobile Axios interceptor catches 403.
4. Zustand store updates `user.status = 'banned'`.
5. React Navigation force-unmounts the entire app stack and mounts `BannedScreen`.

### The Immutable Ledger
The `transactions` table is an append-only ledger. There are no `UPDATE` or `DELETE` commands allowed on this table. Every point earned, spent, refunded, or topped up is permanently etched into history.

### Rate Limiting
- Global `apiLimiter` applied to all `/api/*` routes.
- Stricter `authLimiter` on login/signup endpoints to prevent brute-force.

### Admin Security
- Admin JWT is a custom HS256 token (not Supabase-signed) issued by the backend at `POST /api/auth/login`.
- `adminMiddleware` checks `req.user.email` against `ADMIN_EMAIL` env var (default: `admin@subko.app`).
- Regular user Supabase JWTs cannot pass the admin middleware even if email matches — the token type is checked.

---

## 5. DEPLOYMENT PIPELINE
* **Database:** Supabase hosted instance. Schema managed via `supabase_schema.sql`.
* **Backend:** Any Node.js hosting provider (Render, Railway, Heroku) mapping a domain to port 5000.
* **Mobile (Android):** Built via EAS (`eas build --platform android`) into `.apk` artifact. Config in `eas.json`.
* **Web (Admin/PWA):** Built via `expo export --platform web`, output to `mobile-app/dist/`, served by Express at the root route (`/`).
* **Single Origin:** API and web frontend share the same domain/port. No CORS configuration needed in production.

---

## 6. UTILITY SCRIPTS (`backend/scripts/`)
These are development-only scripts. Not part of the production server.

| Script | Purpose |
|--------|---------|
| `add_premium.js` | Manually mark a user as premium in Supabase |
| `scratch_insert_vip.js` | Insert test VIP promotion data |
| `setup_storage.js` | Initialize Supabase Storage buckets |
| `test.js` | Quick API connectivity test |
