import { initializeApp, getApps } from 'firebase/app';
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const firebaseConfig = {
  apiKey: 'AIzaSyDH9vPPyuogloZkKvfmvPtQphKV6sB54I8',
  authDomain: 'buddybuddy-23085.firebaseapp.com',
  databaseURL: 'https://buddybuddy-23085-default-rtdb.firebaseio.com',
  projectId: 'buddybuddy-23085',
  storageBucket: 'buddybuddy-23085.firebasestorage.app',
  messagingSenderId: '115570661972',
  appId: '1:115570661972:web:caf93395e3b72d300dabc1',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

export const db = getDatabase(app);

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: '420901561899-edot1hm4db0pp3v7rgm8u87qnv3leurl.apps.googleusercontent.com',
});

export default app;
