import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import useAuthStore from '../store/useAuthStore';
import { colors, typography, spacing, radii, fontFamily, animation, shadows } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import { COPY } from '../theme/copy';
import Y2KNote from '../theme/Y2KNote';
import Y2KAlertPopup from '../theme/Y2KAlertPopup';

const { width: SCREEN_W } = Dimensions.get('window');

const HERO_LINES = COPY.welcome.lines.map((text, i) => ({
  text,
  accent: i === COPY.welcome.lines.length - 1,
}));

function HeroLine({ line, index }: { line: (typeof HERO_LINES)[number]; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay: 400 + index * 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: 400 + index * 80,
        ...animation.spring.medium,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.Text
      style={[
        line.accent ? styles.heroAccent : styles.heroLine,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {line.text}
    </Animated.Text>
  );
}

export default function WelcomeScreen({ navigation }: any) {
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaSlide = useRef(new Animated.Value(40)).current;
  
  // Floating Animations for elements
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  const floatAnim4 = useRef(new Animated.Value(0)).current;
  const floatAnim5 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Footer entrance
    Animated.parallel([
      Animated.timing(ctaOpacity, { toValue: 1, duration: 500, delay: 300, useNativeDriver: true }),
      Animated.spring(ctaSlide, { toValue: 0, delay: 300, ...animation.spring.soft, useNativeDriver: true }),
    ]).start();

    // Floating loop animations
    const createFloatLoop = (anim: Animated.Value, duration: number, delay = 0) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
    };

    createFloatLoop(floatAnim1, 2000, 0).start();
    createFloatLoop(floatAnim2, 2400, 200).start();
    createFloatLoop(floatAnim3, 2800, 400).start();
    createFloatLoop(floatAnim4, 2200, 100).start();
    createFloatLoop(floatAnim5, 2600, 300).start();
  }, []);

  // Map float values to TranslateY ranges
  const y1 = floatAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const y2 = floatAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const y3 = floatAnim3.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const y4 = floatAnim4.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const y5 = floatAnim5.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });

  const user = useAuthStore(s => s.user);
  const pendingReferralCode = useAuthStore(s => s.pendingReferralCode);
  const userCode = user?.referral_code || (user?.id ? user.id.replace(/-/g, '').toUpperCase() : null);
  const landingPageUrl = 'https://subme-landing-page.vercel.app/';
  const userReferralLink = userCode ? `${landingPageUrl}?ref=${userCode}` : null;

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupDesc, setPopupDesc] = useState('');

  const copyCode = async () => {
    if (userCode) {
      await Clipboard.setStringAsync(userCode);
      setPopupTitle('Referral Code Copied!');
      setPopupDesc(`Your unique referral code (${userCode}) was copied to clipboard. Share it to earn 5 BUG's per friend!`);
      setPopupVisible(true);
    }
  };

  const copyLink = async () => {
    if (userReferralLink) {
      await Clipboard.setStringAsync(userReferralLink);
      setPopupTitle('Referral Link Copied!');
      setPopupDesc('Your invitation link is ready. Send it to anyone to invite them!');
      setPopupVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#3C0764', '#5B21B6', '#8B5CF6', '#FAF9F6']}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.content}>
        
        {/* Dynamic Scattered Graphics Area */}
        <View style={styles.graphicsArea}>
          
          {/* 1. Youtube Play Badge (Medium Card) */}
          <Animated.View style={[styles.floatingElement, styles.ytCardWrap, { transform: [{ translateY: y1 }] }]}>
            <View style={styles.neobrutalCard}>
              <View style={styles.ytIconBg}>
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
              </View>
              <Text style={styles.elementText}>Watch</Text>
            </View>
          </Animated.View>

          {/* 2. Overlapping Rupee Y2KNotes (Large Stack) */}
          <Animated.View style={[styles.floatingElement, styles.notesWrap, { transform: [{ translateY: y2 }] }]}>
            <View style={styles.noteStack}>
              {/* Back rotated note */}
              <Y2KNote size={38} style={[styles.noteBack, { transform: [{ rotate: '-15deg' }] }]} />
              {/* Front note */}
              <Y2KNote size={44} style={styles.noteFront} />
            </View>
          </Animated.View>

          {/* 3. Feedback/Approved Shield Badge (Small/Medium Card) */}
          <Animated.View style={[styles.floatingElement, styles.checkCardWrap, { transform: [{ translateY: y3 }] }]}>
            <View style={[styles.neobrutalCard, styles.greenCard, { paddingHorizontal: 10, paddingVertical: 6 }]}>
              <View style={[styles.checkIconBg, { width: 28, height: 28, borderRadius: 14 }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.textPrimary} />
              </View>
              <Text style={[styles.elementText, { fontSize: 12 }]}>Review</Text>
            </View>
          </Animated.View>

          {/* 4. BUG Gold Coin (Large Coin) */}
          <Animated.View style={[styles.floatingElement, styles.coinLargeWrap, { transform: [{ translateY: y4 }] }]}>
            <View style={styles.neobrutalCoinLarge}>
              <Text style={styles.coinSymLarge}>★</Text>
            </View>
          </Animated.View>

          {/* 5. BUG Gold Coin (Small Coin) */}
          <Animated.View style={[styles.floatingElement, styles.coinSmallWrap, { transform: [{ translateY: y5 }] }]}>
            <View style={styles.neobrutalCoinSmall}>
              <Text style={styles.coinSymSmall}>★</Text>
            </View>
          </Animated.View>

          {/* 6. BUG Gold Coin (Medium Coin) */}
          <Animated.View style={[styles.floatingElement, styles.coinMediumWrap, { transform: [{ translateY: y1 }] }]}>
            <View style={styles.neobrutalCoinMedium}>
              <Text style={styles.coinSymMedium}>★</Text>
            </View>
          </Animated.View>

          {/* Sparkles / Y2K White Stars in new distinct positions */}
          <View style={[styles.sparkle, { top: 75, left: 35 }]}>
            <Text style={[styles.sparkleTxt, { fontSize: 24 }]}>✦</Text>
          </View>
          <View style={[styles.sparkle, { top: 235, right: 30 }]}>
            <Text style={[styles.sparkleTxt, { fontSize: 18, color: colors.yellow }]}>✦</Text>
          </View>
          <View style={[styles.sparkle, { top: 125, right: 145 }]}>
            <Text style={[styles.sparkleTxt, { fontSize: 20 }]}>✦</Text>
          </View>
          <View style={[styles.sparkle, { top: 310, left: 165 }]}>
            <Text style={[styles.sparkleTxt, { fontSize: 22 }]}>✦</Text>
          </View>
          <View style={[styles.sparkle, { top: 25, right: 40 }]}>
            <Text style={[styles.sparkleTxt, { fontSize: 16 }]}>✦</Text>
          </View>

        </View>

        {/* User Referral Card / Pending Referral Invite Badge */}
        {userCode ? (
          <View style={styles.referralBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.refBannerTitle}>Your Referral Code: <Text style={{ color: colors.black }}>{userCode}</Text></Text>
              <Text style={styles.refBannerSub} numberOfLines={1}>{userReferralLink}</Text>
            </View>
            <TouchableOpacity style={styles.refCopyBtn} onPress={copyCode}>
              <Ionicons name="copy-outline" size={14} color={colors.black} />
              <Text style={styles.refCopyTxt}>Copy Code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.refCopyBtn, { backgroundColor: colors.lime }]} onPress={copyLink}>
              <Ionicons name="link-outline" size={14} color={colors.black} />
              <Text style={styles.refCopyTxt}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        ) : pendingReferralCode ? (
          <View style={[styles.referralBanner, { backgroundColor: colors.lime }]}>
            <Ionicons name="gift" size={18} color={colors.black} style={{ marginRight: 6 }} />
            <Text style={styles.refBannerTitle}>Invited by referral code: <Text style={{ fontWeight: '800' }}>{pendingReferralCode}</Text></Text>
          </View>
        ) : null}

        {/* Hero copy — lower half, left aligned, shifted slightly downward */}
        <View style={styles.heroBlock}>
          {HERO_LINES.map((line, i) => (
            <HeroLine key={line.text} line={line} index={i} />
          ))}
        </View>

        {/* CTA — shifted downward */}
        <View style={styles.footer}>
          <Animated.View style={{ opacity: ctaOpacity, transform: [{ translateY: ctaSlide }] }}>
            <AnimatedPressable
              style={styles.ctaBtn}
              onPress={() => navigation.navigate('SignUp')}
              scaleTo={animation.pressScale}
            >
              <Text style={styles.ctaText}>{COPY.welcome.cta}</Text>
            </AnimatedPressable>
          </Animated.View>

          <AnimatedPressable
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
            scaleTo={animation.pressScale}
          >
            <Text style={styles.loginText}>
              {COPY.welcome.login}{' '}
              <Text style={styles.loginHighlight}>{COPY.welcome.loginLink}</Text>
            </Text>
          </AnimatedPressable>
        </View>

        <Y2KAlertPopup
          visible={popupVisible}
          onClose={() => setPopupVisible(false)}
          characterType="joyful"
          title={popupTitle}
          description={popupDesc}
          actionText="Got It!"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
  },
  graphicsArea: {
    flex: 1.4,
    position: 'relative',
    minHeight: 320,
    marginTop: spacing[8],
  },
  floatingElement: {
    position: 'absolute',
  },
  // Scattered Positions matching the playful nature of previous shapes
  ytCardWrap: {
    top: 30,
    left: 20,
    zIndex: 4,
  },
  notesWrap: {
    top: 70,
    right: 25,
    zIndex: 3,
  },
  checkCardWrap: {
    top: 220,
    left: 15,
    zIndex: 4,
  },
  coinLargeWrap: {
    top: 210,
    right: 45,
    zIndex: 5,
  },
  coinSmallWrap: {
    top: 150,
    left: 130,
    zIndex: 5,
  },
  coinMediumWrap: {
    top: 20,
    right: 170,
    zIndex: 5,
  },
  neobrutalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.1)',
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadows.md,
  },
  greenCard: {
    backgroundColor: colors.lime,
  },
  ytIconBg: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
  },
  checkIconBg: {
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
  },
  elementText: {
    fontFamily,
    fontSize: 13,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  elementSubText: {
    fontFamily,
    fontSize: 10,
    color: 'rgba(22, 18, 15, 0.6)',
  },
  elementBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginLeft: 6,
  },
  elementBadgeText: {
    fontFamily,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  // Floating Coin Stack Container
  floatingCoinsContainer: {
    width: 140,
    height: 80,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinPos1: {
    position: 'absolute',
    left: 45,
    top: 15,
    zIndex: 3,
  },
  coinPos2: {
    position: 'absolute',
    left: 20,
    top: 25,
    zIndex: 2,
  },
  coinPos3: {
    position: 'absolute',
    left: 8,
    top: 0,
  },
  noteStack: {
    position: 'relative',
    width: 100,
    height: 80,
  },
  noteBack: {
    position: 'absolute',
    left: -8,
    top: 8,
    opacity: 0.85,
  },
  noteFront: {
    position: 'absolute',
    left: 8,
    top: 0,
  },
  // Large Coin
  neobrutalCoinLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  coinSymLarge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
  },
  // Medium Coin
  neobrutalCoinMedium: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  coinSymMedium: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.black,
  },
  // Small Coin
  neobrutalCoinSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.yellow,
    borderWidth: 1.5,
    borderColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  coinSymSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.black,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleTxt: {
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  heroBlock: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: spacing[6],
    paddingBottom: spacing[4],
    marginTop: spacing[4],
    zIndex: 2,
  },
  heroLine: {
    fontFamily,
    fontSize: Math.min(typography.size['4xl'], 44),
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
    lineHeight: 48,
    letterSpacing: typography.tracking.tight,
  },
  heroAccent: {
    fontFamily,
    fontSize: Math.min(typography.size['4xl'], 44),
    fontWeight: typography.weight.black,
    color: colors.primary,
    lineHeight: 48,
    letterSpacing: typography.tracking.tight,
  },
  footer: {
    paddingBottom: spacing[6],
    gap: spacing[4],
    zIndex: 2,
  },
  ctaBtn: {
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaText: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  loginText: {
    fontFamily,
    color: colors.textMuted,
    fontSize: typography.size.sm,
  },
  loginHighlight: {
    fontFamily,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  referralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginVertical: spacing[2],
    gap: spacing[2],
    ...shadows.sm,
  },
  refBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  refBannerSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  refCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: radii.md,
    gap: 4,
  },
  refCopyTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.black,
  },
});
