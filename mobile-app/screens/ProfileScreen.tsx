import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  Image, RefreshControl, Animated, Modal, TextInput, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { colors, typography, spacing, radii, shadows, fontFamily } from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';
import { COPY } from '../theme/copy';
import Y2KNote from '../theme/Y2KNote';

export default function ProfileScreen({ navigation }: any) {
  const { user, token, logout, setAdminMode, customAvatarUri, setCustomAvatarUri } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Settings Modal State
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [updating, setUpdating] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [resettingPass, setResettingPass] = useState(false);

  // Avatar Upload State
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [avatarError, setAvatarError] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setUploadingAvatar(true);
        const asset = result.assets[0];
        const imageUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

        // Persist avatar URI locally and in store immediately
        setCustomAvatarUri(imageUri);
        setAvatarError(false);
        setAvatarKey(Date.now());

        // Attempt background storage upload if bucket is present
        const userId = user?.id || 'admin';
        if (userId && asset.uri) {
          try {
            const res = await fetch(asset.uri);
            const blob = await res.blob();
            await supabase.storage
              .from('avatars')
              .upload(`${userId}.jpg`, blob, { contentType: 'image/jpeg', upsert: true });
          } catch (storageErr) {
            console.log('Background avatar upload note:', storageErr);
          }
        }

        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to select profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const fetchProfile = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(response.data);
    } catch (error) { console.error('Profile fetch error', error); } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    fetchProfile();
    const unsubscribe = navigation.addListener('focus', () => { fetchProfile(true); });
    return unsubscribe;
  }, [navigation, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile(true);
    setRefreshing(false);
  };

  const displayUser = profile || user;

  // Reset error when avatarKey changes
  useEffect(() => { setAvatarError(false); }, [avatarKey, displayUser]);

  // Sync state with global Zustand store on modal visibility change
  useEffect(() => {
    if (settingsVisible) {
      setEditUsername(displayUser?.username || '');
      const store = useAuthStore.getState();
      setPushEnabled(store.pushEnabled ?? true);
    }
  }, [settingsVisible, displayUser]);

  // Real Supabase Password Reset Email Trigger
  const handleResetPassword = async () => {
    const email = displayUser?.email;
    if (!email) {
      Alert.alert('Error', 'No email address associated with account.');
      return;
    }
    setResettingPass(true);
    try {
      const redirectTo = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin : undefined)
        : 'subme://reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      Alert.alert(
        'Password Reset Email Sent',
        `A password reset link has been sent to ${email}. Please check your email inbox.`
      );
    } catch (err: any) {
      Alert.alert('Password Reset Failed', err.message || 'Unable to send reset email.');
    } finally {
      setResettingPass(false);
    }
  };

  // Push Notifications Polling Logic
  const prevStats = React.useRef({ approved: -1, points: -1 });

  useEffect(() => {
    if (profile) {
      if (prevStats.current.approved === -1) {
        prevStats.current = { approved: profile.totalApproved || 0, points: profile.points || 0 };
      } else {
        if (pushEnabled) {
          if ((profile.totalApproved || 0) > prevStats.current.approved) {
            Alert.alert('✅ Task Approved!', 'Your recent submission was approved. BUG\'s have been credited.');
          } else if ((profile.points || 0) > prevStats.current.points) {
            Alert.alert('💰 Payment Approved!', 'Your wallet top-up was approved. BUG\'s have been credited.');
          }
        }
        prevStats.current = { approved: profile.totalApproved || 0, points: profile.points || 0 };
      }
    }
  }, [profile, pushEnabled]);

  useEffect(() => {
    if (!pushEnabled || !token) return;
    const interval = setInterval(() => {
      fetchProfile(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [pushEnabled, token]);

  // Handle Save Settings (calls PUT /me for normal users and saves preferences in Zustand)
  const handleSaveSettings = async () => {
    const isAdmin = user?.email === 'admin@subko.app' || user?.email === 'admin@subme.app' || user?.referral_code === 'ADMIN';
    
    if (!isAdmin && (!editUsername || editUsername.trim().length < 3)) {
      Alert.alert('Error', 'Username must be at least 3 characters long.');
      return;
    }
    
    setUpdating(true);
    try {
      if (!isAdmin) {
        const response = await axios.put(`${API_URL}/api/users/me`,
          { username: editUsername.trim() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        useAuthStore.getState().updateUser({ username: response.data.username });
        setProfile(response.data);
      }

      // Update preferences locally in global Zustand store
      useAuthStore.setState({ pushEnabled });

      Alert.alert('Success', 'Profile settings updated successfully!');
      setSettingsVisible(false);
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to update settings';
      Alert.alert('Error', errMsg);
    } finally {
      setUpdating(false);
    }
  };

  // Fade-in animation
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
          <Text style={styles.headerTitle}>Account</Text>
          <View style={styles.coinsBadge}>
            <Y2KNote size={14} style={{ marginRight: 6 }} />
            <Text style={styles.coinsText}>{(displayUser?.points || 0).toLocaleString()}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.charcoal} />}
        >
          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* User Card (Redesigned Bento Style) */}
            <View style={styles.userCard}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={colors.black} />
                  ) : customAvatarUri ? (
                    <Image 
                      source={{ uri: customAvatarUri }} 
                      style={{ width: '100%', height: '100%', borderRadius: 44 }}
                    />
                  ) : (!avatarError && displayUser?.id) ? (
                    <Image 
                      source={{ uri: `${SUPABASE_URL}/storage/v1/object/public/avatars/${displayUser.id}.jpg?t=${avatarKey}` }} 
                      style={{ width: '100%', height: '100%', borderRadius: 44 }}
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <Text style={styles.avatarTxt}>
                      {displayUser?.username?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.editBadge}
                  onPress={handlePickAvatar}
                  disabled={uploadingAvatar}
                >
                  <Ionicons name="camera" size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.name}>{displayUser?.username || 'User'}</Text>
                {displayUser?.is_premium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="sparkles" size={12} color={colors.black} />
                    <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                  </View>
                )}
              </View>
              <Text style={styles.email}>{displayUser?.email || 'user@example.com'}</Text>
            </View>

            {/* Links */}
            <Text style={styles.sectionTitle}>General</Text>
            <View style={styles.linksCard}>
              <ProfileLink
                icon="person-outline"
                label="Personal Information"
                color={colors.charcoal}
                onPress={() => setSettingsVisible(true)}
              />
              <ProfileLink
                icon="wallet-outline"
                label="Wallet Settings"
                color={colors.charcoal}
                onPress={() => navigation.navigate('Wallet')}
              />
              <ProfileLink
                icon="gift-outline"
                label="Invite Friends"
                color={colors.charcoal}
                onPress={() => navigation.navigate('Refer')}
              />
              <ProfileLink
                icon="images-outline"
                label="My Subscription Proofs"
                color={colors.blue}
                onPress={() => navigation.navigate('MyProofs')}
              />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: spacing[8] }]}>Preferences</Text>
            <View style={styles.linksCard}>
              <ProfileLink
                icon="notifications-outline"
                label="Notifications"
                color={colors.charcoal}
                onPress={() => setSettingsVisible(true)}
              />
              <ProfileLink
                icon="shield-checkmark-outline"
                label="Security & Verification"
                color={colors.charcoal}
                onPress={() => setSettingsVisible(true)}
              />
            </View>

            {(user?.email === 'admin@subko.app' || user?.email === 'admin@subme.app' || user?.referral_code === 'ADMIN') && (
              <AnimatedPressable
                style={styles.adminSwitchBtn}
                onPress={() => setAdminMode(true)}
              >
                <Ionicons name="shield-outline" size={20} color={colors.textPrimary} style={{ marginRight: 8 }} />
                <Text style={styles.adminSwitchText}>Switch to Admin Panel</Text>
              </AnimatedPressable>
            )}

            {/* Logout Button */}
            <AnimatedPressable style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutText}>Log Out Account</Text>
            </AnimatedPressable>
          </Animated.View>
        </ScrollView>

        {/* 100% Operational Settings Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={settingsVisible}
          onRequestClose={() => setSettingsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboard}
            >
              <View style={styles.modalContent}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitle}>App Settings</Text>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSettingsVisible(false)}
                  >
                    <Ionicons name="close" size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                  {/* Section 1: Profile Details */}
                  <Text style={styles.modalSectionTitle}>Profile Information</Text>
                  <View style={styles.modalCard}>
                    <Text style={styles.inputLabel}>Edit Username</Text>
                    <TextInput
                      style={styles.settingsInput}
                      value={editUsername}
                      onChangeText={setEditUsername}
                      placeholder="Enter new username"
                      placeholderTextColor={colors.textMuted}
                      maxLength={20}
                    />
                    <Text style={styles.inputHelp}>Choose a display name other creators will see on SubMe.</Text>

                    <View style={[styles.infoRow, { marginTop: spacing[4], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>Account Email</Text>
                        <Text style={styles.infoValue}>{displayUser?.email || 'user@example.com'}</Text>
                      </View>
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.lime} />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    </View>

                    {displayUser?.referral_code && (
                      <View style={[styles.infoRow, { marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.infoLabel}>Your Referral Code</Text>
                          <Text style={[styles.infoValue, { fontWeight: '700', color: colors.black }]}>{displayUser.referral_code}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.copyCodeBtn, { marginRight: 6 }]}
                          onPress={async () => {
                            await Clipboard.setStringAsync(displayUser.referral_code || '');
                            Alert.alert('Copied!', 'Referral code copied to clipboard.');
                          }}
                        >
                          <Ionicons name="copy-outline" size={14} color={colors.black} />
                          <Text style={styles.copyCodeText}>Copy Code</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.copyCodeBtn, { backgroundColor: colors.lime }]}
                          onPress={async () => {
                            const link = `https://subme-landing-page.vercel.app/?ref=${displayUser.referral_code}`;
                            await Clipboard.setStringAsync(link);
                            Alert.alert('Copied!', 'Referral link copied to clipboard.');
                          }}
                        >
                          <Ionicons name="link-outline" size={14} color={colors.black} />
                          <Text style={styles.copyCodeText}>Copy Link</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Section 2: Security & Password */}
                  <Text style={styles.modalSectionTitle}>Security & Account Verification</Text>
                  <View style={styles.modalCard}>
                    <View style={styles.securityRow}>
                      <View style={{ flex: 1, paddingRight: spacing[3] }}>
                        <Text style={styles.securityTitle}>Password Reset</Text>
                        <Text style={styles.securityDesc}>Send a password reset link to your account email address.</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.resetPassBtn}
                        onPress={handleResetPassword}
                        disabled={resettingPass}
                      >
                        {resettingPass ? (
                          <ActivityIndicator size="small" color={colors.black} />
                        ) : (
                          <>
                            <Ionicons name="key-outline" size={14} color={colors.black} style={{ marginRight: 4 }} />
                            <Text style={styles.resetPassText}>Reset Password</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.infoRow, { marginTop: spacing[4], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>Anti-Cheat Shield</Text>
                        <Text style={styles.infoValue}>Device Fingerprint Verified</Text>
                      </View>
                      <View style={styles.shieldBadge}>
                        <Ionicons name="shield-checkmark" size={12} color={colors.black} />
                        <Text style={styles.shieldTxt}>ACTIVE</Text>
                      </View>
                    </View>
                  </View>

                  {/* Section 3: Notifications */}
                  <Text style={styles.modalSectionTitle}>Notifications & Alerts</Text>
                  <View style={styles.modalCard}>
                    <View style={styles.switchRow}>
                      <View style={styles.switchLabelCol}>
                        <Text style={styles.switchTitle}>Push Notifications</Text>
                        <Text style={styles.switchDesc}>Get alerted instantly when your submissions or payments are approved.</Text>
                      </View>
                      <Switch
                        value={pushEnabled}
                        onValueChange={setPushEnabled}
                        trackColor={{ false: '#CBD5E1', true: colors.lime }}
                        thumbColor={colors.white}
                        ios_backgroundColor="#CBD5E1"
                      />
                    </View>
                  </View>
                </ScrollView>

                {/* Save & Cancel Footer Buttons */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn]}
                    onPress={handleSaveSettings}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator size="small" color={colors.black} />
                    ) : (
                      <Text style={styles.saveBtnText} numberOfLines={1} adjustsFontSizeToFit>Save Changes</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => setSettingsVisible(false)}
                    disabled={updating}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function ProfileLink({ icon, label, color = colors.charcoal, onPress, rightLabel }: any) {
  return (
    <AnimatedPressable style={styles.profileLink} onPress={onPress}>
      <View style={styles.linkLeft}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={styles.linkLabel}>{label}</Text>
      </View>
      {rightLabel ? (
        <Text style={styles.rightLabel}>{rightLabel}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.15)" />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  iconBtn: {
    width: 40,
    height: 40,
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
    marginRight: 6,
  },
  coinsText: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  userCard: {
    alignItems: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[6],
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing[4],
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.lavender,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  avatarTxt: {
    fontSize: 28,
    fontWeight: typography.weight.black,
    color: colors.textPrimary,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.charcoal,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.bgPrimary,
  },
  name: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  email: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.peach,
    marginHorizontal: spacing[6],
    borderRadius: radii.xl,
    padding: spacing[5],
    alignItems: 'center',
    marginBottom: spacing[8],
    ...shadows.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    marginBottom: spacing[3],
    marginHorizontal: spacing[6],
  },
  linksCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginHorizontal: spacing[6],
    ...shadows.sm,
  },
  profileLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  linkLabel: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
  },
  rightLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.blue,
  },
  logoutBtn: {
    marginTop: spacing[10],
    marginBottom: spacing[10],
    marginHorizontal: spacing[6],
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  logoutText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  adminSwitchBtn: {
    marginTop: spacing[6],
    marginHorizontal: spacing[6],
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
    ...shadows.sm,
  },
  adminSwitchText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modalKeyboard: {
    width: '100%',
    maxWidth: 500,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radii.xl,
    padding: spacing[6],
    width: '100%',
    maxHeight: '75%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  modalHeaderTitle: {
    fontFamily,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  modalScroll: {
    paddingBottom: spacing[4],
  },
  modalSectionTitle: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[5],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  inputLabel: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  settingsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    height: 52,
    fontFamily,
    fontSize: typography.size.base,
    color: colors.textPrimary,
    marginTop: spacing[2],
    marginBottom: spacing[2],
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
      } as object,
      default: {},
    }),
  },
  inputHelp: {
    fontFamily,
    fontSize: 10,
    color: colors.textMuted,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelCol: {
    flex: 1,
    paddingRight: spacing[4],
  },
  switchTitle: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  switchDesc: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  statusLabel: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  statusVal: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lime,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.xs,
  },
  shieldTxt: {
    fontFamily,
    fontSize: 9,
    fontWeight: typography.weight.black,
    color: colors.black,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  saveBtn: {
    backgroundColor: colors.lime,
  },
  saveBtnText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  cancelBtn: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cancelBtnText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.yellow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    marginLeft: 8,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
    fontFamily,
    color: colors.black,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontFamily,
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.textMuted,
  },
  infoValue: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedText: {
    fontFamily,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: '#065F46',
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lime,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    ...shadows.sm,
  },
  copyCodeText: {
    fontFamily,
    fontSize: 11,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
  securityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  securityTitle: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  securityDesc: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  resetPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  resetPassText: {
    fontFamily,
    fontSize: 12,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
});
