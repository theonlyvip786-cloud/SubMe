import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TouchableOpacity, Alert, Platform, ActivityIndicator, Animated,
    RefreshControl, Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { colors, typography, spacing, radii, shadows, fontFamily } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import { AppTextInput, InputBox } from '../theme/inputs';
import { COPY } from '../theme/copy';
import Y2KNote from '../theme/Y2KNote';
import Y2KAlertPopup from '../theme/Y2KAlertPopup';
import { THUMBNAILS, getThumbnailSource } from '../assets/thumbnails';

const { width: screenWidth } = Dimensions.get('window');
const THUMB_ITEM_SIZE = (screenWidth - 48 - 16 * 2) / 3;

const COST = COPY.promotionCost;

export default function RequestPromotionScreen({ navigation }: any) {
    const { token, updateUser, user } = useAuthStore();
    const [livePoints, setLivePoints] = useState<number | null>(null);
    const [step, setStep] = useState(1);
    const [platform, setPlatform] = useState<'youtube' | 'instagram'>('youtube');
    const [isVip, setIsVip] = useState(false);
    const [channelLink, setChannelLink] = useState('');
    const [videoLink, setVideoLink] = useState('');
    const [mcqQuestion, setMcqQuestion] = useState('');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctIndex, setCorrectIndex] = useState<number | null>(null);
    const [thumbnailId, setThumbnailId] = useState<string>('thumb_1');
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const currentCost = isVip ? COPY.promote.premiumCost : COPY.promotionCost;

    const handlePopupClose = () => {
        setShowSuccessPopup(false);
        navigation.goBack();
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const res = await axios.get(`${API_URL}/api/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLivePoints(res.data.points);
            updateUser({ points: res.data.points });
        } catch (e) { }
        setRefreshing(false);
    };

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/users/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLivePoints(res.data.points);
                updateUser({ points: res.data.points });
            } catch (e) { }
        };
        fetchBalance();
        const unsub = navigation.addListener('focus', fetchBalance);
        return unsub;
    }, [navigation, token]);

    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(16)).current;

    useEffect(() => {
        fadeAnim.setValue(0);
        slideAnim.setValue(16);
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 90, useNativeDriver: true }),
        ]).start();
    }, [step]);

    const canProceedStep1 = () => {
        if ((livePoints ?? 0) < currentCost) {
            Alert.alert('Insufficient Balance', `You need ${currentCost} BUG's to create this promotion.`);
            return false;
        }
        if (!channelLink.trim()) {
            Alert.alert('Missing URL', `Please enter your ${platform === 'youtube' ? 'YouTube Channel' : 'Instagram Profile'} URL.`);
            return false;
        }
        if (platform === 'youtube' && !videoLink.trim()) {
            Alert.alert('Missing URL', 'Please enter your YouTube Video URL.');
            return false;
        }
        return true;
    };

    const canProceedStep2 = () => {
        if (!mcqQuestion.trim()) {
            Alert.alert('Missing Question', 'Please enter a quick question for viewers.');
            return false;
        }
        if (options.some(o => !o.trim())) {
            Alert.alert('Missing Options', 'Please fill in all 4 MCQ options.');
            return false;
        }
        if (correctIndex === null) {
            Alert.alert('Correct Answer Required', 'Please select which option is the correct answer.');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (submitting) return;
        if (!canProceedStep2()) return;
        if (!thumbnailId) return Alert.alert('Select Banner', 'Please select a task banner thumbnail.');

        setSubmitting(true);
        try {
            await axios.post(`${API_URL}/api/promotions/request`, {
                title: `${platform === 'youtube' ? 'YouTube' : 'Instagram'} Channel Promotion`,
                videoUrl: videoLink.trim() || channelLink.trim(),
                channelUrl: channelLink.trim(),
                mcqQuestion,
                mcqOptions: options,
                mcqAnswer: options[correctIndex!],
                isVip,
                platform,
                thumbnailId
            }, { headers: { Authorization: `Bearer ${token}` } });

            setShowSuccessPopup(true);
        } catch (error: any) {
            Alert.alert('Promotion Failed', error.response?.data?.error || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.container}>
                {/* Screen Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Promote Content</Text>
                    <View style={styles.coinsBadge}>
                        <Y2KNote size={14} style={{ marginRight: 6 }} />
                        <Text style={styles.coinsText}>{(livePoints ?? 0).toLocaleString()}</Text>
                    </View>
                </View>

                {/* 3-Step Wizard Stepper Bar */}
                <View style={styles.stepperContainer}>
                    <View style={styles.stepperRow}>
                        {[
                            { num: 1, label: 'Campaign' },
                            { num: 2, label: 'Quiz' },
                            { num: 3, label: 'Preview' },
                        ].map((s) => {
                            const isActive = step === s.num;
                            const isDone = step > s.num;
                            return (
                                <TouchableOpacity
                                    key={s.num}
                                    style={styles.stepItem}
                                    onPress={() => {
                                        if (s.num === 1) setStep(1);
                                        else if (s.num === 2 && canProceedStep1()) setStep(2);
                                        else if (s.num === 3 && canProceedStep1() && canProceedStep2()) setStep(3);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <View style={[
                                        styles.stepDot,
                                        isActive && styles.stepDotActive,
                                        isDone && styles.stepDotDone
                                    ]}>
                                        {isDone ? (
                                            <Ionicons name="checkmark" size={12} color={colors.black} />
                                        ) : (
                                            <Text style={[styles.stepDotText, (isActive || isDone) && { color: colors.black }]}>
                                                {s.num}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={[styles.stepLabelText, isActive && styles.stepLabelTextActive]}>
                                        {s.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <View style={styles.stepperTrackBg}>
                        <View style={[styles.stepperTrackFill, { width: `${(step / 3) * 100}%` }]} />
                    </View>
                </View>

                <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.black} />}
                    >
                        {step === 1 ? (
                            <>
                                {/* BUG Currency Note Bill */}
                                <View style={styles.noteOuter}>
                                    <View style={styles.noteStub}>
                                        <Text style={styles.noteStubText}>B{"\n"}U{"\n"}G</Text>
                                        <Text style={styles.noteStubSub}>NOTE</Text>
                                    </View>

                                    <View style={styles.notePerf}>
                                        {Array.from({ length: 10 }).map((_, i) => (
                                            <View key={i} style={styles.notePerfDot} />
                                        ))}
                                    </View>

                                    <View style={styles.noteBody}>
                                        <View style={styles.noteBodyHeader}>
                                            <Text style={styles.noteBodyBrand}>SubMe Platform</Text>
                                            <Text style={styles.noteSerial}>#{String(currentCost).padStart(4, '0')}</Text>
                                        </View>

                                        <View style={styles.noteDenomRow}>
                                            <Text style={styles.noteDenom}>{currentCost}</Text>
                                            <View style={styles.noteStack}>
                                                <Text style={styles.noteBugLabel}>BUG's</Text>
                                                <Text style={styles.noteNoteLabel}>{isVip ? 'VIP Premium' : 'Standard'}</Text>
                                                <View style={styles.noteInrBadge}>
                                                    <Text style={styles.noteInrText}>≈ ₹{currentCost} INR</Text>
                                                </View>
                                            </View>
                                        </View>

                                        <Text style={styles.noteFooter}>1 Live {isVip ? 'VIP Banner' : 'Standard'} Campaign</Text>
                                        <Text style={styles.noteWatermark}>B</Text>
                                    </View>
                                </View>

                                {/* Platform Selector */}
                                <Text style={styles.sectionLabel}>Select Platform</Text>
                                <View style={styles.platformRow}>
                                    <AnimatedPressable
                                        style={[
                                            styles.platformCard,
                                            platform === 'youtube' && styles.platformCardYtActive
                                        ]}
                                        onPress={() => setPlatform('youtube')}
                                        scaleTo={0.97}
                                    >
                                        <Ionicons name="logo-youtube" size={22} color={platform === 'youtube' ? '#FF0000' : colors.textMuted} style={{ marginRight: 8 }} />
                                        <Text style={[styles.platformCardText, platform === 'youtube' && { color: colors.black, fontWeight: '800' }]}>YouTube</Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        style={[
                                            styles.platformCard,
                                            platform === 'instagram' && styles.platformCardInstaActive
                                        ]}
                                        onPress={() => setPlatform('instagram')}
                                        scaleTo={0.97}
                                    >
                                        <Ionicons name="logo-instagram" size={22} color={platform === 'instagram' ? '#E1306C' : colors.textMuted} style={{ marginRight: 8 }} />
                                        <Text style={[styles.platformCardText, platform === 'instagram' && { color: colors.black, fontWeight: '800' }]}>Instagram</Text>
                                    </AnimatedPressable>
                                </View>

                                {/* Promotion Tier Selector */}
                                <Text style={styles.sectionLabel}>Select Promotion Tier</Text>
                                <View style={styles.tierWrap}>
                                    <AnimatedPressable
                                        style={[
                                            styles.tierCardStandard,
                                            !isVip && styles.tierCardStandardActive
                                        ]}
                                        onPress={() => setIsVip(false)}
                                        scaleTo={0.98}
                                    >
                                        <View style={styles.tierCardLeft}>
                                            <View style={styles.tierTextGroup}>
                                                <View style={styles.tierTitleRow}>
                                                    <Text style={[styles.tierTitle, !isVip && { color: colors.black }]}>Standard Campaign</Text>
                                                    <View style={styles.standardTag}>
                                                        <Text style={styles.standardTagText}>FEED</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.tierDesc}>Standard task feed placement for creators</Text>
                                            </View>
                                        </View>
                                        <View style={styles.tierPriceBadgeStandard}>
                                            <Text style={styles.tierPriceTextStandard}>49 BUG's</Text>
                                        </View>
                                    </AnimatedPressable>

                                    <AnimatedPressable
                                        style={[
                                            styles.tierCardVip,
                                            isVip && styles.tierCardVipActive
                                        ]}
                                        onPress={() => setIsVip(true)}
                                        scaleTo={0.98}
                                    >
                                        <View style={styles.tierCardLeft}>
                                            <View style={styles.tierTextGroup}>
                                                <View style={styles.tierTitleRow}>
                                                    <Text style={styles.tierTitleVip}>VIP Banner Placement</Text>
                                                </View>
                                                <Text style={styles.tierDescVip}>Top auto-sliding home banner placement</Text>
                                            </View>
                                        </View>
                                        <View style={styles.tierPriceBadgeVip}>
                                            <Text style={styles.tierPriceTextVip}>200 BUG's</Text>
                                        </View>
                                    </AnimatedPressable>
                                </View>

                                {/* URL Inputs */}
                                <Text style={styles.sectionLabel}>
                                    {platform === 'youtube' ? 'YouTube Channel URL (Subscribe Target)' : 'Instagram Profile URL'}
                                </Text>
                                <InputBox style={{ marginBottom: spacing[4] }}>
                                    <Ionicons name={platform === 'youtube' ? 'logo-youtube' : 'logo-instagram'} size={18} color={platform === 'youtube' ? "#FF0000" : "#E1306C"} style={{ marginRight: spacing[3] }} />
                                    <AppTextInput
                                        variant="flat"
                                        style={styles.input}
                                        numberOfLines={1}
                                        placeholder={platform === 'youtube' ? "youtube.com/@yourchannel" : "instagram.com/yourprofile"}
                                        value={channelLink}
                                        onChangeText={setChannelLink}
                                        autoCapitalize="none"
                                        keyboardType="url"
                                    />
                                </InputBox>

                                {platform === 'youtube' && (
                                    <>
                                        <Text style={styles.sectionLabel}>YouTube Video URL (In-App Player)</Text>
                                        <InputBox style={{ marginBottom: spacing[4] }}>
                                            <Ionicons name="play-circle-outline" size={18} color="#FF0000" style={{ marginRight: spacing[3] }} />
                                            <AppTextInput
                                                variant="flat"
                                                style={styles.input}
                                                numberOfLines={1}
                                                placeholder="youtube.com/watch?v=..."
                                                value={videoLink}
                                                onChangeText={setVideoLink}
                                                autoCapitalize="none"
                                                keyboardType="url"
                                            />
                                        </InputBox>
                                    </>
                                )}

                                {/* Promotion Guidelines */}
                                <Text style={styles.sectionTitle}>Campaign Guidelines</Text>
                                <View style={styles.guidelinesSingleCard}>
                                    {[
                                        { num: '1', color: colors.charcoal, title: 'Authentic Engagement', desc: 'Real video discovery & qualitative feedback only.' },
                                        { num: '2', color: colors.lavender, title: 'No Bot Activity', desc: 'No fake bots or automated engagement allowed.' },
                                        { num: '3', color: colors.lime, title: 'Instant Activation', desc: 'Your promotion goes live immediately for task creators.' },
                                    ].map((stepItem, i, arr) => (
                                        <View key={i} style={[styles.guidelineSingleRow, i < arr.length - 1 && styles.guidelineBorderBottom]}>
                                            <View style={[styles.stepNumBadge, { backgroundColor: stepItem.color }]}>
                                                <Text style={[
                                                    styles.stepNumBadgeText,
                                                    { color: stepItem.color === colors.charcoal ? colors.white : colors.black }
                                                ]}>
                                                    {stepItem.num}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.stepCardTitle}>{stepItem.title}</Text>
                                                <Text style={styles.stepCardDesc}>{stepItem.desc}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                <AnimatedPressable
                                    style={[styles.mainBtn, { backgroundColor: colors.lime }]}
                                    onPress={() => canProceedStep1() && setStep(2)}
                                >
                                    <Text style={[styles.mainBtnText, { color: colors.black }]}>Continue to MCQ Quiz</Text>
                                </AnimatedPressable>
                            </>
                        ) : step === 2 ? (
                            <>
                                {/* MCQ Section Header */}
                                <View style={styles.stepHeaderCard}>
                                    <Ionicons name="help-circle" size={24} color={colors.blue} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.stepHeaderTitle}>Task Verification Question</Text>
                                        <Text style={styles.stepHeaderDesc}>Create a quick question to verify users watched your video.</Text>
                                    </View>
                                </View>

                                {/* MCQ Question Input */}
                                <Text style={styles.sectionLabel}>Question Text</Text>
                                <InputBox multiline style={{ marginBottom: spacing[5] }}>
                                    <AppTextInput
                                        variant="multiline"
                                        style={styles.textArea}
                                        placeholder="e.g. What color shirt was the presenter wearing?"
                                        multiline
                                        value={mcqQuestion}
                                        onChangeText={setMcqQuestion}
                                    />
                                </InputBox>

                                <Text style={styles.sectionLabel}>4 Options (Tap Radio to Mark Correct Answer)</Text>
                                {options.map((opt, i) => {
                                    const isCorrect = correctIndex === i;
                                    return (
                                        <View key={i} style={[styles.optRow, isCorrect && styles.optRowActive]}>
                                            <TouchableOpacity
                                                style={[styles.radioBtn, isCorrect && styles.radioBtnActive]}
                                                onPress={() => setCorrectIndex(i)}
                                                activeOpacity={0.8}
                                            >
                                                {isCorrect && <Ionicons name="checkmark" size={14} color={colors.black} />}
                                            </TouchableOpacity>
                                            <InputBox style={styles.optInputBox}>
                                                <AppTextInput
                                                    variant="flat"
                                                    style={styles.optInput}
                                                    placeholder={`Option ${i + 1}`}
                                                    value={opt}
                                                    onChangeText={t => {
                                                        const n = [...options]; n[i] = t; setOptions(n);
                                                    }}
                                                />
                                            </InputBox>
                                            {isCorrect && (
                                                <View style={styles.correctBadge}>
                                                    <Text style={styles.correctBadgeText}>CORRECT ✓</Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}

                                <View style={styles.footerRow}>
                                    <TouchableOpacity style={styles.backBtnTxt} onPress={() => setStep(1)}>
                                        <Text style={styles.backBtnText}>Back</Text>
                                    </TouchableOpacity>
                                    <AnimatedPressable
                                        style={[styles.mainBtn, { flex: 2, backgroundColor: colors.lime, marginTop: 0 }]}
                                        onPress={() => canProceedStep2() && setStep(3)}
                                    >
                                        <Text style={[styles.mainBtnText, { color: colors.black }]}>Next: Choose Banner</Text>
                                    </AnimatedPressable>
                                </View>
                            </>
                        ) : (
                            <>
                                {/* Step 3: Banner & Live Preview */}
                                <Text style={styles.sectionLabel}>Choose Task Banner Thumbnail</Text>
                                <View style={styles.thumbGrid}>
                                    {THUMBNAILS.map(thumb => {
                                        const isSelected = thumbnailId === thumb.id;
                                        return (
                                            <TouchableOpacity
                                                key={thumb.id}
                                                style={[
                                                    styles.thumbGridItem,
                                                    { width: THUMB_ITEM_SIZE, height: THUMB_ITEM_SIZE * 0.65 },
                                                    isSelected && styles.thumbGridItemSelected
                                                ]}
                                                onPress={() => setThumbnailId(thumb.id)}
                                                activeOpacity={0.75}
                                            >
                                                <Image
                                                    source={thumb.source}
                                                    style={styles.thumbGridImage}
                                                    resizeMode="cover"
                                                />
                                                {isSelected && (
                                                    <View style={styles.thumbGridCheckOverlay}>
                                                        <View style={styles.thumbGridCheck}>
                                                            <Ionicons name="checkmark" size={14} color={colors.black} />
                                                        </View>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Live Task Card Preview */}
                                <Text style={styles.sectionLabel}>Live Home Screen Card Preview</Text>
                                <View style={styles.taskCardPreview}>
                                    <View style={styles.taskThumbContainerPreview}>
                                        <Image source={getThumbnailSource(thumbnailId)} style={styles.taskThumbImagePreview} resizeMode="cover" />
                                        <View style={styles.taskPlatformBadgePreview}>
                                            <Ionicons name={platform === 'instagram' ? 'logo-instagram' : 'logo-youtube'} size={14} color={colors.white} />
                                        </View>
                                        <View style={styles.taskTimeOverlayPreview}>
                                            <Text style={styles.taskTimeTextPreview}>{platform === 'instagram' ? 'REEL' : '3:00'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.taskCardBodyPreview}>
                                        <Text style={styles.taskTitlePreview} numberOfLines={1}>
                                            {platform === 'youtube' ? 'YouTube' : 'Instagram'} Channel Promotion
                                        </Text>
                                        <View style={styles.previewFooterRow}>
                                            <View style={styles.taskCreatorRow}>
                                                <Ionicons name="person-circle" size={18} color={colors.textMuted} />
                                                <Text style={styles.taskCreatorText}>Creator You</Text>
                                            </View>
                                            <View style={[styles.rewardBadgePill, isVip && { backgroundColor: colors.yellow }]}>
                                                <Text style={[styles.rewardBadgePillText, isVip && { color: colors.black }]}>
                                                    +{isVip ? 2 : 1} BUG's
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.footerRow}>
                                    <TouchableOpacity style={styles.backBtnTxt} onPress={() => setStep(2)}>
                                        <Text style={styles.backBtnText}>Back</Text>
                                    </TouchableOpacity>
                                    <AnimatedPressable
                                        style={[styles.mainBtn, { flex: 2, backgroundColor: colors.lime, marginTop: 0 }]}
                                        onPress={handleSubmit}
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color={colors.black} />
                                        ) : (
                                            <Text style={[styles.mainBtnText, { color: colors.black, fontSize: 14 }]} numberOfLines={1}>
                                                Confirm ({currentCost} BUG's)
                                            </Text>
                                        )}
                                    </AnimatedPressable>
                                </View>
                            </>
                        )}
                    </ScrollView>
                </Animated.View>
            </View>

            <Y2KAlertPopup
                visible={showSuccessPopup}
                onClose={handlePopupClose}
                characterType="joyful"
                title="Promotion Published!"
                description="Your promotion task has been successfully created and published! Creators can now view and execute your task."
                actionText="Awesome!"
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    container: { flex: 1 },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing[6], paddingTop: spacing[2], paddingBottom: 100 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[6],
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
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
    coinsText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },

    /* ── 3-Step Stepper Bar ──────────────────────── */
    stepperContainer: {
        paddingHorizontal: spacing[6],
        marginBottom: spacing[5],
    },
    stepperRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.bgSecondary,
        borderWidth: 1.5,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDotActive: {
        backgroundColor: colors.lime,
        borderColor: colors.black,
    },
    stepDotDone: {
        backgroundColor: colors.lime,
        borderColor: colors.black,
    },
    stepDotText: {
        fontFamily,
        fontSize: 11,
        fontWeight: '900',
        color: colors.textMuted,
    },
    stepLabelText: {
        fontFamily,
        fontSize: 13,
        fontWeight: typography.weight.semibold,
        color: colors.textMuted,
    },
    stepLabelTextActive: {
        color: colors.black,
        fontWeight: typography.weight.bold,
    },
    stepperTrackBg: {
        height: 6,
        backgroundColor: 'rgba(0,0,0,0.06)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    stepperTrackFill: {
        height: '100%',
        backgroundColor: colors.lime,
        borderRadius: 3,
    },

    /* ── BUG Note Bill ─────────────────────────── */
    noteOuter: {
        flexDirection: 'row',
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: 'rgba(22, 18, 15, 0.12)',
        overflow: 'hidden',
        marginBottom: spacing[6],
        minHeight: 120,
        ...shadows.md,
    },
    noteStub: {
        width: 52,
        backgroundColor: '#1C3D0A',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing[4],
        paddingBottom: spacing[4],
    },
    noteStubText: {
        fontFamily,
        fontSize: 14,
        fontWeight: '900',
        color: '#C2F687',
        letterSpacing: 2,
        textAlign: 'center',
        lineHeight: 17,
    },
    noteStubSub: {
        fontFamily,
        fontSize: 7,
        fontWeight: '700',
        color: 'rgba(194,246,135,0.5)',
        letterSpacing: 1.5,
    },
    notePerf: {
        width: 16,
        backgroundColor: '#C2F687',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingVertical: spacing[3],
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(22,18,15,0.2)',
    },
    notePerfDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(22,18,15,0.18)',
    },
    noteBody: {
        flex: 1,
        backgroundColor: '#C2F687',
        paddingHorizontal: spacing[5],
        paddingTop: spacing[4],
        paddingBottom: spacing[4],
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'space-between',
    },
    noteBodyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    noteBodyBrand: {
        fontFamily,
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(22,18,15,0.4)',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    noteSerial: {
        fontFamily,
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(22,18,15,0.35)',
        letterSpacing: 1,
    },
    noteDenomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        marginTop: 4,
    },
    noteDenom: {
        fontSize: 60,
        fontWeight: '900',
        color: '#16120F',
        lineHeight: 62,
        letterSpacing: -2,
    },
    noteStack: {
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
    },
    noteBugLabel: {
        fontSize: 17,
        fontWeight: '900',
        color: '#16120F',
        letterSpacing: 1,
    },
    noteNoteLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(22,18,15,0.55)',
        marginTop: -2,
    },
    noteInrBadge: {
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(22,18,15,0.3)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        alignSelf: 'flex-start',
    },
    noteInrText: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(22,18,15,0.5)',
        letterSpacing: 0.5,
    },
    noteFooter: {
        fontFamily,
        fontSize: 9,
        fontWeight: '600',
        color: 'rgba(22,18,15,0.35)',
        letterSpacing: 0.5,
        marginTop: 4,
    },
    noteWatermark: {
        position: 'absolute',
        right: -10,
        bottom: -24,
        fontSize: 130,
        fontWeight: '900',
        color: 'rgba(22,18,15,0.04)',
    },

    sectionLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: spacing[2],
        marginTop: spacing[4],
    },
    platformRow: {
        flexDirection: 'row',
        gap: spacing[3],
        marginBottom: spacing[3],
    },
    platformCard: {
        flex: 1,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: radii.xl,
        paddingVertical: spacing[3],
        gap: spacing[2.5],
        ...shadows.sm,
    },
    platformCardYtActive: {
        borderColor: '#FF0000',
        backgroundColor: colors.white,
    },
    platformCardInstaActive: {
        borderColor: '#E1306C',
        backgroundColor: colors.white,
    },
    platformCardText: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.medium,
        color: colors.textMuted,
    },

    tierWrap: {
        marginBottom: spacing[3],
    },
    tierCardStandard: {
        minHeight: 74,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.white,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.08)',
        borderRadius: radii.xl,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3.5],
        marginBottom: spacing[3],
        ...shadows.sm,
    },
    tierCardStandardActive: {
        borderColor: colors.black,
        backgroundColor: colors.white,
    },
    tierCardVip: {
        minHeight: 74,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#16120F',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: radii.xl,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3.5],
        marginBottom: spacing[3],
        ...shadows.md,
    },
    tierCardVipActive: {
        borderColor: colors.yellow,
        backgroundColor: '#16120F',
    },
    tierCardLeft: {
        flex: 1,
        marginRight: spacing[2],
    },
    tierTextGroup: {
        gap: 2,
    },
    tierTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        flex: 1,
    },
    tierTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.textPrimary,
        flexShrink: 1,
    },
    tierTitleVip: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.white,
        flexShrink: 1,
    },
    tierDesc: {
        fontSize: typography.size.xs,
        color: colors.textMuted,
    },
    tierDescVip: {
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.7)',
    },
    standardTag: {
        backgroundColor: 'rgba(0,0,0,0.06)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.xs,
    },
    standardTagText: {
        fontFamily,
        fontSize: 8,
        fontWeight: '900',
        color: colors.textMuted,
    },
    vipTag: {
        backgroundColor: colors.yellow,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.xs,
    },
    vipTagText: {
        fontFamily,
        fontSize: 8,
        fontWeight: '900',
        color: colors.black,
    },
    tierPriceBadgeStandard: {
        backgroundColor: colors.bgSecondary,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.md,
        flexShrink: 0,
        alignSelf: 'center',
    },
    tierPriceTextStandard: {
        fontFamily,
        fontSize: 12,
        fontWeight: '900',
        color: colors.black,
    },
    tierPriceBadgeVip: {
        backgroundColor: colors.yellow,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.md,
        flexShrink: 0,
        alignSelf: 'center',
    },
    tierPriceTextVip: {
        fontFamily,
        fontSize: 12,
        fontWeight: '900',
        color: colors.black,
    },

    input: {
        flex: 1,
        fontSize: 15,
        color: colors.textPrimary,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: spacing[2],
        marginTop: spacing[4],
    },
    guidelinesSingleCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[1],
        ...shadows.sm,
    },
    guidelineSingleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        paddingVertical: spacing[3],
    },
    guidelineBorderBottom: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    stepNumBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepNumBadgeText: {
        fontSize: 12,
        fontWeight: typography.weight.bold,
    },
    stepCardTitle: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
    },
    stepCardDesc: {
        fontSize: typography.size.xs,
        color: colors.textMuted,
        marginTop: 2,
        lineHeight: 16,
    },

    stepHeaderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[4],
        backgroundColor: colors.white,
        padding: spacing[5],
        borderRadius: radii.xl,
        marginBottom: spacing[5],
        ...shadows.sm,
    },
    stepHeaderTitle: {
        fontSize: 17,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    stepHeaderDesc: {
        fontSize: typography.size.xs,
        color: colors.textMuted,
        marginTop: 3,
    },

    mainBtn: {
        height: 60,
        borderRadius: radii.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        marginTop: spacing[7],
        ...shadows.md,
    },
    mainBtnText: {
        fontSize: 17,
        fontWeight: '900',
    },

    textArea: {
        backgroundColor: colors.white,
        borderRadius: radii.lg,
        padding: spacing[4.5],
        height: 120,
        textAlignVertical: 'top',
        ...shadows.sm,
        fontSize: 16,
        color: colors.textPrimary,
    },

    optRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[4],
        gap: spacing[3],
    },
    optRowActive: {
        borderRadius: radii.xl,
    },
    radioBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
    },
    radioBtnActive: {
        backgroundColor: colors.lime,
        borderColor: colors.black,
    },
    optInputBox: {
        flex: 1,
        minHeight: 56,
    },
    optInput: {
        flex: 1,
        fontSize: 15,
        color: colors.textPrimary,
    },
    correctBadge: {
        backgroundColor: colors.lime,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: radii.xs,
    },
    correctBadgeText: {
        fontFamily,
        fontSize: 10,
        fontWeight: '900',
        color: colors.black,
    },

    footerRow: {
        flexDirection: 'row',
        gap: spacing[4],
        marginTop: spacing[5],
    },
    backBtnTxt: {
        flex: 1,
        height: 60,
        borderRadius: radii.xl,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.08)',
        marginRight: spacing[3],
        ...shadows.sm,
    },
    backBtnText: {
        fontSize: 16,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
    },

    thumbGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: spacing[5],
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[4],
        ...shadows.sm,
    },
    thumbGridItem: {
        borderRadius: radii.md,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    thumbGridImage: {
        width: '100%',
        height: '100%',
    },
    thumbGridItemSelected: {
        borderColor: colors.black,
    },
    thumbGridCheckOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(194,246,135,0.4)',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        padding: 4,
    },
    thumbGridCheck: {
        backgroundColor: colors.lime,
        borderRadius: radii.full,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },

    taskCardPreview: {
        backgroundColor: colors.white,
        borderRadius: radii['2xl'],
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.08)',
        marginBottom: spacing[4],
        ...shadows.sm,
    },
    taskThumbContainerPreview: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: colors.black,
        position: 'relative',
    },
    taskThumbImagePreview: {
        width: '100%',
        height: '100%',
    },
    taskPlatformBadgePreview: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.7)',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    taskTimeOverlayPreview: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.xs,
    },
    taskTimeTextPreview: {
        fontFamily,
        fontSize: 11,
        fontWeight: '700',
        color: colors.white,
    },
    taskCardBodyPreview: {
        padding: spacing[4],
    },
    taskTitlePreview: {
        fontSize: typography.size.lg,
        fontWeight: '800',
        color: colors.textPrimary,
        lineHeight: 22,
        marginBottom: spacing[2],
    },
    previewFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taskCreatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1.5],
        flex: 1,
    },
    taskCreatorText: {
        fontFamily,
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },
    rewardBadgePill: {
        backgroundColor: colors.lime,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: radii.sm,
    },
    rewardBadgePillText: {
        fontFamily,
        fontSize: 11,
        fontWeight: '900',
        color: colors.black,
    },
});
