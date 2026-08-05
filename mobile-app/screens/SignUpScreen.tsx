import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { colors, spacing, animation, sharedStyles } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import {
  AuthBackButton, AuthHeader, AuthInputField, AuthFooterLink,
  authStyles, AuthDecorativeBg, useAuthEntrance,
} from '../theme/authLayout';
import { AppTextInput, InputBox, inputStyles } from '../theme/inputs';
import { COPY } from '../theme/copy';

export default function SignUpScreen({ navigation }: any) {
  const pendingCode = useAuthStore(s => s.pendingReferralCode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(pendingCode || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const formAnim = useAuthEntrance(120);

  React.useEffect(() => {
    if (pendingCode) {
      setReferralCode(pendingCode);
    }
  }, [pendingCode]);

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      onOk?.();
    } else {
      if (onOk) {
        Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
      } else {
        Alert.alert(title, message);
      }
    }
  };

  const handleSignup = async () => {
    if (!username || !email || !password) {
      showAlert('Missing Info', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, referral_code_input: referralCode || null },
        },
      });
      if (error) throw error;

      if (data.session) {
        let userData;
        try {
          // Always call POST /api/auth/ first to ensure referral codes and usernames are synced,
          // because the DB trigger might have created the profile but skipped the referral logic.
          await axios.post(`${API_URL}/api/auth/`, {
            username,
            referral_code_input: referralCode || undefined,
          }, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
          
          const res = await axios.get(`${API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          userData = res.data;
        } catch {
          try {
            // Fallback retry
            const retryRes = await axios.get(`${API_URL}/api/users/me`, {
              headers: { Authorization: `Bearer ${data.session.access_token}` },
            });
            userData = retryRes.data;
          } catch {
            userData = {
              id: data.session.user.id,
              email: data.session.user.email || email.trim(),
              username,
              points: 0,
              referral_code: data.session.user.id.replace(/-/g, '').toUpperCase(),
              status: 'active' as const,
            };
          }
        }
        useAuthStore.getState().setAuth(data.session.access_token, userData);
        return;
      }

      showAlert('Success', 'Account created! Check your email to confirm, then log in.', () => {
        navigation.navigate('Login');
      });
    } catch (error: any) {
      showAlert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={sharedStyles.screen}>
      <AuthDecorativeBg />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <AuthHeader title={COPY.auth.signUpTitle} />

          <Animated.View style={[styles.form, { opacity: formAnim.fade, transform: [{ translateY: formAnim.slide }] }]}>
            <AuthInputField
              label="Username"
              icon="person-outline"
              placeholder="Choose a username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!loading}
              delay={160}
            />
            <AuthInputField
              label="Email Address"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              delay={220}
            />

            <View style={authStyles.inputWrapper}>
              <Text style={authStyles.inputLabel}>Password</Text>
              <InputBox auth>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={inputStyles.icon} />
                <AppTextInput
                  variant="flat"
                  style={authStyles.input}
                  placeholder="Create a password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ justifyContent: 'center' }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </InputBox>
            </View>

            <AuthInputField
              label="Referral Code (Optional)"
              icon="gift-outline"
              placeholder="Enter referral code"
              value={referralCode}
              onChangeText={setReferralCode}
              autoCapitalize="characters"
              editable={!loading}
              delay={280}
            />

            <AnimatedPressable
              style={[authStyles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignup}
              disabled={loading}
              scaleTo={animation.pressScale}
            >
              <Text style={authStyles.primaryBtnText}>{loading ? 'Creating...' : 'Create Account'}</Text>
            </AnimatedPressable>
          </Animated.View>

          <AuthFooterLink
            text="Already have an account?"
            linkText="Sign In"
            onPress={() => navigation.navigate('Login')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + spacing[10] : spacing[12],
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    marginTop: spacing[4],
    gap: spacing[4],
  },
});
