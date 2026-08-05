import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { API_URL } from '../config';
import { colors, spacing, typography, animation, sharedStyles, fontFamily } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import {
  AuthBackButton, AuthHeader, AuthInputField, AuthFooterLink,
  authStyles, AuthDecorativeBg, useAuthEntrance,
} from '../theme/authLayout';
import { AppTextInput, InputBox, inputStyles } from '../theme/inputs';
import { COPY } from '../theme/copy';


export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { setAuth } = useAuthStore();
  const formAnim = useAuthEntrance(120);

  // Works on both web (window.alert) and native (Alert.alert)
  const showAlert = (title: string, message: string) => {
    setErrorMsg(`${title}: ${message}`);
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };


  const handleLogin = async () => {
    console.log('[LoginScreen debug] handleLogin called. Email:', email, 'Password length:', password?.length);
    setErrorMsg('');
    if (!email.trim() || !password) {
      console.log('[LoginScreen debug] Validation failed: email or password empty');
      showAlert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (email.trim().toLowerCase() === 'admin@subko.app' || email.trim().toLowerCase() === 'admin@subme.app') {
        const res = await axios.post(`${API_URL}/api/auth/login`, { email: email.trim(), password });
        const { token, user } = res.data;
        setAuth(token, user);
        return;
      }

      // Check if the account exists first
      try {
        const checkRes = await axios.post(`${API_URL}/api/auth/check-email`, { email: email.trim() });
        if (!checkRes.data.exists) {
          showAlert('Account Not Found', 'This account is not registered. Please create an account and then sign in.');
          return;
        }
      } catch (checkErr) {
        // If the check endpoint fails, proceed anyway — Supabase will handle the error
        console.warn('Email check failed, proceeding with sign-in:', checkErr);
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        showAlert('Login Failed', authError.message);
        return;
      }

      const sessionToken = authData.session?.access_token;
      if (!sessionToken) {
        showAlert('Error', 'Failed to get access token.');
        return;
      }

      const meta = authData.session?.user?.user_metadata;
      let userData;
      try {
        const res = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        userData = res.data.user || res.data;
      } catch (profileErr: any) {
        const isNetwork = !profileErr.response && (profileErr.code === 'ERR_NETWORK' || profileErr.message?.includes('Network'));
        if (isNetwork) {
          showAlert('Server Offline', `Cannot reach the API at ${API_URL}. Start the backend with: cd backend && npm run dev`);
          return;
        }
        try {
          await axios.post(`${API_URL}/api/auth/`, {
            username: meta?.username,
            referral_code_input: meta?.referral_code_input,
          }, { headers: { Authorization: `Bearer ${sessionToken}` } });
          const retryRes = await axios.get(`${API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
          });
          userData = retryRes.data.user || retryRes.data;
        } catch (fallbackErr: any) {
          if (!fallbackErr.response) {
            showAlert('Server Offline', 'Start the backend: cd backend && npm run dev');
            return;
          }
          userData = {
            id: authData.session!.user.id,
            email: authData.session!.user.email || email.trim(),
            username: meta?.username || email.split('@')[0],
            points: 0,
            referral_code: authData.session!.user.id.replace(/-/g, '').toUpperCase(),
            status: 'active' as const,
          };
        }
      }

      setAuth(sessionToken, userData);
    } catch (err: any) {
      if (!err.response && (err.code === 'ERR_NETWORK' || err.message?.includes('Network'))) {
        showAlert('Server Offline', `Cannot reach ${API_URL}. Run: cd backend && npm run dev`);
        return;
      }
      const msg = err.response?.data?.error || err.message || 'Login failed';
      showAlert('Error', msg);
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
          <AuthHeader title={COPY.auth.loginTitle} />

          <Animated.View style={[styles.form, { opacity: formAnim.fade, transform: [{ translateY: formAnim.slide }] }]}>
            <AuthInputField
              label="Email Address"
              icon="mail-outline"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              delay={160}
            />

            <View style={authStyles.inputWrapper}>
              <Text style={authStyles.inputLabel}>Password</Text>
              <InputBox auth>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={inputStyles.icon} />
                <AppTextInput
                  variant="flat"
                  style={authStyles.input}
                  placeholder="Enter your password"
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

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotBtn}>
              <Text style={styles.forgotLink}>Forgot Password?</Text>
            </TouchableOpacity>

            <AnimatedPressable
              style={[authStyles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              scaleTo={animation.pressScale}
            >
              <Text style={authStyles.primaryBtnText}>{loading ? 'Checking...' : 'Sign In'}</Text>
            </AnimatedPressable>

            {!!errorMsg && (
              <View style={{ backgroundColor: '#ffe5e5', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#ff4d4d' }}>
                <Text style={{ color: '#cc0000', fontSize: 13, fontFamily, textAlign: 'center', lineHeight: 18 }}>{errorMsg}</Text>
              </View>
            )}
          </Animated.View>

          <AuthFooterLink
            text="New here?"
            linkText="Create an Account"
            onPress={() => navigation.navigate('SignUp')}
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
    gap: spacing[5],
  },
  forgotBtn: { alignSelf: 'flex-end' },
  forgotLink: {
    fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: colors.blue,
  },
  adminHint: {
    fontFamily,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[4],
    lineHeight: 18,
  },
});
