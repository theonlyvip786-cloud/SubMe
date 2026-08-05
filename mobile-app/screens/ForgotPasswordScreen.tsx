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
import {
  AuthBackButton, AuthHeader, authStyles, AuthDecorativeBg, useAuthEntrance,
} from '../theme/authLayout';
import { AppTextInput, InputBox, inputStyles } from '../theme/inputs';
import { COPY } from '../theme/copy';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const contentAnim = useAuthEntrance(100);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setSending(true);
    try {
      // redirectTo tells Supabase where to send the user after clicking the email link.
      // Web: back to this origin so the browser Supabase client fires PASSWORD_RECOVERY.
      // Native Android/iOS: deep link using app scheme so the app opens and fires PASSWORD_RECOVERY.
      const redirectTo = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin : undefined)
        : 'subme://reset-password';  // matches "scheme" in app.json

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email.');
    } finally {
      setSending(false);
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
          <AuthBackButton onPress={() => navigation.goBack()} />

          {!sent ? (
            <Animated.View style={{ opacity: contentAnim.fade, transform: [{ translateY: contentAnim.slide }] }}>
              <AuthHeader title={COPY.auth.forgotTitle} subtitle={COPY.auth.forgotSub} />
              <View style={authStyles.inputWrapper}>
                <Text style={authStyles.inputLabel}>Email Address</Text>
                <InputBox auth>
                  <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={inputStyles.icon} />
                  <AppTextInput
                    variant="flat"
                    style={authStyles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!sending}
                  />
                </InputBox>
              </View>
              <AnimatedPressable
                style={[authStyles.primaryBtn, sending && { opacity: 0.7 }]}
                onPress={handleReset}
                disabled={sending}
                scaleTo={animation.pressScale}
              >
                {sending ? (
                  <ActivityIndicator color={colors.black} />
                ) : (
                  <Text style={authStyles.primaryBtnText}>Send reset link</Text>
                )}
              </AnimatedPressable>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.sentWrap, { opacity: contentAnim.fade, transform: [{ translateY: contentAnim.slide }] }]}>
              <View style={styles.successIcon}>
                <Ionicons name="mail-unread-outline" size={48} color={colors.lime} />
              </View>
              <AuthHeader
                title="Check your email"
                subtitle={`We've sent a password reset link to:\n${email}`}
              />
              <AnimatedPressable
                style={authStyles.primaryBtn}
                onPress={() => navigation.navigate('Login')}
                scaleTo={animation.pressScale}
              >
                <Text style={authStyles.primaryBtnText}>Back to Login</Text>
              </AnimatedPressable>
            </Animated.View>
          )}
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
    paddingTop: spacing[12],
    justifyContent: 'center',
  },
  sentWrap: { flex: 1 },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.lime + '30',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing[6],
  },
});
