import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

interface User {
    id: string;
    email: string;
    username: string;
    points: number;
    referral_code?: string;
    status: 'active' | 'banned' | 'pending';
}

function normalizeUser(data: any): User {
    if (!data) throw new Error('Empty user profile');
    const u = data.user || data;
    return {
        id: u.id,
        email: u.email,
        username: u.username,
        points: u.points ?? 0,
        referral_code: u.referral_code,
        status: u.status || 'active',
    };
}

interface AuthState {
    token: string | null;
    user: User | null;
    hydrated: boolean;
    isAdminMode: boolean;
    justLoggedIn: boolean;
    requiresPasswordReset: boolean;
    pushEnabled: boolean;
    emailsEnabled: boolean;
    highPerformance: boolean;
    customAvatarUri: string | null;
    pendingReferralCode: string | null;
    setAuth: (token: string, user: User) => void;
    setAdminMode: (mode: boolean) => void;
    setJustLoggedIn: (val: boolean) => void;
    setRequiresPasswordReset: (val: boolean) => void;
    updateUser: (partial: Partial<User>) => void;
    setPushEnabled: (val: boolean) => void;
    setEmailsEnabled: (val: boolean) => void;
    setHighPerformance: (val: boolean) => void;
    setCustomAvatarUri: (uri: string | null) => void;
    setPendingReferralCode: (code: string | null) => void;
    logout: () => Promise<void>;
    hydrate: () => Promise<void>;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      hydrated: false,
      isAdminMode: false,
      justLoggedIn: false,
      requiresPasswordReset: false,
      pushEnabled: true,
      emailsEnabled: false,
      highPerformance: true,
      customAvatarUri: null,
      pendingReferralCode: null,
      setAuth: (token, user) => {
          set({ token, user, isAdminMode: false, justLoggedIn: true });
      },
      setAdminMode: (mode) => set({ isAdminMode: mode }),
      setJustLoggedIn: (val) => set({ justLoggedIn: val }),
      setRequiresPasswordReset: (val) => set({ requiresPasswordReset: val }),
      setPushEnabled: (val) => set({ pushEnabled: val }),
      setEmailsEnabled: (val) => set({ emailsEnabled: val }),
      setHighPerformance: (val) => set({ highPerformance: val }),
      setCustomAvatarUri: (uri) => set({ customAvatarUri: uri }),
      setPendingReferralCode: (code) => set({ pendingReferralCode: code }),
      updateUser: (partial) => {
          const state = get();
          const updated = state.user ? { ...state.user, ...partial } : state.user;
          set({ user: updated });
      },
      logout: async () => {
          await supabase.auth.signOut();
          set({ token: null, user: null, customAvatarUri: null });
      },
      hydrate: async () => {
          if (get().hydrated) return;
          try {
              const sessionPromise = supabase.auth.getSession();
              const timeout = new Promise<{ data: { session: null } }>((resolve) =>
                  setTimeout(() => resolve({ data: { session: null } }), 8000)
              );
              const { data: { session } } = await Promise.race([sessionPromise, timeout]);
              if (session?.access_token) {
                  try {
                      const res = await axios.get(`${API_URL}/api/users/me`, {
                          headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      set({ token: session.access_token, user: normalizeUser(res.data) });
                      getDeviceId().then(deviceId => {
                          axios.post(`${API_URL}/api/auth/device`, { device_id: deviceId }, {
                              headers: { Authorization: `Bearer ${session.access_token}` },
                          }).catch(() => { /* silent */ });
                      });
                  } catch (profileErr: any) {
                      try {
                          await axios.post(`${API_URL}/api/auth/`, {
                              username: session.user.user_metadata?.username,
                              referral_code_input: session.user.user_metadata?.referral_code_input,
                          }, {
                              headers: { Authorization: `Bearer ${session.access_token}` },
                          });
                          const retryRes = await axios.get(`${API_URL}/api/users/me`, {
                              headers: { Authorization: `Bearer ${session.access_token}` },
                          });
                          set({ token: session.access_token, user: normalizeUser(retryRes.data) });
                      } catch (fallbackErr) {
                          set({
                              token: session.access_token,
                              user: {
                                  id: session.user.id,
                                  email: session.user.email || '',
                                  username: (session.user.user_metadata?.username || (session.user.email || '').split('@')[0]),
                                  points: 0,
                                  // BUG-11: include referral_code so referral screens work on cold start
                                  referral_code: session.user.id.replace(/-/g, '').toUpperCase(),
                                  status: 'active' as const,
                              },
                          });
                      }
                  }
              }
          } catch (e) {
              console.error('Auth hydrate error:', e);
          } finally {
              set({ hydrated: true });
          }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        token: state.token, 
        user: state.user,
        pushEnabled: state.pushEnabled,
        emailsEnabled: state.emailsEnabled,
        highPerformance: state.highPerformance,
        customAvatarUri: state.customAvatarUri,
        pendingReferralCode: state.pendingReferralCode,
      }),
    }
  )
);

// Only clear store on explicit sign-out (not on INITIAL_SESSION null before hydrate)
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        useAuthStore.setState({ token: null, user: null, requiresPasswordReset: false });
        return;
    }
    if (event === 'PASSWORD_RECOVERY') {
        useAuthStore.setState({ requiresPasswordReset: true });
    }
    if (session?.access_token && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        const current = useAuthStore.getState();
        if (!current.token || current.token !== session.access_token || !current.user) {
            useAuthStore.setState({ token: session.access_token });
            
            // Fetch user profile from backend API to ensure user object is populated
            try {
                const res = await axios.get(`${API_URL}/api/users/me`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                useAuthStore.setState({ user: normalizeUser(res.data) });
            } catch (profileErr: any) {
                // Fallback username and email matching session user metadata if API fails
                useAuthStore.setState({
                    user: {
                        id: session.user.id,
                        email: session.user.email || '',
                        username: (session.user.user_metadata?.username || (session.user.email || '').split('@')[0]),
                        points: 0,
                        // BUG-11: include referral_code so referral screens work on cold start
                        referral_code: session.user.id.replace(/-/g, '').toUpperCase(),
                        status: 'active',
                    }
                });
            }
        }
    }
});

// Setup axios interceptor for auto-logout on 401/403
let interceptorSetup = false;
export const setupAxiosInterceptors = () => {
    if (interceptorSetup) return;
    interceptorSetup = true;
    
    // Global 60-second timeout to allow Render free tier backend time to wake up from sleep
    axios.defaults.timeout = 60000;
    
    axios.interceptors.response.use(
        response => response,
        error => {
            const status = error.response?.status;
            const hadAuth = Boolean(error.config?.headers?.Authorization);
            const isBanned = status === 403 && error.response?.data?.error?.toLowerCase?.().includes?.('banned');
            if (hadAuth && useAuthStore.getState().token) {
                if (status === 403 && isBanned) {
                    const u = useAuthStore.getState().user;
                    if (u) useAuthStore.setState({ user: { ...u, status: 'banned' } });
                } else if (status === 401) {
                    useAuthStore.getState().logout();
                }
            }
            return Promise.reject(error);
        }
    );
};

export default useAuthStore;
