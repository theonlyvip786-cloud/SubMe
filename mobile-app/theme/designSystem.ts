// ============================================================
// SubKo Design System — Reference UI (Bento / Pastel Fintech)
// Matches Jim ØD Studio reference: lime, lavender, peach, blue, pink
// ============================================================

import { Platform } from 'react-native';

// Color Palette (exact reference hex values)
// -----------------------------------------------------------
export const colors = {
  bgPrimary: '#FAF9F6', // Screen canvas (parchment)
  bgSecondary: '#F3F4EE', // Secondary backdrop / tab bar backdrop
  bgDark: '#16120F', // Obsidian black background
  tabBar: '#FFFFFF', // White tab bar

  textPrimary: '#16120F', // Clean dark charcoal text
  textSecondary: 'rgba(22, 18, 15, 0.85)',
  textMuted: 'rgba(22, 18, 15, 0.6)',
  textWhite: '#FAF9F6', // Swapped parchment white text
  textOnMint: '#16120F',

  lime: '#C6F277', // Bento Lime/Mint
  yellow: '#FFC72C', // Coins accent yellow
  lavender: '#C4B5FD', // Darkened Pastel Lavender (Rich Purple)
  peach: '#FFD6AF', // Warm Peach
  blue: '#2A6CFF', // Accent Royal Blue
  pink: '#FFB7D5', // Y2K Baby Pink

  accent: '#C6F277',
  primary: '#C6F277',
  secondary: '#FFD6AF',
  success: '#C6F277',
  error: '#FF3399',
  warning: '#FFD6AF',

  accentDark: '#16120F',
  mint: '#C6F277',
  border: 'rgba(22, 18, 15, 0.1)', // Soft modern light grey border
  exchangeBtn: '#F3F4EE',

  white: '#FFFFFF', // Component cards & inputs background
  black: '#16120F',
  charcoal: '#16120F',
  transparent: 'transparent',
};


// Geometric sans-serif stack (Inter / Poppins style)
// -----------------------------------------------------------
export const fontFamily = Platform.select({
  web: 'Inter, Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) as string;

export const typography = {
  family: {
    regular: fontFamily,
    bold: fontFamily,
  },
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 22,
    '2xl': 28,
    '3xl': 34,
    '4xl': 42,
    '5xl': 52,
  } as const,

  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '800' as const,
  } as const,

  leading: {
    tight: 1.1,
    snug: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  } as const,

  tracking: {
    tight: -0.8,
    normal: 0,
    wide: 0.4,
  } as const,
};

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  none: 0,
  xs: 6,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const tabBarMetrics = {
  height: 84,
  indicatorSize: 44,
  indicatorRadius: 8,
  barRadius: 16,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const animation = {
  spring: {
    soft: { tension: 50, friction: 8, useNativeDriver: true },
    medium: { tension: 120, friction: 12, useNativeDriver: true },
    stiff: { tension: 180, friction: 14, useNativeDriver: true },
    tab: { tension: 140, friction: 16, useNativeDriver: true },
  } as const,

  duration: {
    fast: 180,
    normal: 280,
    slow: 480,
    slower: 650,
  } as const,

  stagger: {
    fast: 50,
    normal: 70,
    slow: 100,
  } as const,

  pressScale: 0.95,
};

export const sharedStyles = {
  screen: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },

  headerTitle: {
    fontFamily,
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: typography.tracking.tight,
  },

  sectionTitle: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },

  primaryButton: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.lime,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    ...shadows.md,
  },

  primaryButtonText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },

  card: {
    borderRadius: radii['2xl'],
    backgroundColor: colors.white,
    padding: spacing[6],
    ...shadows.md,
  },

  darkCard: {
    borderRadius: radii['2xl'],
    backgroundColor: colors.bgDark,
    padding: spacing[6],
  },
};

export default {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  animation,
  sharedStyles,
  fontFamily,
  tabBarMetrics,
};
