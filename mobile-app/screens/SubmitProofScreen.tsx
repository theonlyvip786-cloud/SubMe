import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Animated, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { supabase } from '../lib/supabase';
import { colors, typography, spacing, radii, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import { AppTextInput } from '../theme/inputs';
import Y2KCharacter from '../theme/Y2KCharacter';
import Y2KNote from '../theme/Y2KNote';
import Y2KAlertPopup from '../theme/Y2KAlertPopup';
import Y2KCelebrationOverlay from '../theme/Y2KCelebrationOverlay';




export default function SubmitProofScreen({ route, navigation }: any) {
  const { purchaseAmount } = route.params || { purchaseAmount: '100' };
  const { token, user } = useAuthStore();
  const [utrNumber, setUtrNumber] = useState('');
  const [image, setImage] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const handlePopupClose = () => {
    setShowSuccessPopup(false);
    setShowCelebration(false);
    navigation.navigate('Wallet');
  };

  const selectScreenshot = async () => {
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
    setImage(result.assets[0]);
  };

  const handleSubmitProof = async () => {
    if (!image) {
      Alert.alert('Error', 'Please upload your payment screenshot.');
      return;
    }
    if (!utrNumber.trim()) {
      Alert.alert('Error', 'Please enter your UTR / Transaction ID.');
      return;
    }

    setUploading(true);
    try {
      // BUG-10: Strip query params before extracting extension to avoid 'jpg?1234567' as ext
      const ext = image.uri.startsWith('data:image/')
        ? image.uri.split(';')[0].split('/')[1] || 'jpg'
        : (image.uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
      const fileName = `payments/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      // Convert image URI to Blob for Supabase Storage upload
      const response = await fetch(image.uri);
      const blob = await response.blob();

      // Upload screenshot to Supabase Storage bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, blob, { cacheControl: '3600', upsert: false, contentType: `image/${ext}` });

      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from('screenshots').getPublicUrl(fileName).data.publicUrl;

      // Submit public receipt URL and UTR to backend
      await axios.post(`${API_URL}/api/payments/manual`, {
        screenshot: publicUrl,
        amount: parseInt(purchaseAmount, 10),
        utr_number: utrNumber.trim(),
      }, { headers: { Authorization: `Bearer ${token}` } });

      setShowSuccessPopup(true);
      setShowCelebration(true);
    } catch (error: any) {
      Alert.alert('Submission Failed', error.response?.data?.error || error.message || 'Failed to submit proof. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
        <View style={styles.coinsBadge}>
          <Y2KNote size={14} style={{ marginRight: 6 }} />
          <Text style={styles.coinsText}>{(user?.points || 0).toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Bento Card */}
        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
            <View style={{ flex: 1 }}>
              <Ionicons name="information-circle-outline" size={24} color={colors.black} style={{ marginBottom: spacing[2] }} />
              <Text style={styles.infoTitle}>Payment Initiated</Text>
              <Text style={styles.infoDesc}>
                Please complete the payment of ₹{purchaseAmount} in your UPI app, then submit the details below to claim your points.
              </Text>
            </View>
            <Y2KCharacter type="grateful" size={72} animate={true} />
          </View>
        </View>

        {/* Inputs */}
        <Text style={styles.label}>Enter UTR / Transaction ID</Text>
        <AppTextInput
          variant="standalone"
          style={styles.utrInput}
          value={utrNumber}
          onChangeText={setUtrNumber}
          placeholder="Enter 12-digit UTR Number"
          keyboardType="numeric"
        />

        {/* Screenshot picker */}
        <Text style={styles.label}>Upload Payment Screenshot</Text>
        <AnimatedPressable 
          style={[styles.screenshotPicker, image && styles.screenshotPickerActive]} 
          onPress={selectScreenshot}
          scaleTo={animation.pressScale}
        >
          {image ? (
            <View style={styles.screenshotActiveInner}>
              <Ionicons name="checkmark-circle" size={32} color={colors.black} />
              <Text style={styles.pickerTextActive}>Screenshot Selected</Text>
            </View>
          ) : (
            <View style={styles.screenshotInner}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
              <Text style={styles.pickerText}>Select Screenshot from Gallery</Text>
            </View>
          )}
        </AnimatedPressable>

        {/* Action Button */}
        <AnimatedPressable
          style={[styles.submitBtn, uploading && { opacity: 0.7 }]}
          onPress={handleSubmitProof}
          disabled={uploading}
          scaleTo={animation.pressScale}
        >
          {uploading ? (
            <ActivityIndicator color={colors.black} />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Submit Payment Details</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.black} />
            </>
          )}
        </AnimatedPressable>
      </ScrollView>

      <Y2KAlertPopup
        visible={showSuccessPopup}
        onClose={handlePopupClose}
        characterType="grateful"
        title="Proof Submitted!"
        description="Your manual payment proof has been sent to the admin. Points will be credited shortly after review!"
        actionText="Awesome!"
      />

      <Y2KCelebrationOverlay active={showCelebration} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
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
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: colors.peach,
    borderRadius: radii['2xl'],
    padding: spacing[5],
    marginBottom: spacing[6],
    ...shadows.sm,
  },
  infoTitle: {
    fontFamily,
    fontSize: typography.size.lg,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing[1],
  },
  infoDesc: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  label: {
    fontFamily,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.textMuted,
    marginBottom: spacing[2],
    marginLeft: spacing[1],
  },
  utrInput: {
    marginBottom: spacing[6],
  },
  screenshotPicker: {
    height: 120,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[8],
    ...shadows.sm,
  },
  screenshotPickerActive: {
    borderStyle: 'solid',
    backgroundColor: colors.lime,
  },
  screenshotInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenshotActiveInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerText: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textMuted,
    marginTop: spacing[2],
  },
  pickerTextActive: {
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.black,
    fontWeight: '700',
    marginTop: spacing[2],
  },
  submitBtn: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.lime,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    ...shadows.md,
  },
  submitBtnText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.black,
  },
});
