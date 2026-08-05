/** PRD-aligned product copy (v2.0.0) */
export const COPY = {
  appName: 'SubMe',
  currency: "BUG's",
  currencyLabel: "BUG's",
  promotionCost: 49,
  referralReward: 5,
  minTopUp: 50,

  welcome: {
    lines: [
      'Watch Videos.',
      'Earn BUGs.',
      'Promote',
      'Your Content.',
    ],
    cta: 'Start Earning',
    login: 'Already have an account?',
    loginLink: 'Log In',
  },

  home: {
    greeting: (name: string) => `Hello, ${name}`,
    subGreeting: "Watch, review & earn BUG's — no fake engagement",
    addMoney: 'Top Up',
    promote: 'Promote',
    refer: 'Refer',
    tasksTitle: 'Available Tasks',
    tasksEmpty: 'No tasks right now — check back soon',
    transactionsTitle: 'Recent Activity',
    transactionsEmpty: 'No transactions yet',
  },

  auth: {
    loginTitle: 'Welcome Back',
    loginSub: 'Sign in to continue',
    signUpTitle: 'Create Account',
    signUpSub: 'Join and start earning today',
    forgotTitle: 'Reset Password',
    forgotSub: 'We’ll email you a link to reset your password',
    adminHint: 'Admin? Sign in with admin@subme.app',
  },

  wallet: {
    title: 'Wallet',
    balanceLabel: 'Your Balance',
    topUpTitle: "Add BUG's (UPI)",
    topUpHint: '1 INR = 1 BUG · Minimum ₹50',
    utrLabel: 'UTR / Transaction ID',
    submitPayment: 'Submit Payment Proof',
  },

  promote: {
    title: 'Promote',
    costLabel: (pts: number) => `${pts} BUG's per promotion`,
    premiumCost: 200,
    vipLabel: 'Premium Banner',
    standardLabel: 'Standard Task',
    platformLabel: 'Select Platform',
    balanceLabel: 'Your Balance',
    linkLabel: 'Content URL',
    linkPlaceholder: 'Paste your YouTube or Instagram link',
    mcqLabel: 'Viewer Question (MCQ)',
    requirements: [
      'Legitimate discovery & feedback only',
      'No fake likes, subs, or comments',
      'Admin reviews every promotion request',
    ],
    payButton: (pts: number) => `Pay ${pts} BUG's`,
  },

  refer: {
    title: 'Refer & Earn',
    heroTitle: 'Invite Friends',
    heroSub: `Earn 5 BUG's when they complete their first approved task`,
    statsInvited: 'Invited',
    statsSuccess: 'Rewarded',
    copyCode: 'Copy Code',
  },

  task: {
    watchHint: 'Watch the full video, then answer the question',
    submit: 'Submit for Review',
    timerCosmetic: 'Timer is verified on the server',
  },

  profile: {
    pointsLabel: "BUG's",
    compliance: 'Real feedback only — no engagement manipulation',
  },

  banned: {
    title: 'Account Suspended',
    body: 'Your account has been restricted. Contact support if you believe this is an error.',
  },
} as const;
