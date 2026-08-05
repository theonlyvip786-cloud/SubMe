/**
 * PaymentPermissionModal
 *
 * Shown ONCE on Wallet screen open (stored in AsyncStorage).
 * Requests SMS read permission so we can auto-detect UPI payments.
 * Also shows a guide to enable payment app notifications manually
 * (we cannot programmatically enable other apps' notifications — OS restriction).
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, radii, shadows, fontFamily } from './designSystem';
import { requestSmsPermission } from '../lib/useSmsReader';

const PERMISSION_SHOWN_KEY = 'subme_payment_permission_v1';

export async function shouldShowPermissionModal(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PERMISSION_SHOWN_KEY);
    return val !== 'shown';
  } catch {
    return false;
  }
}

export async function markPermissionModalShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_SHOWN_KEY, 'shown');
  } catch {}
}

interface Props {
  visible: boolean;
  onDone: () => void;
}

const PAYMENT_APPS = [
  { name: 'PhonePe', icon: 'phone-portrait-outline' as const, color: '#5f259f' },
  { name: 'Google Pay', icon: 'logo-google' as const, color: '#4285f4' },
  { name: 'Paytm', icon: 'wallet-outline' as const, color: '#00b9f1' },
  { name: 'BHIM', icon: 'shield-checkmark-outline' as const, color: '#0c4b8e' },
];

export default function PaymentPermissionModal({ visible, onDone }: Props) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleAllow = async () => {
    console.log('[PaymentPermissionModal] handleAllow pressed');
    try {
      await requestSmsPermission();
    } catch (e) {
      console.warn('[PaymentPermissionModal] SMS permission request failed:', e);
    }

    try {
      await markPermissionModalShown();
    } catch (e) {
      console.warn('[PaymentPermissionModal] Failed to mark permission shown:', e);
    }

    // Always close modal even if permission fails/errors
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    
    // Ensure onDone fires even if animations are skipped on web
    setTimeout(() => {
      console.log('[PaymentPermissionModal] onDone callback firing');
      onDone();
    }, 200);
  };

  const handleSkip = async () => {
    console.log('[PaymentPermissionModal] handleSkip pressed');
    try {
      await markPermissionModalShown();
    } catch (e) {
      console.warn('[PaymentPermissionModal] Failed to mark permission shown in skip:', e);
    }

    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    setTimeout(() => {
      onDone();
    }, 200);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: spacing[8] }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Ionicons name="flash" size={28} color={colors.black} />
              </View>
              <Text style={styles.title}>Enable Instant Payments</Text>
              <Text style={styles.subtitle}>
                Allow SubMe to read your bank SMS so your UPI payments are verified{' '}
                <Text style={styles.highlight}>instantly</Text> — no waiting, no screenshots!
              </Text>
            </View>

            {/* How it works */}
            <View style={styles.steps}>
              {[
                { icon: 'cash-outline' as const, text: 'You pay via any UPI app' },
                { icon: 'chatbubble-ellipses-outline' as const, text: 'Your bank sends a payment SMS' },
                { icon: 'checkmark-circle' as const, text: 'SubMe reads it and auto-verifies', highlight: true },
                { icon: 'wallet' as const, text: "BUG's credited instantly! 🎉", highlight: true },
              ].map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={[styles.stepIcon, step.highlight && styles.stepIconActive]}>
                    <Ionicons
                      name={step.icon}
                      size={18}
                      color={step.highlight ? colors.black : colors.textMuted}
                    />
                  </View>
                  <Text style={[styles.stepText, step.highlight && styles.stepTextActive]}>
                    {step.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Payment app icons */}
            <Text style={styles.sectionLabel}>Works with all UPI apps</Text>
            <View style={styles.appsRow}>
              {PAYMENT_APPS.map((app) => (
                <View key={app.name} style={styles.appChip}>
                  <Ionicons name={app.icon} size={16} color={app.color} />
                  <Text style={styles.appName}>{app.name}</Text>
                </View>
              ))}
            </View>

            {/* Notification guide */}
            <View style={styles.notifGuide}>
              <Ionicons name="notifications-outline" size={16} color={colors.textMuted} />
              <Text style={styles.notifText}>
                <Text style={{ fontWeight: '700' }}>Tip: </Text>
                Also enable notifications for PhonePe, GPay, Paytm in{' '}
                <Text style={{ fontWeight: '700' }}>Settings → Apps → Notifications</Text>{' '}
                for even faster detection.
              </Text>
            </View>

            {/* Privacy note */}
            <View style={styles.privacyRow}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
              <Text style={styles.privacyText}>
                We only read payment SMS. No personal messages are accessed or stored.
              </Text>
            </View>

            {/* Buttons */}
            <TouchableOpacity style={styles.allowBtn} onPress={handleAllow} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={20} color={colors.black} />
              <Text style={styles.allowBtnText}>Allow & Enable Auto-Verify</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Skip — I'll enter UTR manually</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(22,18,15,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[6],
    maxHeight: '90%',
    ...shadows.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
    ...shadows.md,
  },
  title: {
    fontFamily,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[2],
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing[2],
  },
  highlight: {
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
  },
  steps: {
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepIconActive: {
    backgroundColor: colors.lime,
  },
  stepText: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    flex: 1,
  },
  stepTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
  },
  sectionLabel: {
    fontFamily,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing[3],
  },
  appsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  appName: {
    fontFamily,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  notifGuide: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
    alignItems: 'flex-start',
  },
  notifText: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    marginBottom: spacing[5],
    paddingHorizontal: spacing[1],
  },
  privacyText: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  allowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.lime,
    borderRadius: radii.xl,
    paddingVertical: spacing[4],
    marginBottom: spacing[3],
    ...shadows.md,
  },
  allowBtnText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.black,
    color: colors.black,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  skipBtnText: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
});
