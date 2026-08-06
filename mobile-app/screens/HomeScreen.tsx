import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import {
  colors, typography, spacing, radii, shadows, fontFamily, animation,
} from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';
import { COPY } from '../theme/copy';
import Y2KCharacter from '../theme/Y2KCharacter';
import Y2KNote from '../theme/Y2KNote';
import Y2KAlertPopup from '../theme/Y2KAlertPopup';
import Y2KCelebrationOverlay from '../theme/Y2KCelebrationOverlay';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Audio } from 'expo-av';
import { Image, FlatList, Dimensions } from 'react-native';
import { getThumbnailSource } from '../assets/thumbnails';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 48; // paddingHorizontal is 24 on each side


function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const vMatch = url.match(/[?&]v=([^&]+)/);
  if (vMatch) return vMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/\/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];
  return null;
}



function useCardAnimation(delay = 0) {
  const fade = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const runAnim = () => {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: animation.duration.normal, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, ...animation.spring.soft, useNativeDriver: true }),
      ]).start();
    };

    if (delay > 0) {
      const timer = setTimeout(runAnim, delay);
      return () => clearTimeout(timer);
    } else {
      runAnim();
    }
  }, [delay]);

  return { opacity: fade, transform: [{ translateY }] };
}

function ActionBtn({
  icon, label, bg, iconColor, onPress, delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  bg: string;
  iconColor?: string;
  onPress: () => void;
  delay?: number;
}) {
  const anim = useCardAnimation(delay);
  const ic = iconColor || colors.black;

  return (
    <Animated.View style={[{ ...anim, flex: 1, alignItems: 'center' }]}>
      <AnimatedPressable
        style={[styles.actionBtn, { backgroundColor: bg }]}
        onPress={onPress}
        scaleTo={animation.pressScale}
      >
        <Ionicons name={icon} size={24} color={ic} style={{ marginBottom: 4 }} />
        <Text style={[styles.actionLabel, { color: ic }]}>{label}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

function BalanceCard({ points }: { points: number }) {
  const anim = useCardAnimation(80);

  return (
    <Animated.View style={[{ ...anim }, styles.balanceCardOuter]}>
      <View style={[styles.balanceCard, { backgroundColor: colors.pink }]}>
        <View style={styles.balanceInner}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <Text style={styles.balanceAmount}>{points.toLocaleString()} BUG's</Text>
          <Text style={styles.parityLabel}>~₹{points.toLocaleString()} INR (1 BUG = ₹1.00 INR)</Text>
          <View style={[styles.chip, { backgroundColor: colors.white }]}>
            <View style={styles.chipDot} />
            <Text style={styles.chipText}>POINTS ECONOMY</Text>
            <Ionicons name="chevron-down" size={12} color={colors.black} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const TX_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  earn: 'wallet-outline',
  reward: 'gift-outline',
  topup: 'cash-outline',
  spend: 'heart-outline',
  refund: 'return-down-back-outline',
};

function TransactionItem({ item, index }: { item: any; index: number }) {
  const isPositive = item.amount > 0;
  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <StaggeredItem index={index} style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <View style={styles.transactionIconBg}>
          <Ionicons name={TX_ICONS[item.type] || 'ellipse-outline'} size={20} color={colors.white} />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionName} numberOfLines={1}>
            {item.description || item.type}
          </Text>
          <Text style={styles.transactionDate}>{date}</Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.transactionAmount, isPositive ? styles.positiveAmount : styles.negativeAmount]}>
          {isPositive ? '+' : '-'}{Math.abs(item.amount)}
        </Text>
        <Text style={styles.transactionType}>{item.type}</Text>
      </View>
    </StaggeredItem>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { user, token, justLoggedIn, setJustLoggedIn } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const vipListRef = React.useRef<FlatList>(null);
  const [currentVipIndex, setCurrentVipIndex] = useState(0);

  const vipTasks = tasks.filter(t => t.is_vip);

  // Auto-scroll logic for VIP Banners
  useEffect(() => {
    if (vipTasks.length > 1) {
      const interval = setInterval(() => {
        let nextIndex = currentVipIndex + 1;
        if (nextIndex >= vipTasks.length) {
          nextIndex = 0;
        }
        vipListRef.current?.scrollToOffset({
          offset: nextIndex * (BANNER_WIDTH + 16), // width + marginRight
          animated: true,
        });
        setCurrentVipIndex(nextIndex);
      }, 3000); // Slides every 3 seconds

      return () => clearInterval(interval);
    }
  }, [currentVipIndex, vipTasks.length]);

  useEffect(() => {
    if (justLoggedIn) {
      setShowConfetti(true);
      setShowWelcomePopup(true);
      setJustLoggedIn(false);
      
      const timer = setTimeout(() => {
        setShowWelcomePopup(false);
      }, 3000); // Auto-dismiss toast after 3s
      
      const timer2 = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
      };
    }
  }, [justLoggedIn, setJustLoggedIn]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [txRes, tasksRes] = await Promise.all([
        axios.get(`${API_URL}/api/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setTransactions(txRes.data || []);
      const fetchedTasks = tasksRes.data || [];
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const validTasks = (fetchedTasks || []).filter((t: any) => {
        if (!t.created_at) return true;
        return (now - new Date(t.created_at).getTime()) < twentyFourHours;
      });

      // Strict Title & ID Deduplication to guarantee no title appears twice
      const uniqueMap = new Map();
      validTasks.forEach((t: any) => {
        const titleKey = (t.title || t.id || '').trim().toLowerCase();
        if (titleKey && !uniqueMap.has(titleKey)) {
          uniqueMap.set(titleKey, t);
        }
      });

      setTasks(Array.from(uniqueMap.values()));
    } catch {
      setTransactions([]);
      setTasks([]);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const unsub = navigation.addListener('focus', fetchData);
    return unsub;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const headerAnim = useCardAnimation(0);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.black} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[{ ...headerAnim }, styles.header]}>
          <Text style={styles.greeting}>Home</Text>
          <View style={styles.coinsBadge}>
            <Y2KNote size={14} style={{ marginRight: 6 }} />
            <Text style={styles.coinsText}>{(user?.points || 0).toLocaleString()}</Text>
          </View>
        </Animated.View>

        <View style={styles.tasksSection}>
          <Text style={styles.sectionTitle}>{COPY.home.tasksTitle}</Text>
          
          {/* VIP Auto-Sliding Banners */}
          {vipTasks.length > 0 && (
            <FlatList
              ref={vipListRef}
              horizontal
              data={vipTasks}
              keyExtractor={(item) => `vip-${item.id}`}
              showsHorizontalScrollIndicator={false}
              snapToInterval={BANNER_WIDTH + 16}
              decelerationRate="fast"
              contentContainerStyle={styles.vipBannerContainer}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / (BANNER_WIDTH + 16));
                setCurrentVipIndex(index);
              }}
              renderItem={({ item: task }) => {
                const vid = getYouTubeId(task.video_url);
                const ytThumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null;
                const localThumb = getThumbnailSource(task.thumbnail_id);

                return (
                  <AnimatedPressable
                    style={styles.vipCard}
                    onPress={() => navigation.navigate('TaskScreen', { task })}
                    scaleTo={animation.pressScale}
                  >
                    {localThumb ? (
                      <Image source={localThumb} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : ytThumb ? (
                      <Image source={{ uri: ytThumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bgDark }]} />
                    )}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
                      style={StyleSheet.absoluteFillObject}
                    />
                    
                    <View style={styles.vipHeader}>
                      <View style={styles.taskBadgeVip}>
                        <Ionicons name="flash" size={12} color={colors.black} style={{ marginRight: 4 }} />
                        <Text style={styles.taskBadgeText}>VIP 2X BUG'S</Text>
                      </View>
                      <View style={styles.vipPlatformBadge}>
                        <Ionicons name={task.platform === 'instagram' ? 'logo-instagram' : 'logo-youtube'} size={14} color={colors.white} />
                      </View>
                    </View>

                    <View style={styles.vipFooter}>
                      <Text style={styles.vipTitle} numberOfLines={2}>{task.title}</Text>
                      <View style={styles.vipFooterRow}>
                        <View style={styles.creatorProfile}>
                          <Ionicons name="person-circle" size={16} color="rgba(255,255,255,0.85)" />
                          <Text style={styles.creatorName}>Creator {task.id.substring(0, 4)}</Text>
                        </View>
                        <View style={styles.vipEarnPill}>
                          <Text style={styles.vipEarnPillText}>+2 BUG's</Text>
                        </View>
                      </View>
                    </View>
                  </AnimatedPressable>
                );
              }}
            />
          )}

          {tasks.filter(t => !t.is_vip).length === 0 ? (
            <View style={styles.emptyTx}>
              <Y2KCharacter type="bored" size={70} animate={true} style={{ marginBottom: spacing[3] }} />
              <Text style={styles.emptyTxText}>{COPY.home.tasksEmpty}</Text>
            </View>
          ) : (
            tasks.filter(t => !t.is_vip).map((task, i) => {
              const vid = getYouTubeId(task.video_url);
              const ytThumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null;
              const localThumb = getThumbnailSource(task.thumbnail_id);

              return (
                <StaggeredItem key={task.id} index={i} style={styles.taskCard}>
                  <AnimatedPressable
                    style={styles.taskCardInnerNew}
                    onPress={() => navigation.navigate('TaskScreen', { task })}
                    scaleTo={animation.pressScale}
                  >
                    <View style={styles.taskThumbContainer}>
                        {localThumb ? (
                          <Image source={localThumb} style={styles.taskThumbImage} resizeMode="cover" />
                        ) : ytThumb ? (
                          <Image source={{ uri: ytThumb }} style={styles.taskThumbImage} />
                        ) : (
                          <View style={[styles.taskThumbImage, { backgroundColor: colors.bgSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="videocam-outline" size={40} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={styles.taskPlatformBadge}>
                           <Ionicons name={task.platform === 'instagram' ? 'logo-instagram' : 'logo-youtube'} size={14} color={colors.white} />
                        </View>
                        <View style={styles.taskTimeOverlay}>
                          <Text style={styles.taskTimeText}>{Math.floor(task.required_watch_time / 60)}:{(task.required_watch_time % 60).toString().padStart(2, '0')}</Text>
                        </View>
                      </View>

                      <View style={styles.taskCardBodyNew}>
                        <Text style={styles.taskTitleNew} numberOfLines={2}>
                          {task.title}
                        </Text>
                        <View style={styles.taskCreatorRow}>
                          <Ionicons name="person-circle" size={20} color={colors.textMuted} />
                          <Text style={styles.taskCreatorText}>Creator {task.id.substring(0, 4)}</Text>
                        </View>
                      </View>
                  </AnimatedPressable>
                </StaggeredItem>
              );
            })
          )}
        </View>


      </ScrollView>

      {/* Welcome Back Toast (tap-to-dismiss, top of screen) */}
      {showWelcomePopup && (
        <TouchableOpacity
          style={styles.welcomeToast}
          activeOpacity={0.9}
          onPress={() => setShowWelcomePopup(false)}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.lime} />
          <Text style={styles.welcomeToastText}>Welcome back, {user?.username || 'there'}! 👋</Text>
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}

      {showConfetti && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ scale: 1.4 }] }} pointerEvents="none">
          <ConfettiCannon
            count={120}
            origin={{x: 200, y: -20}}
            explosionSpeed={350}
            fallSpeed={3500}
            fadeOut={true}
            autoStart={true}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: spacing[6],
  },
  welcomeToast: {
    position: 'absolute',
    top: 60,
    left: spacing[6],
    right: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.charcoal,
    borderRadius: radii.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    ...shadows.md,
    zIndex: 999,
  },
  welcomeToastText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.white,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[4],
    marginBottom: spacing[6],
  },
  greeting: {
    fontFamily,
    fontSize: 24,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: typography.tracking.tight,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
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
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.15)',
    marginRight: 6,
  },
  coinsText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.pink,
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
    padding: 3,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: radii.sm - 3,
    backgroundColor: colors.lavender,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCardOuter: {
    marginBottom: spacing[6],
  },
  balanceCard: {
    borderRadius: radii['2xl'],
    padding: spacing[6],
    ...shadows.md,
  },
  balanceInner: {
    flex: 1,
    justifyContent: 'center',
  },
  balanceLabel: {
    fontFamily,
    color: 'rgba(0,0,0,0.65)',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[2],
  },
  balanceAmount: {
    fontFamily,
    color: colors.black,
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.black,
    letterSpacing: typography.tracking.tight,
    marginBottom: spacing[1],
  },
  parityLabel: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.black,
    opacity: 0.8,
    marginBottom: spacing[4],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    gap: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blue,
  },
  chipText: {
    fontFamily,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  actionBtn: {
    width: 96,
    height: 84,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
    paddingTop: spacing[1],
    paddingBottom: spacing[1],
  },
  actionLabel: {
    fontFamily,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  tasksSection: {
    marginBottom: spacing[8],
    gap: spacing[3],
  },
  taskCard: {
    marginBottom: spacing[2],
  },
  taskCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.sm,
  },
  taskBadge: {
    backgroundColor: colors.lime,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  taskBadgeVip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  vipPlatformBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskBadgeText: {
    fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.black,
  },
  vipBannerContainer: {
    paddingBottom: spacing[4],
  },
  vipCard: {
    width: BANNER_WIDTH,
    aspectRatio: 16 / 9,
    borderRadius: radii.xl,
    padding: spacing[4],
    justifyContent: 'space-between',
    backgroundColor: colors.black,
    overflow: 'hidden',
    marginRight: 16,
    ...shadows.md,
  },
  vipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  vipTitle: {
    fontFamily,
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 20,
    marginBottom: 4,
  },
  vipFooter: {
    zIndex: 2,
    marginTop: 'auto',
  },
  vipFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  vipEarnPill: {
    backgroundColor: colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  vipEarnPillText: {
    fontFamily,
    fontSize: 10,
    fontWeight: '900',
    color: colors.black,
  },
  creatorProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  creatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[2],
  },
  creatorName: {
    fontFamily,
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
    fontWeight: '600',
  },
  vipRewardPill: {
    backgroundColor: colors.lime,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
  },
  vipReward: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.black,
  },
  
  taskCardInnerNew: {
    backgroundColor: colors.white,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    ...shadows.sm,
    marginBottom: spacing[1],
  },
  taskThumbContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.black,
  },
  taskThumbImage: {
    width: '100%',
    height: '100%',
  },
  taskPlatformBadge: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskTimeOverlay: {
    position: 'absolute',
    bottom: spacing[2],
    right: spacing[2],
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  taskTimeText: {
    fontFamily,
    fontSize: 11,
    color: colors.white,
    fontWeight: '700',
  },
  taskCardBodyNew: {
    padding: spacing[4],
  },
  taskTitleNew: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing[2],
  },
  taskCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  taskCreatorText: {
    fontFamily,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },

  sectionTitle: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing[4],
  },
  taskCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lime,
    borderRadius: radii['2xl'],
    padding: spacing[5],
    ...shadows.md,
  },
  taskCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flex: 1,
  },
  taskIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskCtaTitle: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  taskCtaSub: {
    fontFamily,
    fontSize: typography.size.xs,
    color: 'rgba(0,0,0,0.55)',
    marginTop: 2,
  },
  transactionsSection: {
    marginTop: spacing[2],
  },
  transactionList: {
    gap: 0,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.white,
    borderRadius: radii.md,
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    flex: 1,
    marginRight: spacing[3],
  },
  transactionIconBg: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    gap: 2,
  },
  transactionName: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  transactionDate: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  transactionAmount: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
  positiveAmount: {
    color: colors.textPrimary,
  },
  negativeAmount: {
    color: colors.pink,
  },
  transactionType: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  emptyTx: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[8],
    alignItems: 'center',
  },
  emptyTxText: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
});
