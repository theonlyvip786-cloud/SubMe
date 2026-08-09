import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL, SUPABASE_URL } from '../config';
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
  const shortsMatch = url.match(/\/shorts\/([^?&/]+)/);
  if (shortsMatch) return shortsMatch[1];
  const vMatch = url.match(/[?&]v=([^&]+)/);
  if (vMatch) return vMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/\/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];
  return null;
}

function getTaskTimeLeft(createdAt?: string): string {
  if (!createdAt) return '24h';
  const created = new Date(createdAt).getTime();
  const expire = created + 24 * 60 * 60 * 1000;
  const diff = expire - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function CreatorAvatar({ userId, username, size = 20 }: { userId?: string; username?: string; size?: number }) {
  const [hasError, setHasError] = useState(false);

  const displayName = username || 'Creator';
  const cacheBust = Math.floor(Date.now() / 30000);
  const avatarUrl = userId ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${userId}.jpg?v=${cacheBust}` : null;

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=16120F&color=CCFF00&bold=true&size=128`;

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.charcoal, justifyContent: 'center', alignItems: 'center', marginRight: 4 }}>
      {!hasError && avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setHasError(true)}
        />
      ) : (
        <Image
          source={{ uri: fallbackUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      )}
    </View>
  );
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
  const vipListRef = React.useRef<FlatList>(null);
  const [currentVipIndex, setCurrentVipIndex] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const vipTasks = tasks.filter(t => t.is_vip && t.platform !== 'instagram');

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
      setJustLoggedIn(false);
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

      // Deduplicate tasks by task ID so all created tasks appear in feed
      const uniqueMap = new Map();
      validTasks.forEach((t: any) => {
        if (t.id && !uniqueMap.has(t.id)) {
          uniqueMap.set(t.id, t);
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
                      <View style={styles.vipPlatformBadge}>
                        <Ionicons name={task.platform === 'instagram' ? 'logo-instagram' : 'logo-youtube'} size={14} color={colors.white} />
                      </View>
                      <View style={styles.vipExpiryBadge}>
                        <Ionicons name="time-outline" size={11} color={colors.white} style={{ marginRight: 3 }} />
                        <Text style={styles.vipExpiryText}>{getTaskTimeLeft(task.created_at)}</Text>
                      </View>
                    </View>

                    <View style={styles.vipFooter}>
                      <Text style={styles.vipTitle} numberOfLines={2}>{task.title}</Text>
                      <View style={styles.vipFooterRow}>
                        <View style={styles.creatorProfile}>
                          <CreatorAvatar userId={task.users?.id || task.creator_user_id} username={task.users?.username} size={18} />
                          <Text style={styles.creatorName}>{task.users?.username ? `@${task.users.username}` : `Creator ${task.id.substring(0, 4)}`}</Text>
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

          {tasks.length === 0 ? (
            <View style={styles.emptyTx}>
              <Y2KCharacter type="bored" size={70} animate={true} style={{ marginBottom: spacing[3] }} />
              <Text style={styles.emptyTxText}>{COPY.home.tasksEmpty}</Text>
            </View>
          ) : (
            (() => {
              const instaTasks = tasks.filter(t => t.platform === 'instagram').sort((a, b) => (b.is_vip ? 1 : 0) - (a.is_vip ? 1 : 0));
              const ytTasks = tasks.filter(t => t.platform !== 'instagram' && !t.is_vip);

              const renderYtTask = (task: any, i: number) => {
                const vid = getYouTubeId(task.video_url);
                const ytThumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null;
                const localThumb = getThumbnailSource(task.thumbnail_id);

                return (
                  <StaggeredItem key={task.id} index={i} style={styles.taskCard}>
                    {i === 0 && <Text style={[styles.sectionTitle, { marginBottom: spacing[3] }]}>YouTube Tasks</Text>}
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
                          <Ionicons name="logo-youtube" size={14} color={colors.white} />
                        </View>
                        <View style={styles.taskTimeOverlay}>
                          <Text style={styles.taskTimeText}>{Math.floor(task.required_watch_time / 60)}:{(task.required_watch_time % 60).toString().padStart(2, '0')}</Text>
                        </View>
                        <View style={styles.ytExpiryOverlay}>
                          <Ionicons name="time-outline" size={10} color={colors.white} style={{ marginRight: 3 }} />
                          <Text style={styles.ytExpiryText}>{getTaskTimeLeft(task.created_at)}</Text>
                        </View>
                      </View>

                      <View style={styles.taskCardBodyNew}>
                        <Text style={styles.taskTitleNew} numberOfLines={2}>
                          {task.title}
                        </Text>
                        <View style={styles.taskCreatorRow}>
                          <CreatorAvatar userId={task.users?.id || task.creator_user_id} username={task.users?.username} size={20} />
                          <Text style={styles.taskCreatorText}>{task.users?.username ? `@${task.users.username}` : `Creator ${task.id.substring(0, 4)}`}</Text>
                        </View>
                      </View>
                    </AnimatedPressable>
                  </StaggeredItem>
                );
              };

              const renderInstaSection = () => {
                if (instaTasks.length === 0) return null;
                return (
                  <View style={{ marginBottom: spacing[5], marginTop: spacing[2] }}>
                    <Text style={[styles.sectionTitle, { marginBottom: spacing[3] }]}>Instagram Tasks</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginHorizontal: -spacing[4] }}
                      contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[2] }}
                    >
                      {instaTasks.map((task) => {
                        const localThumb = getThumbnailSource(task.thumbnail_id);
                        return (
                          <AnimatedPressable
                            key={task.id}
                            style={styles.instaShortCard}
                            onPress={() => navigation.navigate('TaskScreen', { task })}
                            scaleTo={animation.pressScale}
                          >
                            <View style={[styles.instaShortThumbContainer, task.is_vip && { borderWidth: 2, borderColor: colors.lime }]}>
                              {localThumb ? (
                                <Image source={localThumb} style={styles.instaShortImage} resizeMode="cover" />
                              ) : (
                                <View style={[styles.instaShortImage, { backgroundColor: colors.bgSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                                  <Ionicons name="logo-instagram" size={28} color={colors.textMuted} />
                                </View>
                              )}
                              <View style={styles.instaShortOverlay}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                  <View style={[styles.instaShortPlatformBadge, task.is_vip && { backgroundColor: colors.lime }]}>
                                    <Ionicons name="logo-instagram" size={12} color={task.is_vip ? colors.black : colors.white} />
                                  </View>
                                  <View style={styles.instaShortExpiryBadge}>
                                    <Ionicons name="time-outline" size={8} color={colors.white} style={{ marginRight: 1 }} />
                                    <Text style={styles.instaShortExpiryText}>{getTaskTimeLeft(task.created_at)}</Text>
                                  </View>
                                </View>
                                <View style={{ flex: 1 }} />
                                <View style={[styles.instaShortRewardBadge, task.is_vip && { backgroundColor: colors.lime }]}>
                                  <Text style={[styles.instaShortRewardText, task.is_vip && { color: colors.black, fontWeight: '900' }]}>+{task.is_vip ? '2 BUG\'s' : '1 BUG'}</Text>
                                </View>
                              </View>
                            </View>
                            <Text style={styles.instaShortTitle} numberOfLines={2}>{task.title}</Text>
                            <View style={styles.instaShortCreatorRow}>
                              <CreatorAvatar userId={task.users?.id || task.creator_user_id} username={task.users?.username} size={14} />
                              <Text style={styles.instaShortCreatorName} numberOfLines={1}>{task.users?.username ? `@${task.users.username}` : `Creator`}</Text>
                            </View>
                          </AnimatedPressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              };

              const ytFirstBatch = ytTasks.slice(0, 2);
              const ytSecondBatch = ytTasks.slice(2);

              return (
                <View>
                  {ytFirstBatch.map((task, i) => renderYtTask(task, i))}
                  {renderInstaSection()}
                  {ytSecondBatch.map((task, i) => renderYtTask(task, i + 2))}
                </View>
              );
            })()
          )}
        </View>


      </ScrollView>
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
    paddingHorizontal: spacing[4],
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
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
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
  instaShortCard: {
    width: 104,
    gap: spacing[1],
  },
  instaShortThumbContainer: {
    width: 104,
    height: 160,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...shadows.sm,
  },
  instaShortImage: {
    width: '100%',
    height: '100%',
  },
  instaShortOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: spacing[2],
  },
  instaShortPlatformBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  vipExpiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  vipExpiryText: {
    fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  ytExpiryOverlay: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  ytExpiryText: {
    fontFamily,
    fontSize: 8,
    fontWeight: '800',
    color: colors.white,
  },
  instaShortExpiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  instaShortExpiryText: {
    fontFamily,
    fontSize: 7.5,
    fontWeight: '800',
    color: colors.white,
  },
  instaShortRewardBadge: {
    backgroundColor: colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  instaShortRewardText: {
    fontFamily,
    fontSize: 10,
    fontWeight: '800',
    color: colors.black,
  },
  instaShortTitle: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  instaShortCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  instaShortCreatorName: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    flex: 1,
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
