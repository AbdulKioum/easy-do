import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nourish.easydo',
  appName: 'Easy DO',
  webDir: 'dist',
  server: {
    url: 'https://easy-do-five.vercel.app', 
    cleartext: true
  }
};

export default config;