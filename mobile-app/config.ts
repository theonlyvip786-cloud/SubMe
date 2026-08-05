import { Platform, NativeModules } from 'react-native';

const isWeb = Platform.OS === 'web';

const getWebApiUrl = (): string => {
  if (!isWeb) {
    // 1. Try to parse from the loaded Metro bundler bundle URL
    const scriptURL = NativeModules.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/http:\/\/([^:\/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
      return `http://${match[1]}:5000`;
    }
    // 2. Direct exact PC local IP address on Wi-Fi (Jio/Airtel private hot-spots)
    if (!__DEV__) {
      // Production live Render server URL
      return 'https://subme-5zgl.onrender.com';
    }
    
    return 'http://10.65.96.229:5000';
  }
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;

  // If served directly by the backend Express server on port 5000 or production port
  if (port === '5000' || !port) {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
  // If served by Expo dev server (port 8081 / 19006 etc.), connect to host's port 5000
  return `${protocol}//${hostname}:5000`;
};

  export const API_URL: string = getWebApiUrl();
  export const SUPABASE_URL: string = 'https://otbcyccbonxwaqslqtto.supabase.co';
  export const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90YmN5Y2Nib254d2Fxc2xxdHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTA0MzksImV4cCI6MjA5Nzk2NjQzOX0.vRu4c9aUKd8mF4M79IpmjGU6EqAzNo55_doXcPaPzYU';

