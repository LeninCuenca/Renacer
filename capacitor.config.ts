import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.renacer.app',
  appName: 'Renacer',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#1a3a5e',
      androidSpin: true,
      iosSpinColor: '#ffd700'
    }
  }
};

export default config;
