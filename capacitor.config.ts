import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nourish.easydo',
  appName: 'Easy DO',
  webDir: 'dist',
  server: {
    url: 'https://xazcbgiovvrtzrhymgsc.supabase.co/storage/v1/object/public/APK/Easy-DO.apk?download=Easy-DO.apk', 
    cleartext: true
  }
};

export default config;