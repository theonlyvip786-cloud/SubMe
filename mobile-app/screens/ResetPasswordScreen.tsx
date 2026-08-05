import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, spacing, animation, sharedStyles } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import { AuthHeader, authStyles, AuthDecorativeBg, useAuthEntrance } from '../theme/authLayout';
import { AppTextInput, InputBox, inputStyles } from '../theme/inputs';
import useAuthStore from '../store/useAuthStore';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const contentAnim = useAuthEntrance(100);
  const setRequiresPasswordReset = useAuthStore(s => s.setRequiresPasswordReset);

  const handleUpdatePassword = async () => {
    if (!password.trim() || password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Success', 'Password updated successfully!');
      setRequiresPasswordReset(false); // Let them into the app
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={sharedStyles.screen}>
      <AuthDecorativeBg />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.inner}>
          <Animated.View style={{ opacity: contentAnim.fade, transform: [{ translateY: contentAnim.slide }] }}>
            <AuthHeader title="Update Password" subtitle="Please enter your new password to continue." />
            
            <View style={authStyles.inputWrapper}>
              <Text style={authStyles.inputLabel}>New Password</Text>
              <InputBox auth>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={inputStyles.icon} />
                <AppTextInput
                  variant="flat"
                  style={authStyles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!submitting}
                />
                <AnimatedPressable onPress={() => setShowPassword(!showPassword)} style={{ marginLeft: spacing[2], padding: 4 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textMuted} />
                </AnimatedPressable>
              </InputBox>
            </View>

            <View style={authStyles.inputWrapper}>
              <Text style={authStyles.inputLabel}>Confirm New Password</Text>
              <InputBox auth>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={inputStyles.icon} />
                <AppTextInput
                  variant="flat"
                  style={authStyles.input}
                  placeholder="Repeat new password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  editable={!submitting}
                />
              </InputBox>
            </View>

            <AnimatedPressable
              style={[authStyles.primaryBtn, submitting && { opacity: 0.7 }]}
              onPress={handleUpdatePassword}
              disabled={submitting}
              scaleTo={animation.pressScale}
            >
              {submitting ? (
                <ActivityIndicator color={colors.black} />
              ) : (
                <Text style={authStyles.primaryBtnText}>Update Password</Text>
              )}
            </AnimatedPressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[16],
    justifyContent: 'center',
  }
});
