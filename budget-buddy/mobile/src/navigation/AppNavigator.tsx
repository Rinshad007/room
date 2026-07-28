/**
 * AppNavigator — light theme, auth-gated routing.
 * Uses our useAuthStore (reactive) to switch between Auth and Main stacks.
 */
import React, { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import { useAuthStore } from '../store/auth';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import LoadingSpinner from '../components/LoadingSpinner';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

const LightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: 'rgba(248,249,250,0.95)',
    text: colors.onSurface,
    border: colors.outlineVariant + '50',
    notification: colors.error,
  },
};

export default function AppNavigator() {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [hasFirebaseUser, setHasFirebaseUser] = useState(false);
  const { isAuthenticated, isHydrated, user } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setHasFirebaseUser(!!firebaseUser);
      setFirebaseReady(true);
    });
    return unsub;
  }, []);

  const isLoggedIn = isAuthenticated && hasFirebaseUser;

  useEffect(() => {
    if (isLoggedIn && user?.id) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          update(ref(db, `users/${user.id}`), { push_token: token }).catch((err) => {
            console.error('Failed to save push token to Firebase:', err);
          });
        }
      });
    }
  }, [isLoggedIn, user?.id]);

  // Wait for BOTH AsyncStorage hydration AND Firebase auth state before deciding route
  if (!firebaseReady || !isHydrated) return <LoadingSpinner />;

  return (
    <NavigationContainer theme={LightTheme}>
      {isLoggedIn ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
