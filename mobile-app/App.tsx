import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StatusBar, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';
import useAuthStore, { setupAxiosInterceptors } from './store/useAuthStore';
import { colors, fontFamily } from './theme/designSystem';
import CustomBottomTabBar from './theme/BottomTabBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from './lib/supabase';

if (Platform.OS === 'web') {
    enableScreens(false);
}

import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import TaskScreen from './screens/TaskScreen';
import WalletScreen from './screens/WalletScreen';
import RequestPromotionScreen from './screens/RequestPromotionScreen';
import ReferralScreen from './screens/ReferralScreen';
import ProfileScreen from './screens/ProfileScreen';
import BannedScreen from './screens/BannedScreen';
import AdminAnalyticsScreen from './screens/AdminAnalyticsScreen';
import AdminReviewsScreen from './screens/AdminReviewsScreen';
import AdminPaymentsScreen from './screens/AdminPaymentsScreen';
import AdminToolsScreen from './screens/AdminToolsScreen';
import AdminUsersScreen from './screens/AdminUsersScreen';
import SubmitProofScreen from './screens/SubmitProofScreen';
import MyProofsScreen from './screens/MyProofsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = [
        'html, body, #root, #root > div { height: 100%; min-height: 100vh; display: flex; flex-direction: column; flex: 1; margin: 0; padding: 0; }',
        'input, textarea, select {',
        '  user-select: text !important;',
        '  -webkit-user-select: text !important;',
        '  cursor: text !important;',
        '  outline: none !important;',
        '  background-color: #F9F9F6 !important;',
        '}',
        'input:focus, textarea:focus, select:focus,',
        'input:focus-visible, textarea:focus-visible, select:focus-visible {',
        '  outline: none !important;',
        '  outline-width: 0 !important;',
        '  box-shadow: none !important;',
        '  background-color: #F9F9F6 !important;',
        '}',
        'input:-webkit-autofill,',
        'input:-webkit-autofill:hover,',
        'input:-webkit-autofill:focus,',
        'input:-webkit-autofill:active {',
        '  -webkit-box-shadow: 0 0 0 1000px #F9F9F6 inset !important;',
        '  box-shadow: 0 0 0 1000px #F9F9F6 inset !important;',
        '  -webkit-text-fill-color: #16120F !important;',
        '  background-color: #F9F9F6 !important;',
        '  transition: background-color 99999s ease-in-out 0s;',
        '}',
        '[data-focusable=true]:focus, div[contenteditable]:focus {',
        '  outline: none !important;',
        '  box-shadow: none !important;',
        '}',
        'body { font-family: Inter, Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background-color: #F9F9F6; }',
    ].join('\n');
    document.head.appendChild(style);
}

function MainTabNavigator() {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomBottomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    position: 'absolute',
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    elevation: 0,
                },
            }}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Wallet" component={WalletScreen} />
            <Tab.Screen name="Refer" component={ReferralScreen} />
            <Tab.Screen name="Promote" component={RequestPromotionScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

function AdminTabNavigator() {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomBottomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    position: 'absolute',
                    backgroundColor: 'transparent',
                    borderTopWidth: 0,
                    elevation: 0,
                },
            }}
        >
            <Tab.Screen name="Analytics" component={AdminAnalyticsScreen} />
            <Tab.Screen name="Users" component={AdminUsersScreen} />
            <Tab.Screen name="Reviews" component={AdminReviewsScreen} />
            <Tab.Screen name="Payments" component={AdminPaymentsScreen} />
            <Tab.Screen name="Tools" component={AdminToolsScreen} />
        </Tab.Navigator>
    );
}

function AuthNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bgPrimary },
                animation: Platform.OS === 'web' ? 'none' : 'fade',
            }}
        >
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Navigator>
    );
}

function BootSplash() {
    return (
        <View style={bootStyles.wrap}>
            <Text style={bootStyles.logo}>SubMe ✦</Text>
            <ActivityIndicator size="large" color={colors.lime} style={{ marginTop: 24 }} />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 12 }}>Loading...</Text>
        </View>
    );
}
const NAVIGATION_PERSISTENCE_KEY = 'SUBME_NAVIGATION_STATE_V2';

function parseSupabaseUrl(url: string) {
    let queryString = '';
    if (url.includes('#')) {
        queryString = url.split('#')[1];
    } else if (url.includes('?')) {
        queryString = url.split('?')[1];
    }
    if (!queryString) return null;
    const parts = queryString.split('&');
    const params: Record<string, string> = {};
    parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) {
            params[key] = decodeURIComponent(value);
        }
    });
    return params;
}

