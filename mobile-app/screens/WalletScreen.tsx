import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  Animated, Alert, Image, ActivityIndicator, Linking, Platform,
  PanResponder, AppState, Modal, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { colors, typography, spacing, radii, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTextInput, InputBox } from '../theme/inputs';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Audio } from 'expo-av';
import { COPY } from '../theme/copy';
import * as Clipboard from 'expo-clipboard';
import Y2KNote from '../theme/Y2KNote';
import Y2KAlertPopup from '../theme/Y2KAlertPopup';
import { useSmsReader, requestSmsPermission } from '../lib/useSmsReader';
// PaymentPermissionModal removed — auto-verify setup popup permanently disabled

// ─────────────────────────────────────────────────────────────────────────────
// CASHFREE FEATURE FLAG (Disabled — using manual UPI flow with 3 UPI handles)
// ─────────────────────────────────────────────────────────────────────────────
const CASHFREE_ENABLED = false;

const DEFAULT_UPI_IDS = [
  'theonlyvip786@okaxis',
];
const DEFAULT_UPI_NAME = 'SubMe Admin';

// ── Pending Payment Banner ───────────────────────────────────────────────────
function PendingPaymentBanner({ count }: { count: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.65, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (count === 0) return null;
  return (
    <View style={pendingStyles.banner}>
      <Animated.View style={[pendingStyles.dot, { opacity: pulseAnim }]} />
      <View style={pendingStyles.textWrap}>
        <Text style={pendingStyles.title}>
          {count} Payment{count > 1 ? 's' : ''} Being Verified
        </Text>
        <Text style={pendingStyles.subtitle}>
          Admin will credit your BUG's once confirmed. Usually within a few hours.
        </Text>
      </View>
      <Ionicons name="time-outline" size={20} color={colors.black} style={{ opacity: 0.5 }} />
    </View>
  );
}

const pendingStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderRadius: radii.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    gap: spacing[3],
    borderWidth: 1.5,
    borderColor: 'rgba(22,18,15,0.12)',
    ...shadows.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.black,
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  title: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.black,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.black,
    opacity: 0.65,
    lineHeight: 16,
  },
});

