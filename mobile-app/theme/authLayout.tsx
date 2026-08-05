import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TextInputProps,
} from 'react-native';
import { AppTextInput, InputBox, inputStyles } from './inputs';
import { COPY } from './copy';
import { Ionicons } from '@expo/vector-icons';
import {
  colors, typography, spacing, radii, shadows, fontFamily, animation,
} from './designSystem';
import { AnimatedPressable } from './animations';
import { LinearGradient } from 'expo-linear-gradient';

export function useAuthEntrance(delay = 0) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const runAnim = () => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: animation.duration.normal, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, ...animation.spring.soft, useNativeDriver: true }),
      ]).start();
    };

    if (delay > 0) {
      const t = setTimeout(runAnim, delay);
      return () => clearTimeout(t);
    } else {
      runAnim();
    }
  }, [delay]);

  return { fade, slide };
}

export function AuthBackButton({ onPress }: { onPress: () => void }) {
  return (
    <AnimatedPressable style={authStyles.backBtn} onPress={onPress} scaleTo={animation.pressScale}>
      <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
    </AnimatedPressable>
  );
}

export function AuthHeader({ title, subtitle, delay = 0 }: { title: string; subtitle?: string; delay?: number }) {
  const { fade, slide } = useAuthEntrance(delay);
  return (
    <Animated.View style={[authStyles.header, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <Text style={authStyles.title}>{title}</Text>
      {!!subtitle && <Text style={authStyles.subtitle}>{subtitle}</Text>}
    </Animated.View>
  );
}

export function AuthInputField({
  label,
  icon,
  delay = 0,
  ...inputProps
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  delay?: number;
} & TextInputProps) {
  const { fade, slide } = useAuthEntrance(delay);
  return (
    <Animated.View style={[authStyles.inputWrapper, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <Text style={authStyles.inputLabel}>{label}</Text>
      <InputBox auth>
        <Ionicons name={icon} size={20} color={colors.textMuted} style={inputStyles.icon} />
        <AppTextInput variant="flat" style={authStyles.input} {...inputProps} />
      </InputBox>
    </Animated.View>
  );
}

export function AuthFooterLink({
  text,
  linkText,
  onPress,
}: {
  text: string;
  linkText: string;
  onPress: () => void;
}) {
  return (
    <View style={authStyles.footer}>
      <Text style={authStyles.footerText}>{text}</Text>
      <AnimatedPressable onPress={onPress}>
        <Text style={authStyles.footerLink}>{linkText}</Text>
      </AnimatedPressable>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 52, 31, 0.06)', // Modern translucent circle
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  header: {
    marginTop: spacing[4],
    marginBottom: spacing[6],
  },
  title: {
    fontFamily,
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: typography.tracking.tight,
    marginBottom: spacing[2],
  },
  subtitle: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
    lineHeight: 22,
  },
  inputWrapper: {
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  inputLabel: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing[1],
  },
  input: {
    flex: 1,
    minHeight: 24,
  },
  primaryBtn: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[6],
  },
  primaryBtnText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.black,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[10],
    paddingVertical: spacing[4],
    gap: 4,
  },
  footerText: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  footerLink: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[6],
    gap: spacing[4],
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[4],
    marginBottom: spacing[4],
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

/** Decorative background with repositioned stars — kept light so form fields remain clear */
export function AuthDecorativeBg() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {/* Top right floating pill */}
      <View style={{ position: 'absolute', top: 32, right: 28, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.peach, opacity: 0.45 }} />
      {/* Left side lavender bar with updated darker purple */}
      <View style={{ position: 'absolute', top: 72, left: 16, width: 56, height: 10, borderRadius: 5, backgroundColor: colors.lavender, opacity: 0.5, transform: [{ rotate: '-15deg' }] }} />
      {/* Star elements in distinct locations */}
      <View style={{ position: 'absolute', top: 50, left: 140 }}>
        <Text style={{ color: 'rgba(22, 18, 15, 0.25)', fontSize: 18 }}>✦</Text>
      </View>
      <View style={{ position: 'absolute', top: 120, right: 36 }}>
        <Text style={{ color: 'rgba(22, 18, 15, 0.2)', fontSize: 22 }}>✦</Text>
      </View>
    </View>
  );
}

export function AdminHeroCard({ username }: { username?: string }) {
  const { fade, slide } = useAuthEntrance(80);
  return (
    <Animated.View style={[adminStyles.heroCardOuter, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <View style={[adminStyles.heroCard, { backgroundColor: colors.blue }]}>
        <View style={adminStyles.heroInner}>
          <View style={[adminStyles.heroBadge, { backgroundColor: colors.white }]}>
            <Ionicons name="shield-checkmark" size={14} color={colors.black} />
            <Text style={[adminStyles.heroBadgeText, { color: colors.black }]}>ADMIN</Text>
          </View>
          <Text style={[adminStyles.heroTitle, { color: colors.white }]}>Welcome{username ? `, ${username}` : ''}</Text>
          <Text style={[adminStyles.heroSub, { color: 'rgba(255,255,255,0.75)' }]}>{COPY.profile.compliance}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export const adminStyles = StyleSheet.create({
  heroCardOuter: {
    marginHorizontal: spacing[6],
    marginBottom: spacing[6],
  },
  heroCard: {
    borderRadius: radii['2xl'],
    padding: spacing[6],
    ...shadows.md,
  },
  heroInner: {
    flex: 1,
    justifyContent: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    marginBottom: spacing[3],
  },
  heroBadgeText: {
    fontFamily,
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  heroTitle: {
    fontFamily,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  heroSub: {
    fontFamily,
    fontSize: typography.size.sm,
    color: 'rgba(0,0,0,0.65)',
    marginTop: spacing[1],
  },
});
