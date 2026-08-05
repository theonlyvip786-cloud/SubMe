import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { colors, typography, spacing, radii, shadows, fontFamily } from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';
import { COPY } from '../theme/copy';
import Y2KNote from '../theme/Y2KNote';
import Y2KAlertPopup from '../theme/Y2KAlertPopup';

export default function ReferralScreen({ navigation }: any) {
    const { token, user } = useAuthStore();
    const [referralCode, setReferralCode] = useState(user?.referral_code || '');
    const [stats, setStats] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);

    const [popupVisible, setPopupVisible] = useState(false);
    const [popupTitle, setPopupTitle] = useState('');
    const [popupDesc, setPopupDesc] = useState('');

    const refreshData = async (silent = false) => {
        if (!silent) setRefreshing(true);
        try {
            const [userRes, statsRes] = await Promise.all([
                axios.get(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/api/referrals/stats`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setReferralCode(userRes.data.referral_code);
            setStats(statsRes.data);
        } catch (e) {} finally {
            if (!silent) setRefreshing(false);
        }
    };

    useEffect(() => {
        refreshData(true);
        const unsub = navigation.addListener('focus', () => refreshData(true));
        return unsub;
    }, [navigation, token]);

    const effectiveCode = referralCode || user?.referral_code || (user?.id ? user.id.replace(/-/g, '').toUpperCase() : 'SUBME');
    const referralLink = `https://subme-landing-page.vercel.app/?ref=${effectiveCode}`;

    const copyCode = async () => {
        if (effectiveCode) {
            await Clipboard.setStringAsync(effectiveCode);
            setPopupTitle('Code Copied!');
            setPopupDesc(`Share this code with your friends to earn ${COPY.referralReward} BUG's when they complete their first watch task!`);
            setPopupVisible(true);
        }
    };

    const copyLink = async () => {
        if (referralLink) {
            await Clipboard.setStringAsync(referralLink);
            setPopupTitle('Link Copied!');
            setPopupDesc('Your personal sign-up invitation link is ready. Send it to anyone!');
            setPopupVisible(true);
        }
    };

    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(16)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 100, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Refer</Text>
                    <View style={styles.coinsBadge}>
                        <Y2KNote size={14} style={{ marginRight: 6 }} />
                        <Text style={styles.coinsText}>{(user?.points || 0).toLocaleString()}</Text>
                    </View>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshData(false)} tintColor={colors.charcoal} />}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Hero Card */}
                    <Animated.View style={[styles.heroCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                        <View style={styles.heroIconBg}>
                            <Ionicons name="gift" size={40} color={colors.textPrimary} />
                        </View>
                        <Text style={styles.heroTitle}>{COPY.refer.heroTitle}</Text>
                        <Text style={styles.heroSubtitle}>{COPY.refer.heroSub}</Text>
                    </Animated.View>

                    {/* Link Card */}
                    <StaggeredItem index={0} style={styles.codeCardOuter}>
                        <Text style={styles.cardLabel}>Share Your Referral Link</Text>
                        <TouchableOpacity style={styles.codeBox} onPress={copyLink}>
                            <Text style={styles.codeText} numberOfLines={1} ellipsizeMode="tail">
                                {referralLink || '...'}
                            </Text>
                            <View style={styles.copyIconBg}>
                                <Ionicons name="link-outline" size={16} color={colors.charcoal} />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.tapToCopy}>Tap to copy link</Text>
                    </StaggeredItem>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        {[
                            { value: stats?.totalReferrals || 0, label: COPY.refer.statsInvited },
                            { value: stats?.rewardedReferrals || 0, label: COPY.refer.statsSuccess },
                            { value: stats?.totalEarnings || 0, label: COPY.currencyLabel },
                        ].map((stat, i) => (
                            <StaggeredItem key={i} index={i} style={styles.statBox}>
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </StaggeredItem>
                        ))}
                    </View>

                    {/* Steps */}
                    <Text style={styles.sectionTitle}>How it works</Text>
                    <View style={styles.stepsWrap}>
                        {[
                            { num: '1', color: colors.charcoal, title: 'Share your code', desc: 'Send your unique code to friends.' },
                            { num: '2', color: colors.lavender, title: 'They sign up', desc: 'They use your invitation to join.' },
                            { num: '3', color: colors.mint, title: 'Get rewarded', desc: `You both get ${COPY.referralReward} points on first task.` },
                        ].map((step, i) => (
                            <StaggeredItem key={i} index={i} style={styles.step}>
                                <View style={[styles.stepNum, { backgroundColor: step.color }]}>
                                    <Text style={[
                                        styles.stepNumText,
                                        { color: step.color === colors.charcoal ? colors.white : colors.black }
                                    ]}>
                                        {step.num}
                                    </Text>
                                </View>
                                <View style={styles.stepContent}>
                                    <Text style={styles.stepTitle}>{step.title}</Text>
                                    <Text style={styles.stepDesc}>{step.desc}</Text>
                                </View>
                            </StaggeredItem>
                        ))}
                    </View>
                </ScrollView>
            </View>

            <Y2KAlertPopup
                visible={popupVisible}
                onClose={() => setPopupVisible(false)}
                characterType="joyful"
                title={popupTitle}
                description={popupDesc}
                actionText="Awesome!"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing[6], paddingBottom: 100 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[6],
    },
    headerSpacer: {
        width: 44,
    },
    iconBtn: {
        width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.white,
        justifyContent: 'center', alignItems: 'center', ...shadows.sm,
    },
    headerTitle: {
        fontFamily,
        fontSize: 24,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        letterSpacing: typography.tracking.tight,
    },
    coinsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1.5],
        borderRadius: radii.lg,
        ...shadows.sm,
    },
    coinGold: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.yellow,
        borderWidth: 1.5,
        borderColor: colors.black,
        marginRight: 6,
    },
    coinsText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },

    heroCard: {
        alignItems: 'center',
        marginTop: spacing[4],
        marginBottom: spacing[8],
        paddingVertical: spacing[4],
    },
    heroIconBg: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.lime,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing[6],
    },
    heroTitle: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        marginBottom: spacing[2],
    },
    heroSubtitle: {
        fontSize: typography.size.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },

    codeCardOuter: { marginBottom: spacing[4] },
    cardLabel: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
        marginBottom: spacing[2],
    },
    codeBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: radii.lg,
        paddingHorizontal: spacing[4],
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        width: '100%',
        ...shadows.sm,
    },
    codeText: {
        flex: 1,
        flexShrink: 1,
        overflow: 'hidden',
        fontSize: typography.size.sm,
        lineHeight: 18,
        fontWeight: typography.weight.semibold,
        color: colors.textPrimary,
        letterSpacing: 0,
        marginRight: spacing[3],
    },
    linkLabelText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
    },
    tapToCopy: {
        fontSize: 10,
        color: colors.blue,
        fontWeight: typography.weight.medium,
        marginTop: spacing[2],
        paddingLeft: spacing[1],
    },
    copyIconBg: {
        width: 32,
        height: 32,
        borderRadius: radii.sm,
        backgroundColor: colors.charcoal + '08',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing[3],
        marginBottom: spacing[6],
    },
    statBox: {
        flex: 1,
        backgroundColor: colors.white,
        borderRadius: radii.lg,
        paddingVertical: 18,
        paddingHorizontal: spacing[2],
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        ...shadows.sm,
    },
    statValue: {
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: colors.charcoal,
    },
    statLabel: {
        fontSize: 10,
        color: colors.textMuted,
        fontWeight: typography.weight.medium,
        marginTop: 2,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        marginBottom: spacing[4],
    },
    stepsWrap: { gap: spacing[4] },
    step: {
        flexDirection: 'row',
        gap: spacing[4],
        alignItems: 'flex-start',
    },
    stepNum: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepNumText: {
        color: colors.white,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
    },
    stepContent: { flex: 1 },
    stepTitle: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    stepDesc: {
        fontSize: typography.size.sm,
        color: colors.textMuted,
        lineHeight: 18,
    },
});