// ── Cashfree Pay Button ───────────────────────────────────────────────────────
function CashfreePayButton({ amount, onPress, disabled }: { amount: string; onPress: () => void; disabled?: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();

  const shimmerOpacity = shimmerAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.15, 0] });

  return (
    <Animated.View style={[cfStyles.wrapper, { transform: [{ scale: scaleAnim }], opacity: disabled ? 0.5 : 1 }]}>
      <TouchableOpacity
        style={cfStyles.btn}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <View style={cfStyles.left}>
          <View style={cfStyles.iconBox}>
            <Ionicons name="card" size={20} color={colors.white} />
          </View>
          <View>
            <Text style={cfStyles.label}>Pay with Cashfree</Text>
            <Text style={cfStyles.sub}>Secure • Instant • All UPI / Cards / Net Banking</Text>
          </View>
        </View>
        <View style={cfStyles.amountPill}>
          <Text style={cfStyles.amountText}>₹{amount || '0'}</Text>
        </View>
      </TouchableOpacity>
      {/* Shimmer overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, cfStyles.shimmer, { opacity: shimmerOpacity }]} pointerEvents="none" />
    </Animated.View>
  );
}

const cfStyles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginTop: spacing[6],
    marginBottom: spacing[2],
    ...shadows.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.black,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flex: 1 },
  iconBox: {
    width: 40, height: 40, borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  label: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  sub: {
    fontFamily,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  amountPill: {
    backgroundColor: colors.lime,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    marginLeft: spacing[2],
  },
  amountText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.black,
  },
  shimmer: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
  },
});

function BalanceCard({ points, email }: { points: number, email?: string }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: animation.duration.slow, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...animation.spring.soft, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.balanceCardOuter, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.balanceCard, { backgroundColor: colors.lime }]}>
        <Text style={styles.balanceLabel}>{COPY.wallet.balanceLabel}</Text>
        <Text style={styles.balanceAmount}>{points.toLocaleString()} BUG's</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>~₹{points.toLocaleString()} INR (1 BUG = ₹1.00 INR)</Text>
        </View>
        {email ? (
          <Text style={{ fontFamily, fontSize: typography.size.sm, color: 'rgba(0,0,0,0.6)', marginTop: spacing[3] }}>
            Account: {email}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function SwipeToPay({ amount, onSwipeComplete, disabled }: { amount: string; onSwipeComplete: () => void; disabled?: boolean }) {
  const pan = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const handleSize = 48;
  const maxDistance = Math.max(containerWidth - handleSize - 8, 1);

  // Looping arrow animation for double chevrons to shimmer/pulse
  const arrowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const arrowTranslate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 6],
  });

  const arrowOpacity = arrowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 1, 0.35],
  });

  // Keep a reference to maxDistance so the PanResponder closure has access to the updated value
  const maxDistanceRef = useRef(1);
  useEffect(() => {
    maxDistanceRef.current = maxDistance;
  }, [maxDistance]);

  const onSwipeCompleteRef = useRef(onSwipeComplete);
  useEffect(() => {
    onSwipeCompleteRef.current = onSwipeComplete;
  }, [onSwipeComplete]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onPanResponderMove: (e, gestureState) => {
        const newVal = Math.max(0, Math.min(gestureState.dx, maxDistanceRef.current));
        pan.setValue(newVal);
      },
      onPanResponderRelease: (e, gestureState) => {
        const currentMax = maxDistanceRef.current;
        if (gestureState.dx >= currentMax * 0.7) { // 70% threshold is more user friendly
          Animated.timing(pan, {
            toValue: currentMax,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            onSwipeCompleteRef.current();
            setTimeout(() => {
              Animated.spring(pan, {
                toValue: 0,
                friction: 8,
                useNativeDriver: false,
              }).start();
            }, 1000);
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            friction: 8,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const textOpacity = pan.interpolate({
    inputRange: [0, Math.max(maxDistance, 10) * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.swipeContainer, disabled && { opacity: 0.5 }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Dynamic progress fill */}
      {!disabled && (
        <Animated.View style={[
          styles.swipeProgressFill,
          {
            width: Animated.add(pan, handleSize + 8),
          }
        ]} />
      )}

      <Animated.Text style={[styles.swipeText, { opacity: textOpacity }]}>
        Swipe to Pay ₹{amount || 0}
      </Animated.Text>

      {/* Looping animated double chevrons on the right */}
      <Animated.View style={[
        styles.swipeRightArrow,
        {
          opacity: arrowOpacity,
          transform: [{ translateX: arrowTranslate }],
        }
      ]}>
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: -6 }} />
      </Animated.View>

      <Animated.View
        style={[
          styles.swipeHandle,
          {
            transform: [{ translateX: pan }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Ionicons name="checkmark" size={20} color={colors.black} />
      </Animated.View>
    </View>
  );
}

export default function WalletScreen({ navigation }: any) {
  const { token, user, updateUser } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('100');
  const [pendingPaymentCount, setPendingPaymentCount] = useState(0);
  const [cashfreeLoading, setCashfreeLoading] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const swapRotate = useRef(new Animated.Value(0)).current;

  // ── Auto-Pay Detection State ──────────────────────────────────────────────
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [detectedUtr, setDetectedUtr] = useState('');
  const [detectedAmount, setDetectedAmount] = useState('');
  const [detectedBank, setDetectedBank] = useState('');
  const [smsAutoDetected, setSmsAutoDetected] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [proofScreenshot, setProofScreenshot] = useState<string | null>(null); // base64 URI
  const [proofPickerLoading, setProofPickerLoading] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const waitingForReturn = useRef(false);
  const modalSlide = useRef(new Animated.Value(300)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const tickScale = useRef(new Animated.Value(0)).current;
  const { detect: detectSms, isSupported } = useSmsReader();
  const [isScanningSms, setIsScanningSms] = useState(false);
  const [scanningSecondsLeft, setScanningSecondsLeft] = useState(30);
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // showPermModal removed — notification popup permanently disabled

  useEffect(() => {
    return () => {
      if (scanningIntervalRef.current) {
        clearInterval(scanningIntervalRef.current);
      }
    };
  }, []);

  const [upiConfig, setUpiConfig] = useState<{ name: string; handles: string[] }>({
    name: DEFAULT_UPI_NAME,
    handles: DEFAULT_UPI_IDS,
  });
  const [selectedUpiIndex, setSelectedUpiIndex] = useState(0);

  const fetchUpiConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/payments/upi-config`);
      if (res.data && Array.isArray(res.data.handles) && res.data.handles.length > 0) {
        setUpiConfig({
          name: res.data.name || DEFAULT_UPI_NAME,
          handles: res.data.handles,
        });
      }
    } catch {
      /* fallback to defaults */
    }
  }, []);

  const handlesList = upiConfig.handles.length > 0 ? upiConfig.handles : DEFAULT_UPI_IDS;
  const selectedUpiId = handlesList[selectedUpiIndex] || handlesList[0];

  // Ref so the AppState listener always sees the current amount without re-subscribing
  const purchaseAmountRef = useRef(purchaseAmount);
  useEffect(() => { purchaseAmountRef.current = purchaseAmount; }, [purchaseAmount]);

  const upiUrl = `upi://pay?pa=${selectedUpiId}&pn=${encodeURIComponent(upiConfig.name)}&am=${purchaseAmount}&cu=INR`;

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(res.data || []);
    } catch {
      setTransactions([]);
    } finally {
      setFetching(false);
    }
  }, [token]);

  // Fetch count of user's pending payment requests to show banner
  const fetchPendingPayments = useCallback(async () => {
    try {
      // Use the transactions list — pending UPI payments show up as pending topup type
      // We check the payment_requests endpoint via a dedicated call
      const res = await axios.get(`${API_URL}/api/payments/my-pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPendingPaymentCount(res.data?.count ?? 0);
    } catch {
      // Fallback: derive from transaction list (topup type without a matching approved entry)
      // Since this is a soft feature, silently ignore errors
      setPendingPaymentCount(0);
    }
  }, [token]);

  // ── Cashfree Payment Handler (STUB) ────────────────────────────────────────
  // TODO: When CASHFREE_ENABLED = true and backend is wired:
  //   1. POST /api/payments/create-order → get { order_id, payment_session_id }
  //   2. Open Cashfree checkout (WebView or Linking.openURL with session token)
  //   3. On return: POST /api/payments/verify-order { order_id }
  //   4. If success: show confetti + refresh balance
  const handleCashfreePayment = async () => {
    const amt = parseInt(purchaseAmount, 10);
    if (isNaN(amt) || amt < 50) {
      Alert.alert('Minimum Amount', 'Minimum top-up is ₹50.');
      return;
    }

    setCashfreeLoading(true);
    try {
      // Step 1: Create Cashfree order
      const orderRes = await axios.post(
        `${API_URL}/api/payments/create-order`,
        { amount: amt },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (orderRes.data.fallback === 'upi_manual') {
        // Gateway not ready — fall back to UPI manual flow
        Alert.alert(
          'Gateway Not Ready',
          'Online payment is coming soon! Please use the UPI manual flow for now.',
        );
        return;
      }

      const { order_id, payment_session_id } = orderRes.data;

      // Step 2: Open Cashfree checkout (Option A — In-app WebView chosen)
      // When API credentials are ready, open in-app WebView modal or React Native Cashfree PG SDK:
      //
      // Using WebView:
      // setCashfreeModalUrl(`https://payments.cashfree.com/order/#${payment_session_id}`);
      // setCashfreeModalVisible(true);
      //
      // Or using Cashfree React Native SDK:
      // import { CFPaymentGatewayService, CFEnvironment, CFSession } from 'react-native-cashfree-pg-sdk';
      // const session = new CFSession(payment_session_id, order_id, CFEnvironment.PRODUCTION);
      // CFPaymentGatewayService.doPayment(session);

      Alert.alert(
        'Coming Soon',
        `Order created (ID: ${order_id}). Connect Cashfree checkout when credentials are ready.`,
      );

      // Step 3: Verify order status after user returns
      // const verifyRes = await axios.post(
      //   `${API_URL}/api/payments/verify-order`,
      //   { order_id },
      //   { headers: { Authorization: `Bearer ${token}` } }
      // );
      // if (verifyRes.data.success) {
      //   setShowConfetti(true);
      //   setShowPaymentSuccess(true);
      //   await refreshAll(true);
      // }

    } catch (err: any) {
      const msg = err.response?.data?.error || 'Payment failed. Try again.';
      Alert.alert('Error', msg);
    } finally {
      setCashfreeLoading(false);
    }
  };

  const refreshAll = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      updateUser({ points: res.data.points });
    } catch { /* ignore */ }
    await Promise.all([fetchTransactions(), fetchUpiConfig()]);
    if (!silent) setRefreshing(false);
  };

  useEffect(() => {
    refreshAll(true);
    fetchUpiConfig();
    const unsub = navigation.addListener('focus', () => {
      refreshAll(true);
      fetchUpiConfig();
    });
    return unsub;
  }, [navigation, token, fetchUpiConfig]);

  // ── AppState Listener: detect when user returns from UPI app ────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      // IMPORTANT: update the ref FIRST, before any async operations.
      // This prevents stale-ref bugs when multiple state changes fire in quick succession.
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      const wasBackground = prevState === 'background' || prevState === 'inactive';
      const cameBack = nextState === 'active';

      if (wasBackground && cameBack && waitingForReturn.current) {
        waitingForReturn.current = false;

        // Check if SMS reading is supported (Android native only)
        if (Platform.OS === 'android' && isSupported) {
          // Check permission
          const hasPermission = await requestSmsPermission();
          if (!hasPermission) {
            // Permission denied — show manual screenshot upload immediately
            showPaymentModal(purchaseAmountRef.current);
            return;
          }

          // Reset scan states
          setScanningSecondsLeft(30);
          setIsScanningSms(true);

          let elapsed = 0;
          const checkSms = async () => {
            const smsResult = await detectSms(purchaseAmountRef.current);
            if (smsResult) {
              // Found! Cleanup scanner immediately
              if (scanningIntervalRef.current) {
                clearInterval(scanningIntervalRef.current);
                scanningIntervalRef.current = null;
              }
              setIsScanningSms(false);

              // ── AUTO-VERIFY (fast-track): submit directly to backend ──────
              setIsScanningSms(false);
              try {
                const autoRes = await axios.post(
                  `${API_URL}/api/payments/auto-verify`,
                  {
                    utr_number: smsResult.utrNumber,
                    amount: Math.round(parseFloat(smsResult.amount)),
                    bank_name: smsResult.bankName,
                    sms_timestamp_ms: smsResult.smsTimestampMs,
                    sms_raw: smsResult.raw,
                  },
                  { headers: { Authorization: `Bearer ${token}` } },
                );

                if (autoRes.data.auto_approved) {
                  // INSTANT CREDIT ✅
                  setShowConfetti(true);
                  setShowPaymentSuccess(true);
                  setTimeout(() => setShowConfetti(false), 5000);
                  await refreshAll(true);
                  // Update local balance immediately
                  updateUser({ points: (user?.points ?? 0) + autoRes.data.amount_credited });
                } else {
                  // Pending (suspicious flag or credit failure)
                  Alert.alert(
                    'Payment Received ✅',
                    autoRes.data.message || "Your payment is being verified. BUG's will be credited shortly.",
                  );
                  await fetchPendingPayments();
                }
              } catch (autoErr: any) {
                // Auto-verify failed — fall back to manual modal
                setDetectedUtr(smsResult.utrNumber);
                setDetectedAmount(smsResult.amount);
                setDetectedBank(smsResult.bankName);
                setSmsAutoDetected(true);
                setPayModalVisible(true);
                Animated.parallel([
                  Animated.spring(modalSlide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
                  Animated.timing(modalOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
                ]).start(() => {
                  Animated.spring(tickScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }).start();
                });
              }
              return true;
            }
            return false;
          };

          // Small delay before initial check to let SMS gateway deliver
          await new Promise((r) => setTimeout(r, 1000));
          const found = await checkSms();
          if (found) return;

          // Start scanning interval (ticks every 1s for countdown, queries SMS every 2s)
          scanningIntervalRef.current = setInterval(async () => {
            elapsed += 1;
            setScanningSecondsLeft(Math.max(0, 30 - elapsed));

            if (elapsed % 2 === 0) {
              const foundLater = await checkSms();
              if (foundLater) return;
            }

            if (elapsed >= 30) {
              if (scanningIntervalRef.current) {
                clearInterval(scanningIntervalRef.current);
                scanningIntervalRef.current = null;
              }
              setIsScanningSms(false);
              // Do NOT open screenshot upload modal!
              Alert.alert(
                'Payment SMS Not Detected',
                'We could not detect the payment SMS within 30 seconds. If you made the payment, please contact support.'
              );
            }
          }, 1000);
        } else {
          // iOS, Web, or unsupported environment: show manual entry form immediately
          showPaymentModal(purchaseAmountRef.current);
        }
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  const showPaymentModal = (amount: string) => {
    setDetectedUtr('');
    setDetectedAmount(amount);
    setDetectedBank('');
    setSmsAutoDetected(false);
    setPayModalVisible(true);
    Animated.parallel([
      Animated.spring(modalSlide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const handlePayViaApp = async () => {
    const amt = parseInt(purchaseAmount, 10);
    if (isNaN(amt) || amt < 50) {
      Alert.alert('Minimum Amount', 'Minimum purchase is 50 points.');
      return;
    }

    const currentDynamicUpiUrl = `upi://pay?pa=${selectedUpiId}&pn=${encodeURIComponent(upiConfig.name)}&am=${amt}&cu=INR`;

    // Reset modal animation values
    tickScale.setValue(0);
    modalSlide.setValue(300);
    modalOpacity.setValue(0);

    if (Platform.OS === 'web') {
      showPaymentModal(purchaseAmount);
      return;
    }

    // Mark as waiting BEFORE opening UPI app
    waitingForReturn.current = true;

    try {
      // Directly attempt to open UPI — skip canOpenURL
      await Linking.openURL(currentDynamicUpiUrl);
    } catch {
      waitingForReturn.current = false;
      showPaymentModal(purchaseAmount);
    }
  };

  const closePayModal = () => {
    Animated.parallel([
      Animated.timing(modalSlide, { toValue: 300, duration: 200, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setPayModalVisible(false);
      setDetectedUtr('');
      setSmsAutoDetected(false);
      setProofScreenshot(null);
      tickScale.setValue(0);
    });
  };

  const pickProofScreenshot = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Allow photo access to upload your payment screenshot.');
      return;
    }
    setProofPickerLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        setProofScreenshot(`data:image/jpg;base64,${result.assets[0].base64}`);
      }
    } finally {
      setProofPickerLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    const utr = detectedUtr.trim();
    if (!utr) {
      Alert.alert('UTR Required', 'Please enter the UTR / Transaction ID from your bank SMS or payment app.');
      return;
    }
    if (!proofScreenshot) {
      Alert.alert('Screenshot Required', 'Please upload a screenshot of your payment receipt for verification.');
      return;
    }
    const amt = parseInt(detectedAmount || purchaseAmount, 10);
    if (isNaN(amt) || amt < 50) {
      Alert.alert('Invalid Amount', 'Minimum payment is ₹50.');
      return;
    }

    setPaySubmitting(true);
    try {
      // First verify UTR is not a duplicate
      const verifyRes = await axios.post(
        `${API_URL}/api/payments/verify-utr`,
        { utr_number: utr },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!verifyRes.data.valid) {
        Alert.alert('Already Submitted', 'This UTR has already been submitted. Contact support if this is a mistake.');
        setPaySubmitting(false);
        return;
      }

      // Submit payment with BOTH UTR and screenshot
      await axios.post(
        `${API_URL}/api/payments/manual`,
        { amount: amt, utr_number: utr, screenshot: proofScreenshot, auto_detected: smsAutoDetected },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      closePayModal();
      
      Audio.Sound.createAsync({ uri: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3' })
        .then(({ sound }) => sound.playAsync())
        .catch(() => {});
        
      setShowConfetti(true);
      setShowPaymentSuccess(true);
      setTimeout(() => setShowConfetti(false), 5000);
      await fetchTransactions();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Submission failed. Try again.');
    } finally {
      setPaySubmitting(false);
    }
  };

  const handleDownloadQR = () => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = '/upi-qr.jpg';
      link.download = 'upi-qr-code.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      Alert.alert('Download QR', 'Save the QR from your gallery or web export.');
    }
  };

  const handleManualPayment = async () => {
    if (parseInt(purchaseAmount, 10) < 50) {
      Alert.alert('Minimum Amount', 'Minimum purchase is 50 points.');
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Allow photo access to upload payment proof.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const base64Img = `data:image/jpg;base64,${result.assets[0].base64}`;
      await axios.post(`${API_URL}/api/payments/manual`, {
        screenshot: base64Img,
        amount: parseInt(purchaseAmount, 10),
        utr_number: utrNumber || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Submitted', 'Payment proof sent. Points credited after admin review.');
      setUtrNumber('');
      await fetchTransactions();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleSwapPress = () => {
    Animated.sequence([
      Animated.timing(swapRotate, { toValue: 1, duration: animation.duration.normal, useNativeDriver: true }),
      Animated.timing(swapRotate, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
  };

  const swapSpin = swapRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{COPY.wallet.title}</Text>
        <View style={styles.coinsBadge}>
          <Y2KNote size={14} style={{ marginRight: 6 }} />
          <Text style={styles.coinsText}>{(user?.points || 0).toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshAll(false)} tintColor={colors.black} />}
        contentContainerStyle={styles.scrollContent}
      >
        <BalanceCard points={user?.points || 0} email={user?.email} />

        {/* ─── Pending Payment Banner ─────────────────────────────────── */}
        {pendingPaymentCount > 0 && (
          <PendingPaymentBanner count={pendingPaymentCount} />
        )}


        <View style={styles.transSection}>
          <Text style={styles.transTitle}>{COPY.wallet.topUpTitle}</Text>

          {/* FROM INPUT BOX */}
          <Text style={styles.swapInputLabel}>From</Text>
          <View style={styles.swapInputRow}>
            <AppTextInput
              variant="flat"
              style={styles.swapTextInput}
              value={purchaseAmount}
              onChangeText={(t) => setPurchaseAmount(t.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="100"
            />
            <View style={styles.swapCurrencyPill}>
              <Text style={styles.swapCurrencyText}>INR</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textPrimary} style={{ marginLeft: 4 }} />
            </View>
          </View>
          <Text style={styles.swapHelperText}>{COPY.wallet.topUpHint}</Text>

          {/* SWAP ICON DIVIDER */}
          <View style={styles.swapDividerRow}>
            <View style={styles.swapDividerLine} />
            <AnimatedPressable onPress={handleSwapPress} style={styles.swapArrowCircle}>
              <Animated.View style={{ transform: [{ rotate: swapSpin }] }}>
                <Ionicons name="swap-vertical" size={16} color={colors.white} />
              </Animated.View>
            </AnimatedPressable>
            <View style={styles.swapDividerLine} />
          </View>

          {/* TO INPUT BOX */}
          <Text style={styles.swapInputLabel}>To</Text>
          <View style={styles.swapInputRow}>
            <Text style={styles.swapTextDisplay}>{purchaseAmount || '0'}</Text>
            <View style={styles.swapCurrencyPill}>
              <Text style={styles.swapCurrencyText}>BUG's</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textPrimary} style={{ marginLeft: 4 }} />
            </View>
          </View>
          <Text style={styles.swapHelperText}>Credited after admin approval</Text>
        </View>

        {/* ─── Payment Warning Banner ──────────────────────────────── */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={18} color="#92400e" style={{ flexShrink: 0, marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Important Payment Notice</Text>
            <Text style={styles.warningText}>
              After paying via UPI, you MUST submit UTR number + payment screenshot below. BUG's are credited only after admin verification (usually within a few hours).
            </Text>
          </View>
        </View>

        {/* ─── UPI Handle Selector & Copy Box ──────────────────────── */}
        <View style={styles.upiCardContainer}>
          <View style={[styles.upiCardHeader, { marginBottom: 6 }]}>
            <Ionicons name="qr-code-outline" size={18} color={colors.black} />
            <Text style={styles.upiCardTitle} numberOfLines={1}>Select Pay Handle</Text>
          </View>
          <Text style={styles.upiCardSubtitle}>
            Tap a handle to select it for instant payment, or click copy to pay manually:
          </Text>

          {handlesList.map((handle, idx) => {
            const isSelected = idx === selectedUpiIndex;
            return (
              <TouchableOpacity
                key={handle}
                style={[styles.upiHandleRow, isSelected && styles.upiHandleRowSelected]}
                onPress={() => setSelectedUpiIndex(idx)}
                activeOpacity={0.8}
              >
                <View style={styles.upiHandleLeft}>
                  <View style={[styles.upiRadioCircle, isSelected && styles.upiRadioCircleSelected]}>
                    {isSelected && <View style={styles.upiRadioDot} />}
                  </View>
                  <Text style={[styles.upiHandleText, isSelected && styles.upiHandleTextSelected]}>
                    {handle}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.copyHandleBtn}
                  onPress={async () => {
                    await Clipboard.setStringAsync(handle);
                    Alert.alert('Copied!', `${handle} copied to clipboard.`);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="copy-outline" size={14} color={colors.black} style={{ marginRight: 4 }} />
                  <Text style={styles.copyHandleBtnText}>Copy</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Payment Action Button ─────────────────────────────────── */}
        {CASHFREE_ENABLED ? (
          <>
            <CashfreePayButton
              amount={purchaseAmount}
              onPress={handleCashfreePayment}
              disabled={parseInt(purchaseAmount || '0', 10) < 50 || cashfreeLoading}
            />
            {cashfreeLoading && (
              <View style={{ alignItems: 'center', marginTop: spacing[2], marginBottom: spacing[4] }}>
                <ActivityIndicator color={colors.black} size="small" />
                <Text style={{ fontFamily, fontSize: typography.size.xs, color: colors.textMuted, marginTop: 6 }}>
                  Creating secure payment session...
                </Text>
              </View>
            )}
            <Text style={styles.cashfreeDisclaimerText}>
              Secured by Cashfree Payments · 256-bit SSL · RBI Compliant
            </Text>
          </>
        ) : (
          <SwipeToPay
            amount={purchaseAmount}
            onSwipeComplete={handlePayViaApp}
            disabled={parseInt(purchaseAmount || '0', 10) < 50}
          />
        )}

        <Text style={styles.historyTitle}>Recent Transactions</Text>
        {fetching ? (
          <ActivityIndicator color={colors.black} style={{ marginTop: 16 }} />
        ) : transactions.length === 0 ? (
          <Text style={styles.emptyTxt}>No transactions yet.</Text>
        ) : (
          transactions.slice(0, 10).map((tx: any, i: number) => (
            <StaggeredItem key={tx.id} index={i} style={styles.txRow}>
              <View style={styles.txIcon}>
                <Ionicons name="wallet-outline" size={18} color={colors.white} />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txType}>{tx.type}</Text>
                <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
              </View>
              <Text style={[styles.txAmount, tx.amount > 0 ? styles.txPos : styles.txNeg]}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </Text>
            </StaggeredItem>
          ))
        )}
      </ScrollView>

      {/* ─── SMS Scanning Overlay / Modal ─────────────────────────────────── */}
      <Modal transparent visible={isScanningSms} animationType="fade">
        <View style={styles.scanningBackdrop}>
          <View style={styles.scanningCard}>
            <ActivityIndicator size="large" color={colors.black} style={{ marginBottom: 16 }} />
            <Text style={styles.scanningTitle}>Verifying Payment SMS...</Text>
            <Text style={styles.scanningSubtitle}>
              Checking for bank SMS confirmation. Please wait.
            </Text>
            <View style={styles.scanningTimerContainer}>
              <Text style={styles.scanningTimerText}>{scanningSecondsLeft}s remaining</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (scanningIntervalRef.current) {
                  clearInterval(scanningIntervalRef.current);
                  scanningIntervalRef.current = null;
                }
                setIsScanningSms(false);
                waitingForReturn.current = false;
              }}
              style={styles.scanningCancelBtn}
            >
              <Text style={styles.scanningCancelText}>Cancel Scan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Payment Detection Modal ─────────────────────────────────────── */}
      <Modal transparent visible={payModalVisible} animationType="none" onRequestClose={closePayModal}>
        <Animated.View style={[styles.modalBackdrop, { opacity: modalOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closePayModal} />
        </Animated.View>

        <Animated.View style={[
          styles.modalSheet,
          { transform: [{ translateY: modalSlide }] },
        ]}>
          {/* Handle bar */}
          <View style={styles.modalHandle} />

          {smsAutoDetected ? (
            /* ── SMS Auto-Detected State ── */
            <>
              <Animated.View style={[styles.modalTickCircle, { transform: [{ scale: tickScale }] }]}>
                <Ionicons name="checkmark" size={36} color={colors.white} />
              </Animated.View>
              <Text style={styles.modalTitle}>Payment Detected!</Text>
              <Text style={styles.modalSubtitle}>
                UTR auto-filled. Upload your payment screenshot to complete verification.
              </Text>

              <View style={styles.modalDetectedRow}>
                <View style={styles.modalDetectedBox}>
                  <Text style={styles.modalDetectedLabel}>Bank</Text>
                  <Text style={styles.modalDetectedValue}>{detectedBank}</Text>
                </View>
                <View style={styles.modalDetectedBox}>
                  <Text style={styles.modalDetectedLabel}>Amount</Text>
                  <Text style={styles.modalDetectedValue}>₹{detectedAmount}</Text>
                </View>
              </View>

              <View style={styles.modalUtrBox}>
                <Text style={styles.modalUtrLabel}>UTR / Reference No.</Text>
                <Text style={styles.modalUtrValue}>{detectedUtr}</Text>
              </View>
            </>
          ) : (
            /* ── Manual UTR Entry State ── */
            <>
              <View style={styles.modalPayIcon}>
                <Ionicons name="card-outline" size={28} color={colors.black} />
              </View>
              <Text style={styles.modalTitle}>Submit Payment Proof</Text>
              <Text style={styles.modalSubtitle}>
                Both UTR number and a payment screenshot are required for verification.
              </Text>

              <View style={styles.modalUtrBox}>
                <Text style={styles.modalUtrLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={detectedAmount}
                  onChangeText={(t) => setDetectedAmount(t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder={purchaseAmount}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={[styles.modalUtrBox, { marginTop: spacing[3] }]}>
                <Text style={styles.modalUtrLabel}>UTR / Transaction ID *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={detectedUtr}
                  onChangeText={setDetectedUtr}
                  placeholder="e.g. 508612345678"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
                <Text style={styles.modalInputHint}>Find this in your bank SMS or UPI app history</Text>
              </View>
            </>
          )}

          {/* ── Screenshot Upload (required for BOTH states) ── */}
          <TouchableOpacity
            style={[
              styles.modalScreenshotBtn,
              proofScreenshot ? styles.modalScreenshotBtnDone : null,
            ]}
            onPress={pickProofScreenshot}
            disabled={proofPickerLoading}
            activeOpacity={0.8}
          >
            {proofPickerLoading ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : proofScreenshot ? (
              <>
                <Ionicons name="checkmark-circle" size={20} color={colors.black} />
                <Text style={styles.modalScreenshotBtnText}>Screenshot Uploaded ✓</Text>
                <Text style={styles.modalScreenshotChange}>Change</Text>
              </>
            ) : (
              <>
                <Ionicons name="camera-outline" size={20} color={colors.black} />
                <Text style={styles.modalScreenshotBtnText}>Upload Payment Screenshot *</Text>
              </>
            )}
          </TouchableOpacity>
          {proofScreenshot ? (
            <Image
              source={{ uri: proofScreenshot }}
              style={styles.modalScreenshotPreview}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.modalScreenshotHint}>
              Required — take a screenshot of the payment confirmation from your UPI or banking app
            </Text>
          )}

          {/* Confirm button */}
          <TouchableOpacity
            style={[styles.modalConfirmBtn, paySubmitting && { opacity: 0.7 }]}
            onPress={handleConfirmPayment}
            disabled={paySubmitting}
            activeOpacity={0.85}
          >
            {paySubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.modalConfirmText}>
                {smsAutoDetected ? 'Confirm & Submit' : 'Submit Payment'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={closePayModal} style={styles.modalCancelBtn}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* Congratulations Popup */}
      <Y2KAlertPopup
        visible={showPaymentSuccess}
        onClose={() => { setShowPaymentSuccess(false); }}
        characterType="joyful"
        title="Payment Verified! ⚡"
        description={`Your BUG's have been added instantly via SMS auto-verification! No waiting required.`}
        actionText="Let's Go! 🎉"
      />

      {/* Bigger and Smoother Confetti */}
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
      {/* PaymentPermissionModal permanently removed */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgPrimary },
  scrollContent: { paddingHorizontal: spacing[6], paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  headerTitle: {
    fontFamily,
    fontSize: 24,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: typography.tracking.tight,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: radii.sm,
    backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', ...shadows.sm,
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
  swipeProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.lime,
    borderRadius: 14,
  },
  coinsText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  dot: {
    position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.pink, borderWidth: 2, borderColor: colors.bgPrimary,
  },
  balanceCardOuter: {
    marginBottom: spacing[6],
  },
  balanceCard: {
    borderRadius: radii['2xl'],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    ...shadows.md,
  },
  balanceLabel: {
    fontFamily, fontSize: typography.size.sm, fontWeight: typography.weight.medium,
    color: colors.black, opacity: 0.65, marginBottom: spacing[2],
  },
  balanceAmount: {
    fontFamily, fontSize: 24, fontWeight: typography.weight.black,
    color: colors.black, letterSpacing: typography.tracking.tight, marginBottom: spacing[1],
  },
  parityLabel: {
    fontFamily, fontSize: typography.size.sm, fontWeight: typography.weight.bold,
    color: colors.black, opacity: 0.8, marginBottom: spacing[4],
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, alignSelf: 'flex-start', gap: 6,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  chipText: { fontFamily, fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.black },
  transSection: { marginBottom: spacing[4] },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: '#fef3c7',
    borderRadius: radii.xl,
    padding: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[4],
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  warningTitle: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: '#92400e',
    marginBottom: 2,
  },
  warningText: {
    fontFamily,
    fontSize: typography.size.xs,
    color: '#92400e',
    lineHeight: 17,
    opacity: 0.9,
  },
  transTitle: {
    fontFamily, fontSize: typography.size.base, fontWeight: typography.weight.bold,
    color: colors.textPrimary, marginBottom: spacing[4],
  },
  swapInputLabel: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textMuted,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  swapInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    height: 64,
    paddingHorizontal: spacing[4],
    ...shadows.sm,
  },
  swapTextInput: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    flex: 1,
    padding: 0,
  },
  swapTextDisplay: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    flex: 1,
  },
  swapCurrencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.lg,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    alignSelf: 'flex-start',
    marginTop: spacing[2],
  },
  pillText: {
    color: colors.black,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  swapCurrencyText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  swapHelperText: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing[4], // Increased gap as requested
    marginBottom: spacing[5],
    marginLeft: spacing[1],
  },
  swapDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing[2],
  },
  swapDividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  swapArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing[3],
    ...shadows.sm,
  },
  swipeContainer: {
    height: 56,
    backgroundColor: '#333333',
    borderRadius: 16, // Rounded rectangle corners instead of capsules
    justifyContent: 'center',
    position: 'relative',
    marginTop: spacing[6],
    marginBottom: spacing[6],
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#333333',
    ...shadows.sm,
  },
  swipeText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.white,
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    alignSelf: 'center',
  },
  swipeRightArrow: {
    position: 'absolute',
    right: 16,
    alignSelf: 'center',
    flexDirection: 'row',
  },
  swipeHandle: {
    width: 48,
    height: 48,
    borderRadius: 12, // Rounded square handle matching reference image
    backgroundColor: colors.white, // White handle matching reference image
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 4,
    top: 2,
    borderWidth: 1.5,
    borderColor: '#16120F',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  historyTitle: {
    fontFamily, fontSize: typography.size.base, fontWeight: typography.weight.bold,
    color: colors.textPrimary, marginTop: spacing[8], marginBottom: spacing[4],
  },
  cashfreeDisclaimerText: {
    fontFamily,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[2],
    marginBottom: spacing[4],
    letterSpacing: 0.2,
  },
  emptyTxt: { fontFamily, fontSize: typography.size.sm, color: colors.textMuted, textAlign: 'center' },
  txRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderRadius: radii.xl, padding: spacing[4], marginBottom: spacing[3], gap: spacing[3], ...shadows.sm,
  },
  txIcon: {
    width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.black,
    justifyContent: 'center', alignItems: 'center',
  },
  txInfo: { flex: 1 },
  txType: { fontFamily, fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.textPrimary, textTransform: 'capitalize' },
  txDesc: { fontFamily, fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  txAmount: { fontFamily, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  txPos: { color: colors.textPrimary },
  txNeg: { color: colors.pink },
  exchangePayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.black,
    borderRadius: radii.lg,
    height: 56,
    paddingHorizontal: spacing[2],
    position: 'relative',
    marginTop: spacing[6],
    marginBottom: spacing[6],
    ...shadows.sm,
  },
  checkmarkSquare: {
    width: 40,
    height: 40,
    borderRadius: radii.sm - 2,
    borderWidth: 1.5,
    borderColor: colors.black,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing[1],
  },
  checkmarkText: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  exchangePayText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.black,
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  exchangePayChevron: {
    position: 'absolute',
    right: spacing[4],
  },

  // ── Payment Detection Modal ───────────────────────────────────────────────
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    paddingTop: spacing[4],
    alignItems: 'center',
    ...shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing[6],
  },
  modalTickCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalPayIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  modalTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  modalSubtitle: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[5],
    lineHeight: 20,
    paddingHorizontal: spacing[2],
  },
  modalDetectedRow: {
    flexDirection: 'row',
    gap: spacing[3],
    width: '100%',
    marginBottom: spacing[3],
  },
  modalDetectedBox: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[4],
    alignItems: 'center',
    ...shadows.sm,
  },
  modalDetectedLabel: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  modalDetectedValue: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  modalUtrBox: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[4],
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  modalUtrLabel: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  modalUtrValue: {
    fontFamily,
    fontSize: 18,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    letterSpacing: 1.5,
  },
  modalInput: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingVertical: spacing[2],
  },
  modalInputHint: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  modalConfirmBtn: {
    width: '100%',
    height: 56,
    backgroundColor: colors.black,
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[5],
  },
  modalConfirmText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  modalCancelBtn: {
    marginTop: spacing[3],
    paddingVertical: spacing[3],
  },
  modalCancelText: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  modalScreenshotBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[4],
    marginTop: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  modalScreenshotBtnDone: {
    borderStyle: 'solid',
    borderColor: colors.black,
    backgroundColor: colors.lime,
  },
  modalScreenshotBtnText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.black,
    flex: 1,
  },
  modalScreenshotChange: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  modalScreenshotPreview: {
    width: '100%',
    height: 120,
    borderRadius: radii.lg,
    marginTop: spacing[3],
  },
  modalScreenshotHint: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing[2],
    textAlign: 'center',
    lineHeight: 16,
  },
  scanningBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  scanningCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
    borderRadius: radii['2xl'],
    padding: spacing[6],
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    ...shadows.lg,
  },
  scanningTitle: {
    fontFamily,
    fontSize: 20,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  scanningSubtitle: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing[4],
  },
  scanningTimerContainer: {
    backgroundColor: colors.lavender,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginBottom: spacing[4],
  },
  scanningTimerText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  scanningCancelBtn: {
    paddingVertical: spacing[2],
  },
  scanningCancelText: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.pink,
    fontWeight: typography.weight.bold,
    textDecorationLine: 'underline',
  },
  // ── UPI Handles Card Styles ──────────────────────────────────────────────
  upiCardContainer: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[4],
    marginTop: spacing[4],
    marginBottom: spacing[2],
    borderWidth: 1.5,
    borderColor: 'rgba(22, 18, 15, 0.12)',
    ...shadows.sm,
  },
  upiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: 4,
  },
  upiCardTitle: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  upiCardSubtitle: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing[3],
    lineHeight: 16,
  },
  upiHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(22, 18, 15, 0.03)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.08)',
  },
  upiHandleRowSelected: {
    backgroundColor: colors.lavender,
    borderColor: colors.black,
    borderWidth: 1.5,
  },
  upiHandleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  upiRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiRadioCircleSelected: {
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  upiRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.black,
  },
  upiHandleText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  upiHandleTextSelected: {
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  copyHandleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
  },
  copyHandleBtnText: {
    fontFamily,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
});
