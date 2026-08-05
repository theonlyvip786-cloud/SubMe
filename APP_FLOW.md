# APPLICATION FLOW & STATES
**Project:** SubKo — Creator Promotion & Video Feedback Rewards
**Last Updated:** 2026-07-18

---

## 1. THE AUTHENTICATION STACK
*The gateway. Clean, fast, and completely un-bypassable.*

### 1.1. Splash & Hydration
* **State:** Checking AsyncStorage for `session_token`.
* **Flow:** Valid token → Fetches `/api/users/me` → Redirects to **Main Stack**. Invalid token → Redirects to **Auth Stack**.
* **Safety net:** 4-second timeout in case hydration hangs — app always reaches a usable state.

### 1.2. Welcome Screen
* **UI:** Brand hero screen with Y2K character, app name "SubKo", and CTA buttons.
* **Flow:** "Login" → `LoginScreen`. "Sign Up" → `SignUpScreen`.

### 1.3. Login Screen
* **UI:** Neobrutalist form, bold headers, email/password inputs.
* **State:** `idle` → `loading` (verifying credentials) → `success` (updates global Zustand auth store) → routes to Home.
* **Edge Case:** "Server Offline" popup if backend is down. "Forgot Password?" link → `ForgotPasswordScreen`.

### 1.4. Sign-Up Screen
* **UI:** Similar to Login. Requires Username, Email, Password, and optional Referral Code.
* **State:** Signs up via Supabase Auth → Auto-creates profile in backend → Routes to Login with success alert.

### 1.5. Forgot Password Screen
* **UI:** Single email input with "Send Reset Link" button.
* **Flow:** Calls Supabase `resetPasswordForEmail()` → Supabase emails a magic link → User clicks link in email → App receives deep link → `requiresPasswordReset = true` in Zustand → Routes to `ResetPasswordScreen`.

### 1.6. Reset Password Screen
* **UI:** New password + confirm password inputs.
* **State:** Calls Supabase `updateUser({ password })` → On success, clears `requiresPasswordReset` → Routes to Home.
* **Trigger:** Only shown when `requiresPasswordReset === true` in auth store.

---

## 2. THE MAIN STACK (BOTTOM TABS)
*The core engine for users. Driven by a custom Y2K Neobrutalist tab bar with 5 tabs.*

### 2.1. Home Screen (Dashboard)
* **UI:** Bento Grid layout. Live BUG's counter at the top right. Quick action buttons (Add Money, Promote, Refer).
* **State:**
  * **Top Banner:** Slides VIP premium tasks (2x rewards, is_vip=true, black/peach styling).
  * **Middle Grid:** Standard tasks (colored pastels).
  * **Bottom List:** Mini-ledger of the last 6 transactions.
* **Flow:** Tapping a task card → Routes to **TaskScreen** (stack overlay).

### 2.2. Wallet Screen (The Economy)
* **UI:** Massive balance card (Bento Lime). Full historical transaction ledger with type icons and amounts.
* **Flow (Top-Up):** User taps "Add Money" → Sees UPI QR Code & ID (`8955833538@axl`) → Pays via UPI App → Taps "Submit Proof" → Uploads screenshot & UTR number → Status becomes `Pending Admin Review`.
* **Transaction Types shown:** `earn`, `reward`, `spend`, `topup`, `refund` — each with distinct color/icon.

### 2.3. Referral Screen
* **UI:** Displays user's unique referral code. Share & copy to clipboard.
* **Flow:** Fetches real `referral_code` from `/api/referrals`. User shares code with friends. When referred user completes first approved task → Referrer gets **5 BUG's** automatically.

### 2.4. Request Promotion Screen (The Burn)
* **UI:** Form with video URL, MCQ creation (question + 4 options + 1 correct answer), and tier selector.
* **Tiers:**
  * **Standard:** 49 BUG's — Regular placement in task list.
  * **VIP:** 200 BUG's — VIP banner on top of HomeScreen with 2x reward for workers.
* **Flow:** Submit → Backend atomically deducts BUG's + creates `pending` promotion → Admin reviews → On approval, promotion becomes a live task.

### 2.5. Profile Screen (Settings & Identity)
* **UI:** Avatar, Username, Email, Points balance, referral code.
* **Flow:**
  * **Referral Link:** Copy to clipboard.
  * **My Proofs:** Navigate to `MyProofsScreen` to see submission history.
  * **Switch to Admin:** If `user.email === admin@subko.app`, reveals a toggle to swap the entire app layout to the Admin Stack.
  * **Logout:** Flushes token + Zustand state, redirects to Auth Stack.

---

## 3. THE EXECUTION FLOWS

