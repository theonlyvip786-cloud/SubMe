# PRODUCT REQUIREMENTS DOCUMENT (PRD)
**Project:** SubKo — Creator Promotion & Video Feedback Rewards
**Version:** 3.1.0
**Status:** Live / Iterating
**Last Updated:** 2026-07-18

---

## 1. THE VISION
SubKo is not just an app; it is an **ecosystem of attention**. We solve the hardest problem for creators: genuine discovery. Users trade their time and feedback for a currency (BUG's) that holds real value. They spend that currency to hijack the attention of the network for their own content.

**The Golden Rule:** Zero fake engagement. We do not sell bots. We do not automate likes. We engineer a closed-loop economy where human attention is captured, verified, and rewarded.

## 2. THE ECONOMY (BUG's)
The lifeblood of SubKo is its internal currency. It must be airtight.
* **Peg:** 1 BUG = ₹1 INR.
* **Earning:** Users execute tasks (watch video + answer MCQ + screenshot).
  * Standard Task: Base `reward_points` (admin-set per task).
  * Premium (VIP) Task: 2x base reward on approval.
* **Spending:** Users burn BUG's to launch their own campaigns.
  * Standard Promotion: 49 BUG's → Regular slot in task list.
  * Premium VIP Banner Promotion: 200 BUG's → Top banner on HomeScreen + 2x worker reward.
* **Injecting:** Users can buy BUG's via UPI (Manual admin verification). Minimum ₹50.
* **UPI Details:** `8955833538@axl` (Name: SubKo Admin)
* **Network Effects (Referrals):** **5 BUG bounty** to the referrer, paid *only* when the referred user successfully completes their first approved task. No free money for fake signups.

## 3. THE ANTI-CHEAT MATRIX
A reward system without security is a charity. SubKo is a fortress.
* **Time Manipulation:** The server is the absolute source of truth. The mobile timer is purely cosmetic. `started_at` is locked on the backend at `POST /api/tasks/:id/start`. If a user submits before the required seconds elapse, the server rejects it. 3-second tolerance buffer for network lag.
* **Screenshot Farming:** Every image uploaded is hashed (SHA-256) on the client via `expo-crypto` before it even hits the wire. The backend checks `image_hash` against the database globally. Duplicates are flagged in `logs` and rejected immediately.
* **MCQ Verification:** Server checks submitted answer against task's `mcq_answer`. Wrong answer = automatic rejection.
* **Multi-Account Detection:** `device_links` table maps unique device IDs to user accounts. Flagged in abuse `logs`.
* **The "Banned" Trapdoor:** The moment a user is marked `banned` in the database, the API returns HTTP 403. The mobile app's Axios interceptor catches this globally and permanently locks them in a `BannedScreen`. No escape. No second chances.
* **Task Auto-Expiry:** Server-side cron runs every 30 minutes, auto-deletes tasks older than 24 hours to prevent stale tasks from accumulating.
* **Double Submission:** Database-level unique constraint on `(user_id, task_id)` in `submissions`. Impossible to submit the same task twice.

## 4. THE CORE LOOPS

### Loop A: The Worker (Earning)
1. **Discover:** User sees a Bento-grid task list on HomeScreen.
2. **Commit:** Taps task → Server locks session start time in `task_sessions`.
3. **Execute:** Watches video in WebView or external browser.
4. **Verify:** Answers a qualitative MCQ (impossible to answer without watching).
5. **Prove:** Takes screenshot → App computes SHA-256 hash → Uploads via `SubmitProofScreen`.
6. **Wait:** Submission goes to Admin review queue. Upon approval, wallet balance increases via atomic `credit_points` RPC call.

### Loop B: The Creator (Spending)
1. **Desire:** User wants views for their new video.
2. **Fund:** Checks balance on WalletScreen. If < 49 BUG's, completes tasks or pays via UPI.
3. **Deploy:** Submits video URL + custom MCQ question/answer on RequestPromotionScreen, selects tier, pays 49 or 200 BUG's atomically.
4. **Review:** Promotion enters Admin queue. Admin verifies video link and approves.
5. **Result:** Campaign goes live to all workers as a task in their HomeScreen feed.

### Loop C: The Overlord (Admin)
1. **Audit:** Admin sees a hyper-efficient 5-tab dashboard.
2. **Judge:** Approves/Rejects tasks in seconds. Rejections trigger auto-refunds. Approvals trigger auto-credits and referral bounties.
3. **Control:** Full power to manually credit BUG's, ban users, resolve UPI payments, create tasks directly, view system logs.

## 5. THE SCREENS

### Auth Screens
| Screen | Purpose |
|--------|---------|
| WelcomeScreen | Brand hero, entry point |
| LoginScreen | Email + password login |
| SignUpScreen | Registration + optional referral code |
| ForgotPasswordScreen | Request Supabase password reset email |
| ResetPasswordScreen | Set new password after magic link |

### Main User Screens (5 Bottom Tabs)
| Screen | Tab | Purpose |
|--------|-----|---------|
| HomeScreen | Home | Bento grid task feed + quick actions |
| WalletScreen | Wallet | Balance + transactions + UPI topup |
| ReferralScreen | Refer | Referral code + share |
| RequestPromotionScreen | Promote | Spend BUG's to promote content |
| ProfileScreen | Profile | Settings + admin mode toggle |

### Stack Overlay Screens (accessible from any tab)
| Screen | Purpose |
|--------|---------|
| TaskScreen | Task execution with timer + MCQ |
| SubmitProofScreen | Screenshot upload + hash computation |
| MyProofsScreen | User's submission history |

### Admin Screens (5 Bottom Tabs — Admin Mode)
| Screen | Tab | Purpose |
|--------|-----|---------|
| AdminAnalyticsScreen | Analytics | Economy charts + metrics |
| AdminUsersScreen | Users | Search + ban/unban users |
| AdminReviewsScreen | Reviews | Submission + promotion moderation |
| AdminPaymentsScreen | Payments | UPI payment approval |
| AdminToolsScreen | Tools | Create tasks + credit users + logs |

### Special Screens
| Screen | Trigger |
|--------|---------|
| BannedScreen | HTTP 403 response from any API |

## 6. SUCCESS METRICS
If we build this right, the data will show:
* **Liquidity:** High velocity of BUG's changing hands (tracked via Analytics → economy charts).
* **Retention:** Users returning daily to clear the task board.
* **Trust:** 0% duplicate screenshot exploits. 0% timer bypasses.
* **Conversion:** % of earners who become promoters (the virtuous cycle).

---
*No mediocrity. No robotic execution. This is the blueprint.*