function parseReferralCodeFromUrl(url: string) {
    if (!url) return null;
    let query = '';
    if (url.includes('?')) {
        query = url.split('?')[1].split('#')[0];
    } else if (url.includes('#') && url.includes('=')) {
        query = url.split('#')[1];
    }
    if (!query) return null;
    const parts = query.split('&');
    for (const part of parts) {
        const [key, value] = part.split('=');
        if ((key === 'ref' || key === 'referral') && value) {
            return decodeURIComponent(value).trim().toUpperCase();
        }
    }
    return null;
}

export default function App() {
    const { token, user, isAdminMode, hydrated, requiresPasswordReset } = useAuthStore();
    const [isReady, setIsReady] = useState(false);
    const [initialState, setInitialState] = useState<any>();
    const [isNavRestored, setIsNavRestored] = useState(false);

    useEffect(() => {
        // Check Web URL query params on load
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const webRef = parseReferralCodeFromUrl(window.location.href);
            if (webRef) {
                useAuthStore.getState().setPendingReferralCode(webRef);
            }
        }

        const handleDeepLink = (event: { url: string }) => {
            const { url } = event;
            if (url) {
                const refCode = parseReferralCodeFromUrl(url);
                if (refCode) {
                    useAuthStore.getState().setPendingReferralCode(refCode);
                }
                const params = parseSupabaseUrl(url);
                if (params?.access_token && params?.refresh_token) {
                    supabase.auth.setSession({
                        access_token: params.access_token,
                        refresh_token: params.refresh_token,
                    }).then(({ error }) => {
                        if (!error && (params.type === 'recovery' || url.includes('reset-password'))) {
                            useAuthStore.setState({ requiresPasswordReset: true });
                        }
                    });
                }
            }
        };

        const subscription = Linking.addEventListener('url', handleDeepLink);

        Linking.getInitialURL().then(url => {
            if (url) {
                handleDeepLink({ url });
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        const restoreNavigationState = async () => {
            try {
                const savedStateString = Platform.OS === 'web' && typeof localStorage !== 'undefined'
                    ? localStorage.getItem(NAVIGATION_PERSISTENCE_KEY)
                    : await AsyncStorage.getItem(NAVIGATION_PERSISTENCE_KEY);

                if (savedStateString) {
                    const state = JSON.parse(savedStateString);
                    setInitialState(state);
                }
            } catch (e) {
                console.log('Nav restore error:', e);
            } finally {
                setIsNavRestored(true);
            }
        };

        restoreNavigationState();
    }, []);

    useEffect(() => {
        setupAxiosInterceptors();
        let cancelled = false;

        // On web, if already hydrated from a previous session, show app immediately
        if (Platform.OS === 'web' && useAuthStore.getState().hydrated) {
            setIsReady(true);
            return;
        }

        // Safety timeout: force-ready after 2s max to avoid blank screen
        const safety = setTimeout(() => {
            if (!cancelled) {
                useAuthStore.setState({ hydrated: true });
                setIsReady(true);
            }
        }, 2000);

        useAuthStore.getState().hydrate().finally(() => {
            if (!cancelled) setIsReady(true);
            clearTimeout(safety);
        });

        return () => {
            cancelled = true;
            clearTimeout(safety);
        };
    }, []);

    // Only block render if NEITHER ready nor hydrated — avoids infinite blank screen
    if (!isReady && !hydrated) {
        return <BootSplash />;
    }

    const isBanned = user?.status === 'banned';
    const isAdmin = user?.email === 'admin@subko.app' || user?.email === 'admin@subme.app';

    return (
        <SafeAreaProvider style={{ flex: 1, height: '100%', width: '100%' }}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
            <NavigationContainer
                initialState={initialState}
                onStateChange={(state) => {
                    if (state) {
                        try {
                            const jsonState = JSON.stringify(state);
                            if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
                                localStorage.setItem(NAVIGATION_PERSISTENCE_KEY, jsonState);
                            } else {
                                AsyncStorage.setItem(NAVIGATION_PERSISTENCE_KEY, jsonState);
                            }
                        } catch (e) {}
                    }
                }}
                documentTitle={{ enabled: true, formatter: () => 'SubMe' }}
            >
                <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgPrimary }, animation: Platform.OS === 'web' ? 'none' : 'default' }}>
                    {!token ? (
                        <Stack.Screen name="Auth" component={AuthNavigator} />
                    ) : requiresPasswordReset ? (
                        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                    ) : isBanned ? (
                        <Stack.Screen name="Banned" component={BannedScreen} />
                    ) : isAdmin && isAdminMode ? (
                        <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
                    ) : (
                        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                    )}
                    <Stack.Screen name="TaskScreen" component={TaskScreen} />
                    <Stack.Screen name="SubmitProofScreen" component={SubmitProofScreen} />
                    <Stack.Screen name="MyProofs" component={MyProofsScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

const bootStyles = StyleSheet.create({
    wrap: {
        flex: 1,
        backgroundColor: colors.bgDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        fontFamily,
        fontSize: 32,
        fontWeight: '800',
        color: colors.lime,
    },
});