### 3.1. Task Execution (The Work)
* **Screen:** `TaskScreen`
* **Flow:**
  1. User sees Video Thumbnail, Title, Reward, Required Watch Time, Platform badge.
  2. Taps "Start Task" → `POST /api/tasks/:id/start` → Server logs `started_at` in `task_sessions`.
  3. Video opens in WebView (in-app) or external browser. Cosmetic countdown timer ticks down.
  4. Timer hits 0 → MCQ question unlocks.
  5. User selects MCQ answer → Taps "Submit Proof" → Routes to `SubmitProofScreen`.

### 3.2. Submit Proof (The Evidence)
* **Screen:** `SubmitProofScreen`
* **Flow:**
  1. User picks a screenshot from gallery via `expo-image-picker`.
  2. `expo-crypto` computes SHA-256 hash of the image **before upload**.
  3. Screenshot uploaded to Supabase Storage `screenshots` bucket.
  4. `POST /api/tasks/:id/submit` sends: `screenshot_url`, `image_hash`, `mcq_answer`.
  5. Backend validates: (A) elapsed time ≥ `required_watch_time`, (B) hash not duplicate, (C) MCQ correct.
  6. Success → Submission enters `pending` state → Admin reviews → Routes back to Home.

### 3.3. My Proofs (The History)
* **Screen:** `MyProofsScreen`
* **Flow:** Fetches user's submission history from `/api/proofs/my`. Shows status (pending/approved/rejected), task title, screenshot thumbnail, and timestamps.

---

## 4. THE ADMIN STACK
*Flat, ruthless efficiency. 5 dedicated screens, each focused on one domain.*

### 4.1. Analytics Screen (Overview)
* **UI:** High-density metrics — Total Users, BUG's in Circulation, Pending Submissions, Pending Payments.
* **Chart:** Dual-bar economy chart (Earned vs Spent). Toggle between Daily (7 days), Weekly (4 weeks), Monthly (6 months).
* **Export:** "Copy CSV Ledger" — exports last 30 days of transactions as CSV to clipboard.

### 4.2. Users Screen (Identity Control)
* **UI:** Search bar (search by email or username) + user cards.
* **Flow:** Tap user → See balance, status, email, referral code. "Ban User" / "Unban User" toggle. All bans logged in `logs` table.

### 4.3. Reviews Screen (Moderation Queue)
* **Tabs:** Submissions | Promotions
* **Flow (Submissions):** See user screenshot, MCQ answer, task title, username → **Approve** (triggers atomic credit + potential 5 BUG referral bounty) or **Reject**.
* **Flow (Promotions):** Review video URL, MCQ, tier → **Approve** (creates live task in `tasks` table) or **Reject** (triggers atomic refund of 49 or 200 BUG's).

### 4.4. Payments Screen (Money Gate)
* **UI:** Pending UPI recharge requests.
* **Flow:** See UTR number, amount, user, screenshot → **Confirm Payment** (mints new BUG's via `credit_points` RPC) or **Reject**.

### 4.5. Tools Screen (Admin Power)
* **Sub-tabs:** Create Task | Manage Tasks | Credit User | System Logs
* **Create Task:** Publish a new task directly (title, video URL, MCQ, reward, watch time, VIP flag, thumbnail banner).
* **Manage Tasks:** List all tasks, toggle active/paused, delete tasks.
* **Credit User:** Search user → Manually credit or debit BUG's with description.
* **System Logs:** View anti-cheat logs (duplicate hashes, ban events, etc.).
* **Exit Admin Mode:** Toggle back to normal user view.

---

## 5. THE DEATH STATE

### 5.1. Banned Screen
* **Trigger:** Any API call returns HTTP 403.
* **UI:** Stark screen with warning message. "Your account has been suspended for violating Terms of Service."
* **State:** Back button disabled. Tab bar hidden. Only action: **Logout**.
* **How:** Axios interceptor globally catches 403 → Updates Zustand `user.status = 'banned'` → React Navigation unmounts all stacks and mounts `BannedScreen`.

---

## 6. THE ECONOMY FLOWS

### 6.1. BUG's Earning Paths
| Path | Amount | Trigger |
|------|--------|---------|
| Standard task approved | `reward_points` | Admin approves submission |
| VIP task approved | `reward_points × 2` | Admin approves VIP submission |
| Referral bounty | 5 BUG's | Referred user's first approved task |
| Manual credit (admin) | Variable | Admin credits via Tools screen |
| UPI top-up | Amount paid | Admin approves payment_request |

### 6.2. BUG's Spending Paths
| Path | Cost | Trigger |
|------|------|---------|
| Standard Promotion | 49 BUG's | User submits promotion request |
| VIP Promotion | 200 BUG's | User submits VIP promotion request |

### 6.3. Refund Paths
| Event | Refund |
|-------|--------|
| Admin rejects promotion | Full refund (49 or 200 BUG's) |
