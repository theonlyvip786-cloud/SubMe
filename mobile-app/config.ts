import { Platform, NativeModules } from 'react-native';

const isWeb = Platform.OS === 'web';
const RENDER_BACKEND_URL = 'https://subme-5zgl.onrender.com';

const getWebApiUrl = (): string => {
  if (!isWeb) {
    // 1. Try to parse from the loaded Metro bundler bundle URL during local dev (npx expo start)
    if (__DEV__) {
      const scriptURL = NativeModules.SourceCode?.scriptURL || '';
      const match = scriptURL.match(/http:\/\/([^:\/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:5000`;
      }
    }
    // 2. Production / Standalone APK default to Render live backend URL
    return RENDER_BACKEND_URL;
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:5000`;
  }

  if (port === '5000' || !port) {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
  return RENDER_BACKEND_URL;
};

export const API_URL: string = getWebApiUrl();
export const SUPABASE_URL: string = 'https://otbcyccbonxwaqslqtto.supabase.co';
export const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YmN5Y2Nib254d2Fxc2xxdHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTA0MzksImV4cCI6MjA5Nzk2NjQzOX0.vRu4c9aUKd8mF4M79IpmjGU6EqAzNo55_doXcPaPzYU';

