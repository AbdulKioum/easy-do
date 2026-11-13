import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nourish.easydo',
  appName: 'Easy DO',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_notify",
      iconColor: "#2563eb", 
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  server: {
    url: 'https://easy-do-five.vercel.app', 
    cleartext: true
  }
};

export default config;