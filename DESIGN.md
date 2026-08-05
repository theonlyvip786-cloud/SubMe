# UI/UX BRIEF & DESIGN SYSTEM
**Project:** SubKo — Creator Promotion & Video Feedback Rewards
**Aesthetic:** Y2K Bento Grid / Pastel Fintech / Neo-Brutalist
**Last Updated:** 2026-07-18

---

## 1. THE VISUAL PHILOSOPHY
SubKo does not look like a typical "rewards" app. It looks like a high-end neo-brutalist banking app designed by a Y2K streetwear label. 

We reject flat, soulless interfaces. We embrace **tactile, playful, and trustworthy** elements. The app must feel like a premium game where the currency (BUG's) feels heavy and real.

## 2. THE CANVAS & SURFACES
* **The Parchment Canvas (`#FAF9F6`):** The absolute background. A warm off-white that makes pure white cards pop and shadow depth feel authentic.
* **Component Cards (`#FFFFFF`):** Pure white. Used strictly for lists, form inputs, and floating containers.
* **Deep Obsidian (`#16120F`):** The primary dark color. Used for: sharp solid drop shadows (neo-brutalist "layered paper" effect), boot/splash background, header text. Not blurred grey — always sharp offset shadows.

## 3. THE ACCENT PASTELS (Y2K COLOR SYSTEM)
We use vibrant pastels to guide the user's eye, never to overwhelm.
* **Y2K Baby Pink (`#FFB7D5`):** The signature brand accent. Reserved for hero cards, welcome popups, and Admin Dashboard highlights.
* **Bento Lime/Mint (`#C6F277`):** The color of money. Used for the main Wallet Balance card, primary Call-To-Action buttons, success states, and positive transaction numbers.
* **Warm Peach (`#FFD6AF`):** Used for "Promote" quick actions, Premium VIP task tags, and promotional highlights.
* **Pastel Lavender (`#E6D5FF`):** Used for "Add Money" quick actions and secondary highlights.
* **Accent Royal Blue (`#2A6CFF`):** Deep electric blue. Used for "Refer" actions, info badges, and high-priority deep-contrast highlights.

## 4. TYPOGRAPHY: EDITORIAL IMPACT
* **Scale & Weight:** Headings are massive (34px+) and ultra-bold (800). We apply tight letter-spacing (-0.8) and tight leading (1.1) so headers look like editorial posters.
* **Case Logic:** We use Title Case for section headers to remain friendly. We absolutely reject standard all-caps screaming, EXCEPT for tiny, high-contrast structural badges (e.g., `PREMIUM`, `VIP`, `TASK`).
* **Numbers:** Account balances and transaction amounts use the heaviest font weight available (900) with tight tracking. A user's money should look bold and impactful.
* **Font Stack:** `Inter` (primary) → `Poppins` → `-apple-system` → `BlinkMacSystemFont` → `Segoe UI` → `sans-serif`.

## 5. BENTO GRID ARCHITECTURE
We do not build endless, structureless scrolling lists. We build compartments.
* **The Grid:** The HomeScreen is composed of distinct Bento Box cards. A wide banner for VIP tasks. A solid block for quick actions. A mini-ledger section at the bottom.
* **The Buttons:** Quick action buttons (96×84px approx) are perfect rounded rectangles with 16px radius. Icons are centered; text sits cleanly at the bottom.
* **The Cards:** Balance cards do not have borders. They float via solid background colors (Pink, Lime, Peach) and sharp black offset shadows (4px offset, no blur).

## 6. THE ANIMATION LAYER (MICRO-INTERACTIONS)
Static apps are dead apps. SubKo breathes.

* **The Press (`AnimatedPressable`):** Every button and card uses `AnimatedPressable` from `theme/animations.tsx`. When a user taps, the element physically compresses down (scale `0.96`) and springs back on release using `Animated.spring`.
* **The Entrance (`StaggeredItem`, `useCardAnimation`):** Forms and lists stagger in. We use spring physics (`tension: 80, friction: 6`) so elements slide up and fade in smoothly when a screen mounts.
* **The Celebration (`Y2KCelebrationOverlay`):** On successful login or signup, a massive `Y2KCelebrationOverlay` triggers, blasting sparkles across the screen, turning a standard auth flow into a dopamine hit.
* **Tab Bar Indicator:** The bottom tab bar has a sliding lime-green indicator pill that springs to the active tab position using `Animated.spring`.

## 7. THEME COMPONENTS CATALOG
All reusable UI components live in `mobile-app/theme/`.

| Component | File | Usage |
|-----------|------|-------|
| `AnimatedPressable` | `animations.tsx` | Wrap any pressable element for spring-press effect |
| `StaggeredItem` | `animations.tsx` | Wrap list items for staggered entrance animation |
| `useCardAnimation` | `animations.tsx` | Hook for card slide-up + fade entrance |
| `AppTextInput` | `inputs.tsx` | Styled text input with consistent appearance |
| `InputBox` | `inputs.tsx` | Container wrapper for inputs (provides border/bg) |
| `CustomBottomTabBar` | `BottomTabBar.tsx` | Full custom animated Y2K bottom tab bar |
| `Y2KAlertPopup` | `Y2KAlertPopup.tsx` | Custom Y2K-styled modal alert (replaces native Alert) |
| `Y2KCelebrationOverlay` | `Y2KCelebrationOverlay.tsx` | Full-screen sparkle burst animation on success |
| `Y2KCharacter` | `Y2KCharacter.tsx` | Animated Y2K mascot character with multiple expressions |
| `Y2KCoin` | `Y2KCoin.tsx` | Animated BUG's coin icon with bounce/spin effects |
| `Y2KNote` | `Y2KNote.tsx` | Y2K sticky note UI element for tips/info |
| `authLayout` | `authLayout.tsx` | Shared wrapper for all auth screens (gradient, safe area) |

## 8. TAB BAR ICONS (IONICONS)
The custom `BottomTabBar.tsx` maps screen names to Ionicons:

| Tab Name | Active Icon | Inactive Icon |
|----------|-------------|---------------|
| Home | `home` | `home-outline` |
| Wallet | `wallet` | `wallet-outline` |
| Refer | `swap-horizontal` | `swap-horizontal-outline` |
| Promote | `megaphone` | `megaphone-outline` |
| Profile | `person` | `person-outline` |
| Analytics | `grid` | `grid-outline` |
| Reviews | `eye` | `eye-outline` |
| Payments | `cash` | `cash-outline` |
| Tools | `construct` | `construct-outline` |
| Users | `people` | `people-outline` |

---
*If it doesn't look like it belongs in an art gallery and perform like it belongs on Wall Street, rewrite it.*
