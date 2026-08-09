import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, Alert, StyleSheet, Image,
    ActivityIndicator, ScrollView, RefreshControl, Animated, Platform, Linking, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, radii, shadows, fontFamily } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import { COPY } from '../theme/copy';
import Y2KNote from '../theme/Y2KNote';
import Y2KAlertPopup from '../theme/Y2KAlertPopup';
import Y2KCelebrationOverlay from '../theme/Y2KCelebrationOverlay';
import { getThumbnailSource } from '../assets/thumbnails';

function CreatorAvatar({ userId, username, size = 18 }: { userId?: string; username?: string; size?: number }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [userId, username]);

  const displayName = username || 'Creator';
  const cacheBust = Math.floor(Date.now() / 30000);
  const avatarUrl = userId ? `${SUPABASE_URL}/storage/v1/object/public/avatars/${userId}.jpg?v=${cacheBust}` : null;
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

function getInstagramEmbedUrl(url?: string): string {
    if (!url) return 'https://www.instagram.com';
    const match = url.match(/\/(?:reel|reels|p|share\/reel)\/([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
        return `https://www.instagram.com/p/${match[1]}/embed/captioned/`;
    }
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    if (cleanUrl.endsWith('/embed') || cleanUrl.endsWith('/embed/captioned')) {
        return cleanUrl;
    }
    return `${cleanUrl}/embed/captioned/`;
}

function getTaskTimeLeft(createdAt?: string): string {
    if (!createdAt) return '24h left';
    const created = new Date(createdAt).getTime();
    const expire = created + 24 * 60 * 60 * 1000;
    const diff = expire - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
}

const { width: screenWidth } = Dimensions.get('window');
const PLAYER_HEIGHT = Math.round((screenWidth - 48) * (9 / 16));
const REQUIRED_WATCH_TIME = 180; // 3 minutes in seconds

export default function TaskScreen({ route, navigation }: any) {
    const { task: initialTask } = route.params;
    const [task, setTask] = useState(initialTask);
    const { token, user } = useAuthStore();
    const [timer, setTimer] = useState(0);
    const [answer, setAnswer] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [subscribed, setSubscribed] = useState(false);
    const [proofImage, setProofImage] = useState<any>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [proofUploaded, setProofUploaded] = useState(false);
    const [videoReady, setVideoReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const taskData = task || {};
    const isInstagram = taskData.platform === 'instagram';
    const videoId = getYouTubeId(taskData.video_url || '');
    const watchTime = isInstagram ? 0 : (taskData.required_watch_time || REQUIRED_WATCH_TIME);
    const timerComplete = timer >= watchTime;
    const mcqDone = !taskData.mcq_question || answer !== null;
    // BUG-09: For YouTube tasks, user must have tapped Subscribe (subscribed=true) before submitting.
    // For Instagram tasks, subscribed is set to true when they tap 'Watch Reel on Instagram'.
    const isReady = timerComplete && mcqDone && subscribed && (proofUploaded || proofImage !== null);
    const progress = watchTime === 0 ? 1 : Math.min(timer / watchTime, 1);

    const handlePopupClose = () => {
        setShowSuccessPopup(false);
        setShowCelebration(false);
        navigation.goBack();
    };

    // Start task session on mount
    const hasStartedRef = React.useRef(false);
    useEffect(() => {
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            axios.post(`${API_URL}/api/tasks/${task.id}/start`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            }).catch(err => {
                console.warn('Session start error:', err);
                Alert.alert('Session Error', `Could not start task session: ${err.response?.data?.error || err.message}`);
            });
        }
    }, [task.id, token]);

    // Timer ticks ONLY when video is actively playing (pauses when user pauses video)
    useEffect(() => {
        if (isInstagram || timerComplete) return;

        if (isPlaying) {
            timerRef.current = setInterval(() => {
                setTimer(t => t + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isPlaying, isInstagram, timerComplete]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            const response = await axios.get(`${API_URL}/api/tasks`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const updatedTask = response.data.find((t: any) => t.id === taskData.id);
            if (updatedTask) setTask(updatedTask);
        } catch (_) {}
        setTimeout(() => setRefreshing(false), 500);
    };

    const submitTask = async () => {
        if (submitting) return;
        if (!timerComplete) return Alert.alert('Not Yet!', `Please watch for at least ${watchTime} seconds.`);
        if (!taskData.id) return Alert.alert('Error', 'Missing task ID.');
        if (!isInstagram && taskData.mcq_question && !answer) return Alert.alert('Answer Required', 'Please select an answer to the question.');
        if (!proofImage && !proofUploaded) return Alert.alert('Proof Required', 'Please select a screenshot proof from your gallery.');

        // Helper: safe user id segment for filename
        const req_user_safe = () => (user?.id || 'user').replace(/-/g, '').substring(0, 8);

        setSubmitting(true);
        try {
            // Upload proof screenshot if attached and compute SHA-256 hash
            let imageHash = '';
            let screenshotUrl = '';
            if (proofImage) {
                try {
                    // Compute SHA-256 hash of base64 data before upload
                    if (proofImage.base64) {
                        const cleanBase64 = proofImage.base64.replace(/^data:image\/\w+;base64,/, '');
                        imageHash = await Crypto.digestStringAsync(
                            Crypto.CryptoDigestAlgorithm.SHA256,
                            cleanBase64,
                            { encoding: Crypto.CryptoEncoding.HEX }
                        );
                    }

                    // Try uploading to Supabase Storage
                    const ext = (proofImage.uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
                    const fileName = `subscription-proofs/${taskData.id}_${req_user_safe()}_${Date.now()}.${ext}`;

                    try {
                        const response = await fetch(proofImage.uri);
                        const blob = await response.blob();
                        const { error: uploadError } = await supabase.storage
                            .from('screenshots')
                            .upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });
                        if (!uploadError) {
                            screenshotUrl = supabase.storage.from('screenshots').getPublicUrl(fileName).data.publicUrl;
                        } else {
                            console.log('Supabase storage upload error:', uploadError);
                        }
                    } catch (storageErr) {
                        console.log('Storage upload fallback:', storageErr);
                    }

                    // Fallback 1: Use base64 data URI if Supabase storage upload returned no publicUrl
                    if (!screenshotUrl && proofImage.base64) {
                        screenshotUrl = `data:image/jpeg;base64,${proofImage.base64}`;
                    }

                    // Fallback 2: Use local file URI
                    if (!screenshotUrl && proofImage.uri) {
                        screenshotUrl = proofImage.uri;
                    }

                    if (screenshotUrl) {
                        await axios.post(`${API_URL}/api/proofs/${taskData.id}`, {
                            screenshot_url: screenshotUrl,
                            image_hash: imageHash,
                        }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
                    }
                } catch (pErr) {
                    console.log('Proof upload note:', pErr);
                }
            }

            // Submit task to backend with hash and screenshot URL for server-side verification
            await axios.post(`${API_URL}/api/tasks/${taskData.id}/submit`, {
                mcq_answer: answer,
                screenshot_url: screenshotUrl,
                image_hash: imageHash,
            }, { headers: { Authorization: `Bearer ${token}` } });

            setShowCelebration(true);
            setShowSuccessPopup(true);
        } catch (error: any) {
            Alert.alert('Submission Failed', error.response?.data?.error || error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const pickProofImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert('Permission Required', 'Allow photo access to upload subscription proof.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
            base64: true,
        });
        if (result.canceled || !result.assets || !result.assets[0]) return;
        setProofImage(result.assets[0]);
        setProofUploaded(true);
    };

    const uploadProof = async () => {
        if (!proofImage) return Alert.alert('Select Screenshot', 'Please select your subscription screenshot first.');
        setProofUploaded(true);
        Alert.alert('Proof Attached!', 'Your subscription screenshot is attached and ready for submission.');
    };

    // Entry animation
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const slideAnim = React.useRef(new Animated.Value(20)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
        ]).start();
    }, []);

    const getReelDirectUrl = (task: any): string => {
        const vUrl = task?.video_url || '';
        const cUrl = task?.channel_url || '';

        if (vUrl.includes('/reel/') || vUrl.includes('/p/') || vUrl.includes('/reels/') || vUrl.includes('/share/reel/')) {
            return vUrl;
        }
        if (cUrl.includes('/reel/') || cUrl.includes('/p/') || cUrl.includes('/reels/') || cUrl.includes('/share/reel/')) {
            return cUrl;
        }
        return vUrl || cUrl;
    };

    const handleOpenInstaReel = () => {
        const reelUrl = getReelDirectUrl(taskData);
        if (reelUrl) {
            if (Platform.OS === 'web') {
                window.open(reelUrl, '_blank');
            } else {
                Linking.openURL(reelUrl).catch(() => {
                    Alert.alert('Error', 'Unable to open Instagram link');
                });
            }
        }
        setSubscribed(true);
    };

    // Build YouTube embed HTML with origin header to resolve Error 153 player configuration restriction
    const embedHtml = isInstagram ? `
    <!DOCTYPE html>
    <html>
    <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="margin:0;padding:0;background-color:#000;display:flex;justify-content:center;align-items:center;">
      <iframe src="${taskData.video_url ? taskData.video_url.replace(/\/$/, '') + '/embed' : ''}" width="100%" height="100%" frameborder="0" scrolling="no" allowtransparency="true"></iframe>
    </body>
    </html>
    ` : videoId ? `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        html, body { width:100%; height:100%; background-color:#000; overflow:hidden; }
        iframe { width:100%; height:100%; border:0; }
      </style>
    </head>
    <body>
      <iframe 
        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=https://www.youtube.com" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
        allowfullscreen
      ></iframe>
    </body>
    </html>
    ` : '';

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const remainingTime = Math.max(watchTime - timer, 0);

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Task</Text>
                    <View style={styles.coinsBadge}>
                        <Y2KNote size={14} style={{ marginRight: 6 }} />
                        <Text style={styles.coinsText}>{(user?.points || 0).toLocaleString()}</Text>
                    </View>
                </View>

                <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.charcoal} />}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Instagram Task Streamlined Flow vs YouTube Task Video Flow */}
                        {isInstagram ? (
                            <View style={styles.instaSection}>
                                {/* Instagram Task Header Card */}
                                <View style={styles.taskHeaderCard}>
                                    <View style={styles.instaHeaderRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.instaCardTitle}>{taskData.title}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 }}>
                                                <CreatorAvatar userId={taskData.users?.id || taskData.creator_user_id} username={taskData.users?.username} size={18} />
                                                <Text style={{ fontFamily, fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: '700' }}>
                                                    {taskData.users?.username ? `@${taskData.users.username}` : `Creator`}
                                                </Text>
                                            </View>
                                            <View style={styles.instaTagRow}>
                                                <View style={styles.instaBadgePill}>
                                                    <Text style={styles.instaBadgeText}>INSTAGRAM REEL</Text>
                                                </View>
                                                <View style={styles.rewardBadge}>
                                                    <Ionicons name="gift-outline" size={14} color={colors.black} />
                                                    <Text style={styles.rewardBadgeText}>+{taskData.is_vip ? "2 BUG's" : "1 BUG"}</Text>
                                                </View>
                                                <View style={styles.expiryTagPill}>
                                                    <Ionicons name="time-outline" size={12} color="#E1306C" />
                                                    <Text style={styles.expiryTagText}>{getTaskTimeLeft(taskData.created_at)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                    {/* Step 1: Watch Reel & Follow Creator */}
                                    <View style={styles.instaStepCard}>
                                        <View style={styles.stepHeaderRow}>
                                            <View style={styles.stepNumberBadge}>
                                                <Text style={styles.stepNumberText}>1</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.stepTitle}>Watch Reel & Follow Creator</Text>
                                                <Text style={styles.stepDesc}>Tap the poster below to open Reel on Instagram, watch content, and follow creator.</Text>
                                            </View>
                                        </View>

                                        {/* Reel Preview Card — Tap to open in Instagram App */}
                                        <TouchableOpacity 
                                            style={[styles.instaPlayCard, { width: '100%', aspectRatio: 9 / 15, marginTop: spacing[3], backgroundColor: '#121212' }]}
                                            activeOpacity={0.9}
                                            onPress={handleOpenInstaReel}
                                        >
                                            {getThumbnailSource(taskData.thumbnail_id) ? (
                                                <Image 
                                                    source={getThumbnailSource(taskData.thumbnail_id)} 
                                                    style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
                                                    resizeMode="cover" 
                                                />
                                            ) : (
                                                <View style={{ width: '100%', height: '100%', backgroundColor: '#000000', position: 'absolute' }} />
                                            )}
                                            
                                            {/* Center Play Badge */}
                                            <View style={styles.instaPlayCenterBox}>
                                                <View style={styles.instaGradientPlayBtn}>
                                                    <Ionicons name="play" size={32} color={colors.white} style={{ marginLeft: 4 }} />
                                                </View>
                                                <Text style={[styles.instaPlayTitle, { textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 }]}>Tap to Watch Reel on Instagram</Text>
                                                <Text style={[styles.instaPlaySub, { textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 }]}>Opens Reel directly in Instagram App</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Step 2 & 3: Unlocked ONLY after user taps 'Tap to Watch Reel' */}
                                    {subscribed && (
                                        <>
                                            {/* Step 2: Upload Proof Screenshot */}
                                            <View style={[styles.instaStepCard, { marginTop: spacing[4] }]}>
                                                <View style={styles.stepHeaderRow}>
                                                    <View style={[styles.stepNumberBadge, { backgroundColor: colors.blue }]}>
                                                        <Text style={[styles.stepNumberText, { color: colors.white }]}>2</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.stepTitle}>Upload Proof Screenshot</Text>
                                                        <Text style={styles.stepDesc}>Upload a screenshot showing you followed/liked on Instagram.</Text>
                                                    </View>
                                                </View>

                                                <TouchableOpacity
                                                    style={[styles.proofPicker, proofImage && styles.proofPickerDone]}
                                                    onPress={pickProofImage}
                                                    activeOpacity={0.75}
                                                >
                                                    {proofImage ? (
                                                        <View style={styles.proofPickerInner}>
                                                            <Ionicons name="checkmark-circle" size={26} color={colors.black} />
                                                            <Text style={styles.proofPickerTextDone}>Screenshot Selected ✓</Text>
                                                            <Text style={styles.proofPickerChange}>Tap to change</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.proofPickerInner}>
                                                            <Ionicons name="cloud-upload-outline" size={26} color="#E1306C" />
                                                            <Text style={styles.proofPickerText}>Select Screenshot from Gallery</Text>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>

                                                {proofImage && !proofUploaded && (
                                                    <AnimatedPressable
                                                        style={[styles.proofUploadBtn, { backgroundColor: '#E1306C', marginTop: spacing[3] }]}
                                                        onPress={uploadProof}
                                                        disabled={uploadingProof}
                                                    >
                                                        {uploadingProof ? (
                                                            <ActivityIndicator color={colors.white} size="small" />
                                                        ) : (
                                                            <>
                                                                <Ionicons name="send" size={16} color={colors.white} />
                                                                <Text style={[styles.proofUploadBtnText, { color: colors.white }]}>Send Proof to Creator</Text>
                                                            </>
                                                        )}
                                                    </AnimatedPressable>
                                                )}

                                                {proofUploaded && (
                                                    <View style={styles.proofSuccess}>
                                                        <Ionicons name="checkmark-circle" size={20} color="#059669" />
                                                        <Text style={styles.proofSuccessText}>Proof Sent to Creator ✓</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </>
                                    )}

                                    {/* Step 3: Quick Question (MCQ) - Always visible so user can see it */}
                                    {taskData.mcq_question && (
                                        <View style={[styles.instaStepCard, { marginTop: spacing[4], borderLeftWidth: 4, borderLeftColor: '#E1306C' }]}>
                                            <View style={styles.stepHeaderRow}>
                                                <View style={[styles.stepNumberBadge, { backgroundColor: '#E1306C' }]}>
                                                    <Text style={[styles.stepNumberText, { color: colors.white }]}>3</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.stepTitle}>Quick Question</Text>
                                                    <Text style={[styles.stepDesc, { color: colors.textPrimary, fontWeight: '700', fontSize: typography.size.sm, marginTop: 2 }]}>
                                                        {taskData.mcq_question}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={[styles.optionsWrap, { marginTop: spacing[4] }]}>
                                                {(taskData.mcq_options || []).map((opt: string, index: number) => {
                                                    const letter = String.fromCharCode(65 + index); // A, B, C, D
                                                    const isSelected = answer === opt;
                                                    return (
                                                        <AnimatedPressable
                                                            key={`${opt}-${index}`}
                                                            style={[
                                                                styles.option,
                                                                isSelected && { backgroundColor: '#FFF0F5', borderColor: '#E1306C', borderWidth: 2 }
                                                            ]}
                                                            onPress={() => setAnswer(opt)}
                                                        >
                                                            <View style={{
                                                                width: 28,
                                                                height: 28,
                                                                borderRadius: 14,
                                                                backgroundColor: isSelected ? '#E1306C' : 'rgba(0,0,0,0.06)',
                                                                justifyContent: 'center',
                                                                alignItems: 'center',
                                                            }}>
                                                                <Text style={{
                                                                    fontFamily,
                                                                    fontSize: 12,
                                                                    fontWeight: '800',
                                                                    color: isSelected ? colors.white : colors.textSecondary
                                                                }}>
                                                                    {letter}
                                                                </Text>
                                                            </View>
                                                            <Text style={[
                                                                styles.optText,
                                                                { flex: 1 },
                                                                isSelected && { color: '#C13584', fontWeight: '800' }
                                                            ]}>
                                                                {opt}
                                                            </Text>
                                                            {isSelected && (
                                                                <Ionicons name="checkmark-circle" size={20} color="#E1306C" />
                                                            )}
                                                        </AnimatedPressable>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    )}

                                    {/* Submit Task Section */}
                                    <View style={{ marginTop: spacing[6], marginBottom: spacing[5] }}>
                                    <AnimatedPressable
                                        style={[styles.submitBtn, (!isReady || submitting) && styles.submitDisabled]}
                                        onPress={submitTask}
                                        disabled={!isReady || submitting}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color={colors.charcoal} size="small" />
                                        ) : (
                                            <>
                                                <Text style={[styles.submitText, !isReady && { color: colors.textMuted }]}>
                                                    {isReady ? 'Submit Task & Claim Reward' : 'Upload Proof First'}
                                                </Text>
                                                {isReady && <Ionicons name="checkmark-circle" size={20} color={colors.charcoal} />}
                                            </>
                                        )}
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ) : (
                            /* YouTube Task Flow */
                            <View style={styles.ytSection}>
                                {/* Task Title & Reward */}
                                <View style={styles.taskHeaderCard}>
                                    <View style={styles.ytHeaderRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.taskCardTitle}>{taskData.title}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 }}>
                                                <CreatorAvatar userId={taskData.users?.id || taskData.creator_user_id} username={taskData.users?.username} size={18} />
                                                <Text style={{ fontFamily, fontSize: typography.size.xs, color: colors.textSecondary, fontWeight: '700' }}>
                                                    {taskData.users?.username ? `@${taskData.users.username}` : `Creator`}
                                                </Text>
                                            </View>
                                            <View style={styles.ytTagRow}>
                                                <View style={styles.ytBadgePill}>
                                                    <Text style={styles.ytBadgeText}>YOUTUBE TASK</Text>
                                                </View>
                                                <View style={styles.rewardBadge}>
                                                    <Ionicons name="gift-outline" size={14} color={colors.black} />
                                                    <Text style={styles.rewardBadgeText}>+{taskData.is_vip ? "2 BUG's" : "1 BUG"}</Text>
                                                </View>
                                                <View style={styles.expiryTagPill}>
                                                    <Ionicons name="time-outline" size={12} color="#FF0000" />
                                                    <Text style={styles.expiryTagText}>{getTaskTimeLeft(taskData.created_at)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                 {/* YouTube Video Player (16:9 Aspect Ratio) */}
                                {videoId ? (
                                    <View style={styles.videoCard}>
                                        <YoutubePlayer
                                            height={PLAYER_HEIGHT}
                                            play={true}
                                            videoId={videoId}
                                            onReady={() => setVideoReady(true)}
                                            onChangeState={(state: string) => {
                                                setIsPlaying(state === 'playing');
                                            }}
                                            webViewProps={{
                                                androidLayerType: 'hardware',
                                                allowsInlineMediaPlayback: true,
                                                mediaPlaybackRequiresUserAction: false,
                                            }}
                                            initialPlayerParams={{
                                                preventFullScreen: false,
                                                controls: true,
                                                modestbranding: true,
                                                rel: false,
                                            }}
                                        />
                                        {!videoReady && (
                                            <View style={styles.videoLoader}>
                                                <ActivityIndicator size="large" color="#FF0000" />
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <View style={[styles.videoCard, styles.videoPlaceholder]}>
                                        <Ionicons name="videocam-off-outline" size={40} color={colors.textMuted} />
                                        <Text style={styles.noVideoText}>Video unavailable</Text>
                                    </View>
                                )}

                                {/* Timer Bar */}
                                <View style={styles.timerCard}>
                                    <View style={styles.timerRow}>
                                        <View style={styles.timerInfo}>
                                            <Ionicons name={timerComplete ? "checkmark-circle" : "time-outline"} size={18} color={timerComplete ? colors.mint : "#FF0000"} />
                                            <Text style={styles.timerLabel}>
                                                {timerComplete ? 'Watch Time Complete! ✓' : `Watch Time: ${formatTime(timer)} / ${formatTime(watchTime)}`}
                                            </Text>
                                        </View>
                                        {!timerComplete && (
                                            <Text style={[styles.timerCountdown, { color: '#FF0000' }]}>{formatTime(remainingTime)} left</Text>
                                        )}
                                    </View>
                                    <View style={styles.timerBarBg}>
                                        <View style={[styles.timerBarFill, {
                                            width: `${progress * 100}%`,
                                            backgroundColor: timerComplete ? colors.mint : '#FF0000'
                                        }]} />
                                    </View>
                                </View>

                                {/* Post-3min actions for YouTube */}
                                {timerComplete && (
                                    <>
                                        {/* Subscribe Button */}
                                        <View style={styles.subscribeCard}>
                                            <View style={styles.subscribeInfo}>
                                                <Ionicons name="logo-youtube" size={24} color="#FF0000" />
                                                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                                                    <Text style={styles.subscribeTitle}>Subscribe to Creator</Text>
                                                    <Text style={styles.subscribeSubtitle}>Open creator's YouTube channel and subscribe to complete task</Text>
                                                </View>
                                            </View>
                                            <AnimatedPressable
                                                style={[styles.subscribeBtn, subscribed && styles.subscribedBtn]}
                                                onPress={() => {
                                                    const channelUrl = taskData.channel_url || taskData.video_url || 'https://www.youtube.com';
                                                    if (channelUrl) {
                                                        if (Platform.OS === 'web') {
                                                            window.open(channelUrl, '_blank');
                                                        } else {
                                                            Linking.openURL(channelUrl).catch(() => {
                                                                Alert.alert('Error', 'Unable to open YouTube link');
                                                            });
                                                        }
                                                    }
                                                    setSubscribed(true);
                                                }}
                                            >
                                                <Ionicons
                                                    name={subscribed ? "checkmark-circle" : "logo-youtube"}
                                                    size={20}
                                                    color={subscribed ? colors.black : colors.white}
                                                />
                                                <Text style={[styles.subscribeBtnText, subscribed && styles.subscribedBtnText]} numberOfLines={1} adjustsFontSizeToFit>
                                                    {subscribed ? 'Opened — Upload Proof Below' : 'Subscribe on YouTube'}
                                                </Text>
                                                {!subscribed && <Ionicons name="open-outline" size={16} color={colors.white} style={{ marginLeft: 2 }} />}
                                            </AnimatedPressable>

                                            {/* Proof Upload */}
                                            {subscribed && (
                                                <View style={styles.proofSection}>
                                                    <View style={styles.proofHeader}>
                                                        <Ionicons name="camera-outline" size={16} color={colors.blue} />
                                                        <Text style={[styles.proofLabel, { color: colors.blue }]}>Upload Subscription Screenshot</Text>
                                                    </View>
                                                    <Text style={styles.proofHint}>Screenshot sent to creator as proof of subscription.</Text>
                                                    <TouchableOpacity
                                                        style={[styles.proofPicker, proofImage && styles.proofPickerDone]}
                                                        onPress={pickProofImage}
                                                        activeOpacity={0.75}
                                                    >
                                                        {proofImage ? (
                                                            <View style={styles.proofPickerInner}>
                                                                <Ionicons name="checkmark-circle" size={26} color={colors.black} />
                                                                <Text style={styles.proofPickerTextDone}>Screenshot Selected ✓</Text>
                                                                <Text style={styles.proofPickerChange}>Tap to change</Text>
                                                            </View>
                                                        ) : (
                                                            <View style={styles.proofPickerInner}>
                                                                <Ionicons name="cloud-upload-outline" size={26} color={colors.blue} />
                                                                <Text style={styles.proofPickerText}>Select Screenshot from Gallery</Text>
                                                            </View>
                                                        )}
                                                    </TouchableOpacity>

                                                    {proofImage && !proofUploaded && (
                                                        <AnimatedPressable
                                                            style={styles.proofUploadBtn}
                                                            onPress={uploadProof}
                                                            disabled={uploadingProof}
                                                        >
                                                            {uploadingProof ? (
                                                                <ActivityIndicator color={colors.black} size="small" />
                                                            ) : (
                                                                <>
                                                                    <Ionicons name="send" size={16} color={colors.black} />
                                                                    <Text style={styles.proofUploadBtnText}>Send Proof to Creator</Text>
                                                                </>
                                                            )}
                                                        </AnimatedPressable>
                                                    )}

                                                    {proofUploaded && (
                                                        <View style={styles.proofSuccess}>
                                                            <Ionicons name="checkmark-circle" size={20} color="#059669" />
                                                            <Text style={styles.proofSuccessText}>Proof Sent to Creator ✓</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </View>

                                        {/* MCQ */}
                                        {taskData.mcq_question && (
                                            <View style={styles.section}>
                                                <View style={styles.sectionHeader}>
                                                    <Ionicons name="help-circle-outline" size={18} color={colors.textPrimary} />
                                                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Question</Text>
                                                </View>
                                                <Text style={styles.questionText}>{taskData.mcq_question}</Text>
                                                <View style={styles.optionsWrap}>
                                                    {(taskData.mcq_options || []).map((opt: string, index: number) => (
                                                        <AnimatedPressable
                                                            key={`${opt}-${index}`}
                                                            style={[styles.option, answer === opt && styles.optionSel]}
                                                            onPress={() => setAnswer(opt)}
                                                        >
                                                            <View style={[styles.optRadio, answer === opt && styles.optRadioSel]}>
                                                                {answer === opt && <View style={styles.optDot} />}
                                                            </View>
                                                            <Text style={[styles.optText, answer === opt && styles.optTextSel]}>{opt}</Text>
                                                        </AnimatedPressable>
                                                    ))}
                                                </View>
                                            </View>
                                        )}

                                        {/* Submit Button */}
                                        <View style={styles.submitWrap}>
                                            <AnimatedPressable
                                                style={[styles.submitBtn, (!isReady || submitting) && styles.submitDisabled]}
                                                onPress={submitTask}
                                                disabled={!isReady || submitting}
                                            >
                                                {submitting ? <ActivityIndicator color={colors.charcoal} /> : (
                                                    <>
                                                        <Text style={[styles.submitText, !isReady && { color: colors.textMuted }]}>
                                                            {isReady
                                                                ? 'Submit & Claim Points'
                                                                : !timerComplete
                                                                    ? 'Watch time not complete'
                                                                    : taskData.mcq_question && !answer
                                                                        ? 'Answer the question first'
                                                                        : 'Upload subscription proof first'}
                                                        </Text>
                                                        {isReady && <Ionicons name="checkmark-circle" size={20} color={colors.charcoal} />}
                                                    </>
                                                )}
                                            </AnimatedPressable>
                                        </View>
                                    </>
                                )}

                                {/* Before timer: YouTube instructions */}
                                {!timerComplete && (
                                    <View style={styles.infoCard}>
                                        <Text style={styles.infoTitle}>How it works</Text>
                                        <View style={styles.infoRow}><Ionicons name="play-circle-outline" size={16} color={colors.textPrimary} /><Text style={styles.infoItem}>Watch the video above for 3 minutes</Text></View>
                                        <View style={styles.infoRow}><Ionicons name="notifications-outline" size={16} color={colors.textPrimary} /><Text style={styles.infoItem}>Subscribe to the creator's channel</Text></View>
                                        <View style={styles.infoRow}><Ionicons name="camera-outline" size={16} color={colors.textPrimary} /><Text style={styles.infoItem}>Upload a screenshot of your subscription as proof</Text></View>
                                        <View style={styles.infoRow}><Ionicons name="help-circle-outline" size={16} color={colors.textPrimary} /><Text style={styles.infoItem}>Answer a quick question about the video</Text></View>
                                        <View style={styles.infoRow}><Ionicons name="wallet-outline" size={16} color={colors.textPrimary} /><Text style={styles.infoItem}>Submit to earn your BUG's reward</Text></View>
                                        <Text style={styles.infoHint}>The question and proof upload will appear automatically after 3 minutes of watch time.</Text>
                                    </View>
                                )}
                            </View>
                        )}

                    </ScrollView>
                </Animated.View>
            </View>

            <Y2KAlertPopup
                visible={showSuccessPopup}
                onClose={handlePopupClose}
                characterType="joyful"
                title="Task Completed!"
                description="Your task has been submitted successfully and is now under review. Keep discovering new creators to earn more points!"
                actionText="Awesome!"
            />
            <Y2KCelebrationOverlay active={showCelebration} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    container: { flex: 1 },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing[5], paddingBottom: 120 },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[4],
        paddingHorizontal: spacing[5],
    },
    backBtn: {
        width: 40, height: 40,
        borderRadius: radii.md,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        fontFamily,
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

    taskHeaderCard: {
        backgroundColor: colors.white,
        borderRadius: radii['xl'],
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        marginBottom: spacing[3],
        ...shadows.sm,
    },
    taskCardTitle: {
        fontSize: typography.size.lg,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: spacing[3],
        fontFamily,
    },
    rewardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.lime,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1.5],
        borderRadius: radii.lg,
        gap: spacing[1.5],
    },
    rewardBadgeText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
        fontFamily,
    },
    expiryTagPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.06)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.xs,
    },
    expiryTagText: {
        fontFamily,
        fontSize: 10,
        fontWeight: '800',
        color: colors.textPrimary,
    },

    // Instagram Play Poster Card
    instaPlayCard: {
        borderRadius: radii['2xl'],
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    instaPlayCenterBox: {
        alignItems: 'center',
        paddingHorizontal: spacing[4],
    },
    instaGradientPlayBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#E1306C',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing[3],
        ...shadows.md,
    },
    instaPlayTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: '800',
        color: colors.white,
        textAlign: 'center',
    },
    instaPlaySub: {
        fontFamily,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 4,
        textAlign: 'center',
    },
    instaPlayBottomPill: {
        position: 'absolute',
        bottom: spacing[4],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1.5],
        borderRadius: radii.full,
    },
    instaPlayBottomText: {
        fontFamily,
        fontSize: 11,
        fontWeight: '800',
        color: colors.white,
    },

    // Video
    videoCard: {
        width: '100%',
        height: PLAYER_HEIGHT,
        borderRadius: radii['2xl'],
        overflow: 'hidden',
        marginBottom: spacing[5],
        ...shadows.md,
        backgroundColor: '#000',
    },
    webview: { flex: 1 },
    videoLoader: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    videoPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
    },
    noVideoText: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textMuted,
        marginTop: spacing[2],
    },

    // Timer
    timerCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[4],
        marginBottom: spacing[5],
        ...shadows.sm,
    },
    timerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    timerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
    timerLabel: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
    },
    timerCountdown: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '800',
        color: colors.blue,
    },
    timerBarBg: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
    timerBarFill: { height: '100%', borderRadius: 4 },

    // Subscribe Card
    subscribeCard: {
        backgroundColor: colors.pink + '22',
        borderRadius: radii['2xl'],
        padding: spacing[5],
        marginBottom: spacing[5],
        borderWidth: 1.5,
        borderColor: colors.pink + '44',
    },
    subscribeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[4],
    },
    subscribeTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    subscribeSubtitle: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textSecondary,
    },
    subscribeBtn: {
        backgroundColor: '#FF0000',
        borderRadius: radii.lg,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        ...shadows.sm,
    },
    subscribedBtn: {
        backgroundColor: colors.lime,
    },
    subscribeBtnText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: '800',
        color: colors.white,
    },
    subscribedBtnText: {
        color: colors.black,
    },

    // Proof Upload
    proofSection: {
        marginTop: spacing[4],
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[4],
        borderWidth: 1.5,
        borderColor: colors.blue + '33',
        gap: spacing[3],
    },
    proofHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    proofLabel: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '800',
        color: colors.blue,
    },
    proofHint: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
        lineHeight: 16,
    },
    proofPicker: {
        height: 90,
        borderRadius: radii.lg,
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
        backgroundColor: colors.bgSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    proofPickerDone: {
        borderStyle: 'solid',
        borderColor: colors.lime,
        backgroundColor: colors.lime + '22',
    },
    proofPickerInner: {
        alignItems: 'center',
        gap: spacing[1],
    },
    proofPickerText: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
        marginTop: spacing[1],
    },
    proofPickerTextDone: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '700',
        color: colors.black,
    },
    proofPickerChange: {
        fontFamily,
        fontSize: 10,
        color: colors.textMuted,
    },
    proofUploadBtn: {
        height: 44,
        borderRadius: radii.lg,
        backgroundColor: colors.lavender,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        ...shadows.sm,
    },
    proofUploadBtnText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '800',
        color: colors.black,
    },
    proofSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        backgroundColor: '#ECFDF5',
        borderWidth: 1.5,
        borderColor: '#A7F3D0',
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        borderRadius: radii.xl,
        marginTop: spacing[3],
    },
    proofSuccessText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '800',
        color: '#065F46',
    },

    // MCQ
    section: { marginBottom: spacing[6] },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    sectionTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
    },
    questionText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.medium,
        color: colors.textPrimary,
        marginBottom: spacing[4],
        lineHeight: 22,
    },
    optionsWrap: { gap: spacing[3] },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3.5],
        gap: spacing[3],
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.06)',
        ...shadows.sm,
    },
    optionSel: {
        backgroundColor: colors.lime,
        borderColor: colors.black,
    },
    optRadio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: colors.charcoal,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.white,
    },
    optRadioSel: {
        borderColor: colors.black,
        backgroundColor: colors.black,
    },
    optDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
    optText: { fontFamily, fontSize: typography.size.base, color: colors.textSecondary, flex: 1 },
    optTextSel: { color: colors.black, fontWeight: '800' },

    // Info Card (before timer)
    infoCard: {
        backgroundColor: colors.white,
        borderRadius: radii['2xl'],
        padding: spacing[6],
        marginBottom: spacing[6],
        ...shadows.sm,
    },
    infoTitle: {
        fontFamily,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        marginBottom: spacing[4],
    },
    infoItem: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textSecondary,
        lineHeight: 22,
        marginBottom: spacing[2],
    },
    infoHint: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
        fontStyle: 'italic',
        marginTop: spacing[3],
    },

    // Submit
    submitWrap: { marginTop: spacing[4], alignItems: 'center', gap: spacing[3], marginBottom: spacing[6] },
    submitBtn: {
        backgroundColor: colors.lime,
        height: 56,
        borderRadius: radii.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing[2],
        width: '100%',
        ...shadows.md,
    },
    submitDisabled: { 
        backgroundColor: '#E5E7EB',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.charcoal,
    },
    remaining: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.pink,
        fontWeight: typography.weight.bold,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[2],
    },

    // Instagram Task Styles
    instaSection: {
        flex: 1,
    },
    instaTaskContainer: {
        backgroundColor: colors.white,
        borderRadius: radii['2xl'],
        padding: spacing[5],
        marginBottom: spacing[5],
        borderWidth: 1.5,
        borderColor: '#E1306C33',
        ...shadows.sm,
    },
    instaHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        marginBottom: spacing[4],
    },
    instaLogoBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFF0F5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FCE7F3',
    },
    instaCardTitle: {
        fontFamily,
        fontSize: typography.size.lg,
        fontWeight: '800',
        color: colors.black,
        marginBottom: 2,
    },
    instaTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginTop: 2,
    },
    instaBadgePill: {
        backgroundColor: '#E1306C15',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: '#E1306C33',
    },
    instaBadgeText: {
        fontFamily,
        fontSize: 9,
        fontWeight: '900',
        color: '#E1306C',
    },
    instaStepCard: {
        backgroundColor: colors.bgSecondary,
        borderRadius: radii.xl,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)',
    },
    stepHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        marginBottom: spacing[3],
    },
    stepNumberBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#E1306C',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        fontFamily,
        fontSize: 12,
        fontWeight: '900',
        color: colors.white,
    },
    stepTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: '800',
        color: colors.black,
    },
    stepDesc: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    watchReelBtn: {
        backgroundColor: '#E1306C',
        borderRadius: radii.lg,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        ...shadows.sm,
    },
    watchReelBtnDone: {
        backgroundColor: colors.lime,
    },
    watchReelBtnText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '800',
        color: colors.white,
    },
    watchReelBtnTextDone: {
        color: colors.black,
    },

    // YouTube Task Styles
    ytSection: {
        flex: 1,
    },
    ytHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
    },
    ytLogoBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FF000012',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FF000030',
    },
    ytTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginTop: 4,
    },
    ytBadgePill: {
        backgroundColor: '#FF000015',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: '#FF000033',
    },
    ytBadgeText: {
        fontFamily,
        fontSize: 9,
        fontWeight: '900',
        color: '#FF0000',
    },
    openExternalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing[2],
        marginBottom: spacing[3],
        backgroundColor: 'rgba(255, 0, 0, 0.05)',
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 0, 0.12)',
    },
    openExternalText: {
        fontFamily,
        fontSize: 11,
        fontWeight: '600',
        color: colors.textSecondary,
    },
});
